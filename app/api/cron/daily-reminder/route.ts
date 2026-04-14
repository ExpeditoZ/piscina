import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Daily Reminder Cron Job
 * Runs every day at 21:00 UTC (18:00 BRT) via Vercel Cron.
 *
 * 1. First, cleans up stale negotiations (backup for pg_cron)
 * 2. Then, finds all confirmed bookings for TOMORROW and sends
 *    a reminder to the pool owner via Telegram.
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

    // ===== STEP 1: Cleanup stale negotiations (backup for pg_cron) =====
    const twoHoursAgo = new Date();
    twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);

    const { data: cleanedUp } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("status", "negotiating")
      .lt("created_at", twoHoursAgo.toISOString())
      .select("id");

    const cleanedCount = cleanedUp?.length ?? 0;

    // ===== STEP 2: Send reminders for tomorrow's bookings =====
    if (!botToken) {
      return Response.json({
        ok: true,
        cleanedCount,
        error: "TELEGRAM_BOT_TOKEN not set — skipping reminders",
      });
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

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
      return Response.json({ error: "Query failed", cleanedCount }, { status: 500 });
    }

    if (!bookings || bookings.length === 0) {
      return Response.json({
        ok: true,
        message: "No bookings for tomorrow",
        date: tomorrowStr,
        cleanedCount,
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
      return Response.json({ error: "Pool query failed", cleanedCount }, { status: 500 });
    }

    const poolMap = new Map(pools?.map((p) => [p.id, p]) ?? []);

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
        `📋 Certifique-se de que a piscina está limpa e pronta.`;

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
      cleanedCount,
    });
  } catch (error) {
    console.error("Cron daily-reminder error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
