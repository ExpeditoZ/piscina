import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Cleanup Stale Negotiations Cron Job
 * Backup for pg_cron — cancels 'negotiating' bookings older than 2 hours
 * to prevent calendar lockups by abandoned sessions.
 *
 * Runs every 15 minutes via Vercel Cron.
 */
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();

    // Calculate 2 hours ago
    const twoHoursAgo = new Date();
    twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);
    const cutoffTime = twoHoursAgo.toISOString();

    // Cancel stale negotiations
    const { data, error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("status", "negotiating")
      .lt("created_at", cutoffTime)
      .select("id");

    if (error) {
      console.error("Error cleaning up negotiations:", error);
      return Response.json({ error: "Cleanup failed" }, { status: 500 });
    }

    const cancelledCount = data?.length ?? 0;

    return Response.json({
      ok: true,
      cancelledCount,
      cutoffTime,
    });
  } catch (error) {
    console.error("Cron cleanup error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
