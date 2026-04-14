import { createClient } from "@supabase/supabase-js";

// Admin client with service_role key for server-side operations
// that need to bypass RLS (e.g., cron jobs, telegram webhook updates)
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
