import { createAdminClient } from "@/lib/supabase/admin";
import {
  isWeekend,
  parseISO,
  eachDayOfInterval,
  differenceInCalendarDays,
  isBefore,
} from "date-fns";
import type { BookingMode, PricingBreakdown } from "@/lib/types";

// Simple in-memory rate limiter (per IP, 5 requests per minute)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 5;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return false;
  }

  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

/**
 * POST /api/create-booking
 *
 * Supports 3 booking modes:
 * - shift:    single day, one shift selected
 * - full_day: single day, no shift
 * - range:    multiple consecutive days
 *
 * Server-side price recalculation, conflict detection, Telegram notification.
 */
export async function POST(request: Request) {
  try {
    // Rate limiting
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    if (isRateLimited(ip)) {
      return Response.json(
        { error: "Muitas tentativas. Aguarde um minuto." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const {
      poolId,
      guestName,
      arrivalTime,
      bookingMode,
      startDate: startDateStr,
      endDate: endDateStr,
      shiftSelected,
      selectedUpsellIds,
      whatsappMessage,
    } = body;

    // Validate required fields
    if (
      !poolId ||
      !guestName?.trim() ||
      !startDateStr ||
      !endDateStr ||
      !arrivalTime ||
      !bookingMode
    ) {
      return Response.json(
        { error: "Campos obrigatórios ausentes." },
        { status: 400 }
      );
    }

    // Validate booking mode
    const validModes: BookingMode[] = ["shift", "full_day", "range"];
    if (!validModes.includes(bookingMode)) {
      return Response.json(
        { error: "Modo de reserva inválido." },
        { status: 400 }
      );
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDateStr) || !dateRegex.test(endDateStr)) {
      return Response.json(
        { error: "Formato de data inválido." },
        { status: 400 }
      );
    }

    const startDate = parseISO(startDateStr);
    const endDate = parseISO(endDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isBefore(startDate, today)) {
      return Response.json(
        { error: "Não é possível reservar datas passadas." },
        { status: 400 }
      );
    }

    if (isBefore(endDate, startDate)) {
      return Response.json(
        { error: "Data final deve ser igual ou posterior à data inicial." },
        { status: 400 }
      );
    }

    const totalDays = differenceInCalendarDays(endDate, startDate) + 1;

    // Validate mode constraints
    if (bookingMode === "shift" && totalDays !== 1) {
      return Response.json(
        { error: "Reserva por turno é apenas para 1 dia." },
        { status: 400 }
      );
    }

    if (bookingMode === "range" && totalDays < 2) {
      return Response.json(
        { error: "Reserva por período requer pelo menos 2 dias." },
        { status: 400 }
      );
    }

    if (bookingMode === "shift" && !shiftSelected) {
      return Response.json(
        { error: "Selecione um turno." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 1. Fetch pool data
    const { data: pool, error: poolError } = await supabase
      .from("pools")
      .select(
        "id, title, pricing, shifts_config, upsell_extras, owner_whatsapp, telegram_chat_id"
      )
      .eq("id", poolId)
      .single();

    if (poolError || !pool) {
      return Response.json(
        { error: "Piscina não encontrada." },
        { status: 404 }
      );
    }

    // 2. SERVER-SIDE PRICE RECALCULATION
    const pricing = pool.pricing as { weekday: number; weekend: number };
    const shiftsConfig = pool.shifts_config as {
      enabled: boolean;
      options: { name: string; price: number }[];
    } | null;
    const upsellExtras = pool.upsell_extras as
      | { id: string; name: string; price: number; billing?: string }[]
      | null;

    const breakdown: PricingBreakdown = {
      mode: bookingMode as BookingMode,
      days: [],
      subtotalBase: 0,
      extras: [],
      subtotalExtras: 0,
      total: 0,
    };

    let validatedShift: string | null = null;

    if (bookingMode === "shift") {
      // Shift price
      if (!shiftsConfig?.enabled) {
        return Response.json(
          { error: "Turnos não estão habilitados para esta piscina." },
          { status: 400 }
        );
      }
      const matchedShift = shiftsConfig.options.find(
        (s) => s.name === shiftSelected
      );
      if (!matchedShift) {
        return Response.json(
          { error: "Turno selecionado inválido." },
          { status: 400 }
        );
      }
      validatedShift = matchedShift.name;
      breakdown.shiftName = matchedShift.name;
      breakdown.shiftPrice = matchedShift.price;
      breakdown.subtotalBase = matchedShift.price;
      breakdown.days = [
        {
          date: startDateStr,
          price: matchedShift.price,
          type: isWeekend(startDate) ? "weekend" : "weekday",
        },
      ];
    } else {
      // Full-day or range: sum daily prices
      const days = eachDayOfInterval({ start: startDate, end: endDate });
      breakdown.days = days.map((d) => {
        const wknd = isWeekend(d);
        const price = wknd ? pricing.weekend : pricing.weekday;
        return {
          date: d.toISOString().split("T")[0],
          price,
          type: wknd ? ("weekend" as const) : ("weekday" as const),
        };
      });
      breakdown.subtotalBase = breakdown.days.reduce(
        (sum, d) => sum + d.price,
        0
      );
    }

    // Calculate upsell total
    let validatedUpsells:
      | {
          id: string;
          name: string;
          price: number;
          billing?: string;
          quantity?: number;
          total?: number;
        }[]
      | null = null;

    if (
      selectedUpsellIds &&
      Array.isArray(selectedUpsellIds) &&
      selectedUpsellIds.length > 0 &&
      upsellExtras
    ) {
      validatedUpsells = [];
      for (const upsellId of selectedUpsellIds) {
        const matched = upsellExtras.find(
          (e: { id: string }) => e.id === upsellId
        );
        if (matched) {
          const billing = matched.billing ?? "per_reservation";
          const quantity = billing === "per_day" ? totalDays : 1;
          const lineTotal = matched.price * quantity;

          validatedUpsells.push({
            id: matched.id,
            name: matched.name,
            price: matched.price,
            billing,
            quantity,
            total: lineTotal,
          });

          breakdown.extras.push({
            id: matched.id,
            name: matched.name,
            unitPrice: matched.price,
            quantity,
            total: lineTotal,
          });
          breakdown.subtotalExtras += lineTotal;
        }
      }
      if (validatedUpsells.length === 0) validatedUpsells = null;
    }

    breakdown.total = breakdown.subtotalBase + breakdown.subtotalExtras;
    const totalPrice = breakdown.total;

    // 3. CONFLICT CHECK
    if (bookingMode === "shift") {
      // Check if the same shift on the same day is already booked
      const { data: conflict } = await supabase
        .from("bookings")
        .select("id")
        .eq("pool_id", poolId)
        .eq("start_date", startDateStr)
        .eq("shift_selected", validatedShift)
        .in("status", ["negotiating", "confirmed"])
        .maybeSingle();

      if (conflict) {
        return Response.json(
          { error: "Este turno já está reservado nesta data." },
          { status: 409 }
        );
      }

      // Also check if a full-day or range booking covers this date
      const { data: fullDayConflict } = await supabase
        .from("bookings")
        .select("id")
        .eq("pool_id", poolId)
        .lte("start_date", startDateStr)
        .gte("end_date", startDateStr)
        .in("booking_mode", ["full_day", "range"])
        .in("status", ["negotiating", "confirmed"])
        .maybeSingle();

      if (fullDayConflict) {
        return Response.json(
          {
            error:
              "Esta data já está reservada para o dia inteiro.",
          },
          { status: 409 }
        );
      }
    } else if (bookingMode === "full_day") {
      // Check if any booking exists on this date
      const { data: conflict } = await supabase
        .from("bookings")
        .select("id")
        .eq("pool_id", poolId)
        .lte("start_date", startDateStr)
        .gte("end_date", startDateStr)
        .in("status", ["negotiating", "confirmed"])
        .maybeSingle();

      if (conflict) {
        return Response.json(
          {
            error:
              "Esta data já está reservada ou em negociação. Escolha outra data.",
          },
          { status: 409 }
        );
      }
    } else {
      // RANGE: check every day in the interval
      const { data: conflicts } = await supabase
        .from("bookings")
        .select("id, start_date, end_date")
        .eq("pool_id", poolId)
        .in("status", ["negotiating", "confirmed"])
        .lte("start_date", endDateStr)
        .gte("end_date", startDateStr);

      if (conflicts && conflicts.length > 0) {
        return Response.json(
          {
            error:
              "O período selecionado conflita com reservas existentes. Escolha outro período.",
          },
          { status: 409 }
        );
      }
    }

    // 4. Insert booking
    const { data: insertedBooking, error: insertError } = await supabase
      .from("bookings")
      .insert({
        pool_id: poolId,
        guest_name: guestName.trim(),
        arrival_time: arrivalTime,
        booking_date: startDateStr, // backward compat
        booking_mode: bookingMode,
        start_date: startDateStr,
        end_date: endDateStr,
        total_days: totalDays,
        shift_selected: validatedShift,
        total_price: totalPrice,
        pricing_breakdown: breakdown,
        selected_upsells: validatedUpsells,
        status: "negotiating",
      })
      .select("id")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return Response.json(
          {
            error:
              "Esta data acabou de ser reservada por outra pessoa. Escolha outra data.",
          },
          { status: 409 }
        );
      }
      console.error("Booking insert error:", insertError);
      return Response.json(
        { error: "Erro ao registrar reserva." },
        { status: 500 }
      );
    }

    // 5. Build WhatsApp URL
    let whatsappUrl: string | null = null;
    if (pool.owner_whatsapp && whatsappMessage) {
      const encodedMessage = encodeURIComponent(whatsappMessage);
      whatsappUrl = `https://wa.me/${pool.owner_whatsapp}?text=${encodedMessage}`;
    }

    // 6. Send Telegram notification
    if (pool.telegram_chat_id) {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (botToken) {
        const shiftText = validatedShift ? `\nTurno: ${validatedShift}` : "";
        const periodText =
          bookingMode === "range"
            ? `\n📅 Período: ${startDateStr} → ${endDateStr} (${totalDays} dias)`
            : `\n📅 Data: *${startDateStr}*${shiftText}`;

        const modeLabel =
          bookingMode === "shift"
            ? "Turno"
            : bookingMode === "range"
            ? "Período"
            : "Dia Inteiro";

        const message =
          `🚨 *Nova Solicitação de Reserva!*\n\n` +
          `📍 Piscina: *${pool.title}*\n` +
          `👤 Hóspede: *${guestName.trim()}*\n` +
          `🏷 Tipo: *${modeLabel}*` +
          periodText +
          `\n💰 Valor: *R$ ${totalPrice}*\n\n` +
          `O hóspede foi redirecionado para o WhatsApp. Já recebeu o PIX?`;

        const callbackBase =
          bookingMode === "range"
            ? `${poolId}_${startDateStr}_${endDateStr}`
            : `${poolId}_${startDateStr}`;

        fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: pool.telegram_chat_id,
            text: message,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "✅ Confirmar & Bloquear",
                    callback_data: `confirm_${callbackBase}`,
                  },
                  {
                    text: "❌ Rejeitar / Liberar",
                    callback_data: `reject_${callbackBase}`,
                  },
                ],
              ],
            },
          }),
        }).catch(console.error);
      }
    }

    return Response.json({
      ok: true,
      bookingId: insertedBooking.id,
      totalPrice,
      whatsappUrl,
    });
  } catch (error) {
    console.error("Create booking error:", error);
    return Response.json(
      { error: "Erro interno do servidor." },
      { status: 500 }
    );
  }
}
