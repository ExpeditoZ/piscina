import { createAdminClient } from "@/lib/supabase/admin";
import { isWeekend, parseISO } from "date-fns";

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
 * Server-side booking creation with:
 * 1. Price recalculation from trusted DB data (never trust client price)
 * 2. Double-booking prevention (DB unique index + application check)
 * 3. Rate limiting
 * 4. Telegram notification
 * 5. WhatsApp URL construction (phone never sent to client)
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
      bookingDate,
      shiftSelected,
      selectedUpsellIds,
      whatsappMessage,
    } = body;

    // Validate required fields
    if (!poolId || !guestName?.trim() || !bookingDate || !arrivalTime) {
      return Response.json(
        { error: "Campos obrigatórios ausentes." },
        { status: 400 }
      );
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(bookingDate)) {
      return Response.json(
        { error: "Formato de data inválido." },
        { status: 400 }
      );
    }

    // Ensure date is in the future
    const bookingDateObj = parseISO(bookingDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (bookingDateObj < today) {
      return Response.json(
        { error: "Não é possível reservar datas passadas." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 1. Fetch pool data from DB (trusted source for pricing)
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

    // 2. SERVER-SIDE PRICE RECALCULATION (never trust client)
    const pricing = pool.pricing as { weekday: number; weekend: number };
    const shiftsConfig = pool.shifts_config as {
      enabled: boolean;
      options: { name: string; price: number }[];
    } | null;
    const upsellExtras = pool.upsell_extras as
      | { id: string; name: string; price: number }[]
      | null;

    let basePrice: number;
    let validatedShift: string | null = null;

    // Calculate base price from shift or day type
    if (
      shiftSelected &&
      shiftsConfig?.enabled &&
      shiftsConfig.options.length > 0
    ) {
      const matchedShift = shiftsConfig.options.find(
        (s) => s.name === shiftSelected
      );
      if (!matchedShift) {
        return Response.json(
          { error: "Turno selecionado inválido." },
          { status: 400 }
        );
      }
      basePrice = matchedShift.price;
      validatedShift = matchedShift.name;
    } else {
      basePrice = isWeekend(bookingDateObj)
        ? pricing.weekend
        : pricing.weekday;
    }

    // Calculate upsell total
    let upsellTotal = 0;
    let validatedUpsells: { id: string; name: string; price: number }[] | null =
      null;

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
          validatedUpsells.push({
            id: matched.id,
            name: matched.name,
            price: matched.price,
          });
          upsellTotal += matched.price;
        }
      }
      if (validatedUpsells.length === 0) validatedUpsells = null;
    }

    const totalPrice = basePrice + upsellTotal;

    // 3. Check for existing active booking (application-level check)
    const { data: existingBooking } = await supabase
      .from("bookings")
      .select("id")
      .eq("pool_id", poolId)
      .eq("booking_date", bookingDate)
      .in("status", ["negotiating", "confirmed"])
      .maybeSingle();

    if (existingBooking) {
      return Response.json(
        {
          error:
            "Esta data já está reservada ou em negociação. Escolha outra data.",
        },
        { status: 409 }
      );
    }

    // 4. Insert booking
    const { data: insertedBooking, error: insertError } = await supabase
      .from("bookings")
      .insert({
        pool_id: poolId,
        guest_name: guestName.trim(),
        arrival_time: arrivalTime,
        booking_date: bookingDate,
        shift_selected: validatedShift,
        total_price: totalPrice,
        selected_upsells: validatedUpsells,
        status: "negotiating",
      })
      .select("id")
      .single();

    if (insertError) {
      // Handle unique constraint violation (race condition)
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

    // 5. Build WhatsApp URL server-side (phone never sent to client)
    let whatsappUrl: string | null = null;
    if (pool.owner_whatsapp && whatsappMessage) {
      const encodedMessage = encodeURIComponent(whatsappMessage);
      whatsappUrl = `https://wa.me/${pool.owner_whatsapp}?text=${encodedMessage}`;
    }

    // 6. Send Telegram notification (fire & forget)
    if (pool.telegram_chat_id) {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (botToken) {
        const shiftText = validatedShift
          ? `\nTurno: ${validatedShift}`
          : "";
        const message =
          `🚨 *Nova Solicitação de Reserva!*\n\n` +
          `📍 Piscina: *${pool.title}*\n` +
          `👤 Hóspede: *${guestName.trim()}*\n` +
          `📅 Data: *${bookingDate}*${shiftText}\n` +
          `💰 Valor: *R$ ${totalPrice}*\n\n` +
          `O hóspede foi redirecionado para o WhatsApp. Já recebeu o PIX?`;

        fetch(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
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
                      text: "✅ Confirmar & Bloquear Data",
                      callback_data: `confirm_${poolId}_${bookingDate}`,
                    },
                    {
                      text: "❌ Rejeitar / Liberar",
                      callback_data: `reject_${poolId}_${bookingDate}`,
                    },
                  ],
                ],
              },
            }),
          }
        ).catch(console.error);
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
