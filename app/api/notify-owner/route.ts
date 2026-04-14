import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      poolId,
      guestName,
      bookingDate,
      totalPrice,
      shiftSelected,
      bookingId,
      whatsappMessage,
    } = body;

    if (!poolId || !guestName || !bookingDate || !totalPrice || !bookingId) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // SECURITY: Verify the booking actually exists in the database
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("id")
      .eq("id", bookingId)
      .eq("pool_id", poolId)
      .eq("status", "negotiating")
      .maybeSingle();

    if (bookingError || !booking) {
      return Response.json(
        { error: "Booking not found or invalid" },
        { status: 403 }
      );
    }

    // Fetch pool owner's private data using admin client (bypasses RLS)
    const { data: pool, error } = await supabase
      .from("pools")
      .select("title, telegram_chat_id, owner_whatsapp")
      .eq("id", poolId)
      .single();

    if (error || !pool) {
      return Response.json({ ok: true, skipped: true, whatsappUrl: null });
    }

    // Build WhatsApp redirect URL server-side (phone never sent to client)
    let whatsappUrl: string | null = null;
    if (pool.owner_whatsapp && whatsappMessage) {
      const encodedMessage = encodeURIComponent(whatsappMessage);
      whatsappUrl = `https://wa.me/${pool.owner_whatsapp}?text=${encodedMessage}`;
    }

    // Send Telegram notification (if configured)
    if (pool.telegram_chat_id) {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (botToken) {
        const shiftText = shiftSelected
          ? `\nTurno: ${shiftSelected}`
          : "";
        const message =
          `🚨 *Nova Solicitação de Reserva!*\n\n` +
          `📍 Piscina: *${pool.title}*\n` +
          `👤 Hóspede: *${guestName}*\n` +
          `📅 Data: *${bookingDate}*${shiftText}\n` +
          `💰 Valor: *R$ ${totalPrice}*\n\n` +
          `O hóspede foi redirecionado para o WhatsApp. Já recebeu o PIX?`;

        const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const telegramRes = await fetch(telegramUrl, {
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
        });

        if (!telegramRes.ok) {
          const errorText = await telegramRes.text();
          console.error("Telegram API error:", errorText);
        }
      }
    }

    return Response.json({ ok: true, whatsappUrl });
  } catch (error) {
    console.error("Notify owner error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
