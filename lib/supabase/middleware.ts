import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session if expired - important for Server Components
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect /host/dashboard routes — redirect to login if not authenticated
  if (
    !user &&
    (request.nextUrl.pathname.startsWith("/host/dashboard") ||
      request.nextUrl.pathname.startsWith("/host/billing"))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/host/login";
    return NextResponse.redirect(url);
  }

  // Protect /host/reset-password — requires active session from auth callback
  if (
    !user &&
    request.nextUrl.pathname.startsWith("/host/reset-password")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/host/forgot-password";
    return NextResponse.redirect(url);
  }

  // If authenticated user visits /host/login or /host/signup, redirect to dashboard
  if (
    user &&
    (request.nextUrl.pathname === "/host/login" ||
      request.nextUrl.pathname === "/host/signup")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/host/dashboard";
    return NextResponse.redirect(url);
  }

  // Legacy /admin redirect → /host/dashboard
  if (request.nextUrl.pathname.startsWith("/admin")) {
    const url = request.nextUrl.clone();
    if (request.nextUrl.pathname === "/admin/login") {
      url.pathname = "/host/login";
    } else {
      url.pathname = "/host/dashboard";
    }
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
