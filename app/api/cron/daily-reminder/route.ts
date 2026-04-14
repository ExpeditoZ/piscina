import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Daily Reminder Cron Job
 * Runs every day at 21:00 UTC (18:00 BRT) via Vercel Cron.
 *
 * Finds all confirmed bookings for TOMORROW and sends a
 * reminder to the pool owner via Telegram.
 */
export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
      return Response.json({ error: "TELEGRAM_BOT_TOKEN not set" }, { status: 500 });
    }

    // Fetch confirmed bookings for tomorrow
    // Using Supabase's SQL capabilities via RPC or direct query
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0]; // YYYY-MM-DD

    const { data: bookings, error } = await supabase
      .from("bookings")
      .select(`
        id,
        guest_name,
        arrival_time,
        booking_date,
        shift_selected,
        total_price,
        pool_id
      `)
      .eq("booking_date", tomorrowStr)
      .eq("status", "confirmed");

    if (error) {
      console.error("Error fetching bookings:", error);
      return Response.json({ error: "Query failed" }, { status: 500 });
    }

    if (!bookings || bookings.length === 0) {
      return Response.json({
        ok: true,
        message: "No bookings for tomorrow",
        date: tomorrowStr,
      });
    }

    // Get unique pool IDs and fetch their telegram_chat_ids
    const poolIds = [...new Set(bookings.map((b) => b.pool_id))];

    const { data: pools, error: poolError } = await supabase
      .from("pools")
      .select("id, title, telegram_chat_id")
      .in("id", poolIds);

    if (poolError) {
      console.error("Error fetching pools:", poolError);
      return Response.json({ error: "Pool query failed" }, { status: 500 });
    }

    const poolMap = new Map(
      pools?.map((p) => [p.id, p]) ?? []
    );

    // Send reminders
    let sentCount = 0;

    for (const booking of bookings) {
      const pool = poolMap.get(booking.pool_id);
      if (!pool?.telegram_chat_id) continue;

      const shiftText = booking.shift_selected
        ? `\n⏰ Turno: *${booking.shift_selected}*`
        : "";

      const message =
        `⏰ *Lembrete: Aluguel amanhã!*\n\n` +
        `📍 Piscina: *${pool.title}*\n` +
        `👤 Hóspede: *${booking.guest_name}*\n` +
        `🕐 Chegada: *${booking.arrival_time}*${shiftText}\n` +
        `💰 Valor: *R$ ${booking.total_price}*\n\n` +
        `📋 Por favor, certifique-se de que a piscina está limpa e o cofre está pronto para a chegada do hóspede.`;

      try {
        await fetch(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: pool.telegram_chat_id,
              text: message,
              parse_mode: "Markdown",
            }),
          }
        );
        sentCount++;
      } catch (err) {
        console.error(
          `Failed to send reminder for booking ${booking.id}:`,
          err
        );
      }
    }

    return Response.json({
      ok: true,
      date: tomorrowStr,
      bookingsFound: bookings.length,
      remindersSent: sentCount,
    });
  } catch (error) {
    console.error("Cron daily-reminder error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
