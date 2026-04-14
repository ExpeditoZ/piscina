import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /auth/callback
 *
 * Handles Supabase auth redirects for:
 * - Email confirmation after signup
 * - Password reset link clicked from email
 *
 * Exchanges the auth code for a session, then redirects
 * to the appropriate page based on the flow type.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/host/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // If the 'next' param points to reset-password, go there
      if (next.includes("reset-password")) {
        return NextResponse.redirect(`${origin}/host/reset-password`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Auth code exchange failed — redirect to login with error
  return NextResponse.redirect(
    `${origin}/host/login?error=auth_callback_failed`
  );
}
