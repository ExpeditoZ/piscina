import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Telegram Webhook Handler
 * Receives callback_query events when pool owners tap
 * inline keyboard buttons (Confirm / Reject).
 *
 * Callback data format: "confirm_{bookingId}" or "reject_{bookingId}"
 *
 * Also handles /start messages to return the user's Chat ID.
 *
 * SECURITY: Verifies X-Telegram-Bot-Api-Secret-Token header.
 * When registering the webhook, pass secret_token to Telegram's setWebhook API.
 */
export async function POST(request: Request) {
  try {
    // Verify Telegram secret token (set when registering the webhook)
    const telegramSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (telegramSecret) {
      const headerSecret = request.headers.get(
        "x-telegram-bot-api-secret-token"
      );
      if (headerSecret !== telegramSecret) {
        console.warn("Telegram webhook: invalid secret token");
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const body = await request.json();

    // Handle callback_query from inline keyboard
    const callbackQuery = body.callback_query;
    if (!callbackQuery) {
      // Could be a /start message — respond with chat ID
      if (body.message?.text === "/start") {
        const chatId = body.message.chat.id;
        const botToken = process.env.TELEGRAM_BOT_TOKEN;

        if (botToken) {
          const response = await fetch(
            `https://api.telegram.org/bot${botToken}/sendMessage`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                text:
                  `👋 Olá! Bem-vindo ao *AlugueSuaPiscina*!\n\n` +
                  `Seu Chat ID é:\n\n` +
                  `\`${chatId}\`\n\n` +
                  `📋 *Como usar:*\n` +
                  `1. Copie o número acima\n` +
                  `2. Acesse seu painel em AlugueSuaPiscina\n` +
                  `3. Cole no campo "Telegram Chat ID"\n` +
                  `4. Salve as configurações\n\n` +
                  `✅ Pronto! Você receberá notificações de reservas aqui.`,
                parse_mode: "Markdown",
              }),
            }
          );

          if (!response.ok) {
            const errText = await response.text();
            console.error("Telegram /start send error:", response.status, errText);
          }
        }

        return Response.json({ ok: true });
      }

      // Unknown message type — just acknowledge
      return Response.json({ ok: true });
    }

    const data = callbackQuery.data as string;
    const chatId = callbackQuery.message?.chat?.id;
    const messageId = callbackQuery.message?.message_id;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!data || !chatId || !botToken) {
      return Response.json({ ok: true });
    }

    // Parse callback data
    // Format: "confirm_{bookingId}" or "reject_{bookingId}"
    const underscoreIndex = data.indexOf("_");
    if (underscoreIndex === -1) {
      await answerCallback(botToken, callbackQuery.id, "❌ Dados inválidos");
      return Response.json({ ok: true });
    }

    const action = data.substring(0, underscoreIndex); // "confirm" or "reject"
    const bookingId = data.substring(underscoreIndex + 1); // UUID

    if (!action || !bookingId || (action !== "confirm" && action !== "reject")) {
      await answerCallback(botToken, callbackQuery.id, "❌ Dados inválidos");
      return Response.json({ ok: true });
    }

    const supabase = createAdminClient();

    if (action === "confirm") {
      // Fetch booking details first
      const { data: booking, error: fetchError } = await supabase
        .from("bookings")
        .select("id, pool_id, guest_name, arrival_time, booking_mode, total_days, start_date, end_date, status")
        .eq("id", bookingId)
        .single();

      if (fetchError || !booking) {
        console.error("Booking not found:", bookingId, fetchError);
        await answerCallback(botToken, callbackQuery.id, "❌ Reserva não encontrada");
        return Response.json({ ok: true });
      }

      if (booking.status !== "negotiating") {
        await answerCallback(
          botToken,
          callbackQuery.id,
          booking.status === "confirmed"
            ? "ℹ️ Esta reserva já foi confirmada"
            : "ℹ️ Esta reserva já foi cancelada"
        );
        return Response.json({ ok: true });
      }

      // Update booking status to confirmed
      const { error: updateError } = await supabase
        .from("bookings")
        .update({ status: "confirmed" })
        .eq("id", bookingId)
        .eq("status", "negotiating");

      if (updateError) {
        console.error("Error confirming booking:", updateError);
        await answerCallback(botToken, callbackQuery.id, "❌ Erro ao confirmar");
        return Response.json({ ok: true });
      }

      // Fetch pool private info to share with owner
      const { data: pool } = await supabase
        .from("pools")
        .select("exact_address, key_lockbox_instructions")
        .eq("id", booking.pool_id)
        .single();

      // Answer callback
      await answerCallback(
        botToken,
        callbackQuery.id,
        "✅ Reserva confirmada e bloqueada!"
      );

      // Update the original message to remove buttons
      const isRange = booking.start_date !== booking.end_date;
      const dateLabel = isRange
        ? `${booking.start_date} → ${booking.end_date} (${booking.total_days ?? "?"} dias)`
        : booking.start_date;

      const confirmMsg =
        `✅ *Reserva Confirmada!*\n\n` +
        `📅 ${isRange ? "Período" : "Data"}: *${dateLabel}*\n` +
        `👤 Hóspede: *${booking.guest_name}*\n` +
        `⏰ Chegada: *${booking.arrival_time}*\n\n` +
        `📋 *Copie e encaminhe ao hóspede no WhatsApp:*\n\n` +
        `Endereço: ${pool?.exact_address ?? "Não informado"}\n` +
        `Instruções: ${pool?.key_lockbox_instructions ?? "Não informado"}`;

      await editMessage(botToken, chatId, messageId, confirmMsg);

    } else if (action === "reject") {
      // Fetch booking to check status
      const { data: booking } = await supabase
        .from("bookings")
        .select("id, start_date, end_date, status")
        .eq("id", bookingId)
        .single();

      if (!booking) {
        await answerCallback(botToken, callbackQuery.id, "❌ Reserva não encontrada");
        return Response.json({ ok: true });
      }

      if (booking.status !== "negotiating") {
        await answerCallback(
          botToken,
          callbackQuery.id,
          booking.status === "confirmed"
            ? "ℹ️ Esta reserva já foi confirmada — cancele manualmente"
            : "ℹ️ Esta reserva já foi cancelada"
        );
        return Response.json({ ok: true });
      }

      // Update booking status to cancelled
      const { error: updateError } = await supabase
        .from("bookings")
        .update({ status: "cancelled" })
        .eq("id", bookingId)
        .eq("status", "negotiating");

      if (updateError) {
        console.error("Error rejecting booking:", updateError);
        await answerCallback(botToken, callbackQuery.id, "❌ Erro ao rejeitar");
        return Response.json({ ok: true });
      }

      const isRange = booking.start_date !== booking.end_date;
      const dateLabel = isRange
        ? `${booking.start_date} → ${booking.end_date}`
        : booking.start_date;

      // Answer callback
      await answerCallback(
        botToken,
        callbackQuery.id,
        "🗑️ Reserva rejeitada, data liberada."
      );

      // Update the original message
      await editMessage(
        botToken,
        chatId,
        messageId,
        `❌ *Reserva Rejeitada*\n\nA ${isRange ? "período" : "data"} *${dateLabel}* foi liberada.`
      );
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook error:", error);
    return Response.json({ ok: true }); // Always return 200 to Telegram
  }
}

// Helper: Answer callback query (removes loading state from button)
async function answerCallback(
  botToken: string,
  callbackQueryId: string,
  text: string
) {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/answerCallbackQuery`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text,
          show_alert: true,
        }),
      }
    );
    if (!response.ok) {
      console.error("answerCallbackQuery error:", response.status, await response.text());
    }
  } catch (err) {
    console.error("answerCallbackQuery failed:", err);
  }
}

// Helper: Edit original message (removes inline keyboard)
async function editMessage(
  botToken: string,
  chatId: number,
  messageId: number,
  text: string
) {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/editMessageText`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text,
          parse_mode: "Markdown",
        }),
      }
    );
    if (!response.ok) {
      console.error("editMessageText error:", response.status, await response.text());
    }
  } catch (err) {
    console.error("editMessageText failed:", err);
  }
}
