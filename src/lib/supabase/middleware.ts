import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Avoid crashing middleware invocation when environment variables are missing.
    if (!supabaseUrl || !supabaseAnonKey) {
      return supabaseResponse;
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const isAuthRoute =
      request.nextUrl.pathname.startsWith("/login") ||
      request.nextUrl.pathname.startsWith("/register");

    const isDashboardRoute = request.nextUrl.pathname.startsWith("/dashboard");
    const isSetupRoute = request.nextUrl.pathname === "/dashboard/setup";

    // Redirect unauthenticated users to login
    if (!user && isDashboardRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    // Redirect authenticated users away from auth pages
    if (user && isAuthRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard/overview";
      return NextResponse.redirect(url);
    }

    // Check onboarding status for authenticated dashboard users (except setup page itself)
    if (user && isDashboardRoute && !isSetupRoute) {
      const { data: userData } = await supabase
        .from("users")
        .select("tenant_id")
        .eq("auth_id", user.id)
        .single();

      if (userData) {
        const { data: tenantData } = await supabase
          .from("tenants")
          .select("onboarding_completed_at")
          .eq("id", userData.tenant_id)
          .single();

        if (tenantData && !tenantData.onboarding_completed_at) {
          const url = request.nextUrl.clone();
          url.pathname = "/dashboard/setup";
          return NextResponse.redirect(url);
        }
      }
    }

    return supabaseResponse;
  } catch (error) {
    console.error("[middleware] updateSession failed", error);
    // Never block rendering because of middleware runtime failures.
    return NextResponse.next({ request });
  }
}
