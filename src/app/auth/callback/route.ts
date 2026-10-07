import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authCallbackUrl } from "@/lib/auth/urls";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next");
  const callbackUrl = (path: string | null) => authCallbackUrl(
    path,
    request.url,
    process.env.RENDER_EXTERNAL_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
  );

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(callbackUrl(next));
    }
  }

  return NextResponse.redirect(
    callbackUrl(
      "/login?error=That%20sign-in%20or%20recovery%20link%20is%20invalid%20or%20expired.",
    ),
  );
}
