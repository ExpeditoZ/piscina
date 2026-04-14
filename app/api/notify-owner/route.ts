import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { poolId, guestName, bookingDate, totalPrice, shiftSelected } = body;

    if (!poolId || !guestName || !bookingDate || !totalPrice) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Fetch pool owner's telegram_chat_id using admin client (bypasses RLS)
    const supabase = createAdminClient();
    const { data: pool, error } = await supabase
      .from("pools")
      .select("title, telegram_chat_id")
      .eq("id", poolId)
      .single();

    if (error || !pool?.telegram_chat_id) {
      // No telegram configured — that's ok, just skip
      return Response.json({ ok: true, skipped: true });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.error("TELEGRAM_BOT_TOKEN not set");
      return Response.json({ ok: true, skipped: true });
    }

    // Build Telegram message
    const shiftText = shiftSelected ? `\nTurno: ${shiftSelected}` : "";
    const message =
      `🚨 *Nova Solicitação de Reserva!*\n\n` +
      `📍 Piscina: *${pool.title}*\n` +
      `👤 Hóspede: *${guestName}*\n` +
      `📅 Data: *${bookingDate}*${shiftText}\n` +
      `💰 Valor: *R$ ${totalPrice}*\n\n` +
      `O hóspede foi redirecionado para o WhatsApp. Já recebeu o PIX?`;

    // Send Telegram message with inline keyboard
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

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Notify owner error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
