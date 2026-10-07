"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const emailSchema = z.string().email();

function authErrorMessage(error: { code?: string; status?: number; message?: string }) {
  if (
    error.code === "over_email_send_rate_limit" ||
    error.status === 429
  ) {
    return "Email sending is temporarily rate-limited by Supabase. Please wait a little while and try again.";
  }

  if (
    error.code === "user_not_found" ||
    error.code === "otp_disabled"
  ) {
    return "That email is not authorized for KP Duty.";
  }

  return "We could not send the sign-in link. Please try again shortly.";
}

export async function requestMagicLink(formData: FormData) {
  const parsed = emailSchema.safeParse(formData.get("email"));

  if (!parsed.success) {
    redirect("/login?error=Enter%20a%20valid%20email%20address.");
  }

  const supabase = await createClient();
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  });

  if (error) {
    redirect(
      `/login?error=${encodeURIComponent(authErrorMessage(error))}`,
    );
  }

  redirect("/login?sent=1");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
