import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Telegram Webhook Handler
 * Receives callback_query events when pool owners tap
 * inline keyboard buttons (Confirm / Reject).
 *
 * Callback data format: "confirm_{poolId}_{bookingDate}" or "reject_{poolId}_{bookingDate}"
 *
 * SECURITY: Verifies X-Telegram-Bot-Api-Secret-Token header.
 * When registering the webhook, pass ?secret_token=YOUR_SECRET to Telegram's setWebhook API.
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
          await fetch(
            `https://api.telegram.org/bot${botToken}/sendMessage`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                text:
                  `👋 Olá! Seu Chat ID é:\n\n` +
                  `\`${chatId}\`\n\n` +
                  `Copie este número e cole no painel de configuração da sua piscina em AlugueSuaPiscina.`,
                parse_mode: "Markdown",
              }),
            }
          );
        }

        return Response.json({ ok: true });
      }

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
    // Format: "confirm_{poolId}_{startDate}" or "confirm_{poolId}_{startDate}_{endDate}"
    const parts = data.split("_");
    const action = parts[0]; // "confirm" or "reject"
    const poolId = parts[1];
    // Dates: could be "2026-04-20" or "2026-04-20_2026-04-23"
    const datesPart = parts.slice(2).join("_");
    const dateParts = datesPart.split("_");
    const startDate = dateParts[0]; // e.g. "2026-04-20"
    const endDate = dateParts.length > 1 ? dateParts[1] : startDate;
    const isRangeBooking = startDate !== endDate;

    if (!action || !poolId || !startDate) {
      await answerCallback(botToken, callbackQuery.id, "❌ Dados inválidos");
      return Response.json({ ok: true });
    }

    const supabase = createAdminClient();

    if (action === "confirm") {
      // Update booking status to confirmed
      const { data: bookings, error: updateError } = await supabase
        .from("bookings")
        .update({ status: "confirmed" })
        .eq("pool_id", poolId)
        .eq("start_date", startDate)
        .eq("end_date", endDate)
        .eq("status", "negotiating")
        .select("guest_name, arrival_time, booking_mode, total_days")
        .limit(1);

      if (updateError) {
        console.error("Error confirming booking:", updateError);
        await answerCallback(
          botToken,
          callbackQuery.id,
          "❌ Erro ao confirmar"
        );
        return Response.json({ ok: true });
      }

      const booking = bookings?.[0];

      // Fetch pool private info to share with owner
      const { data: pool } = await supabase
        .from("pools")
        .select("exact_address, key_lockbox_instructions")
        .eq("id", poolId)
        .single();

      // Answer callback
      await answerCallback(
        botToken,
        callbackQuery.id,
        "✅ Reserva confirmada e bloqueada!"
      );

      // Update the original message to remove buttons
      const dateLabel = isRangeBooking
        ? `${startDate} → ${endDate} (${booking?.total_days ?? "?"} dias)`
        : startDate;

      const confirmMsg =
        `✅ *Reserva Confirmada!*\n\n` +
        `📅 ${isRangeBooking ? "Período" : "Data"}: *${dateLabel}*\n\n` +
        (booking
          ? `👤 Hóspede: *${booking.guest_name}*\n` +
            `⏰ Chegada: *${booking.arrival_time}*\n\n`
          : "") +
        `📋 *Copie e encaminhe ao hóspede no WhatsApp:*\n\n` +
        `Endereço: ${pool?.exact_address ?? "Não informado"}\n` +
        `Instruções: ${pool?.key_lockbox_instructions ?? "Não informado"}`;

      await editMessage(botToken, chatId, messageId, confirmMsg);
    } else if (action === "reject") {
      // Update booking status to cancelled (frees the date)
      const { error: updateError } = await supabase
        .from("bookings")
        .update({ status: "cancelled" })
        .eq("pool_id", poolId)
        .eq("start_date", startDate)
        .eq("end_date", endDate)
        .eq("status", "negotiating");

      if (updateError) {
        console.error("Error rejecting booking:", updateError);
        await answerCallback(
          botToken,
          callbackQuery.id,
          "❌ Erro ao rejeitar"
        );
        return Response.json({ ok: true });
      }

      const dateLabel = isRangeBooking
        ? `${startDate} → ${endDate}`
        : startDate;

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
        `❌ *Reserva Rejeitada*\n\nA ${isRangeBooking ? "período" : "data"} *${dateLabel}* foi liberada.`
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
  await fetch(
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
}

// Helper: Edit original message (removes inline keyboard)
async function editMessage(
  botToken: string,
  chatId: number,
  messageId: number,
  text: string
) {
  await fetch(
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
}
