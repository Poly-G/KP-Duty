"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const emailSchema = z.string().email();
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
const passwordSchema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters."),
    confirm_password: z.string(),
  })
  .refine((value) => value.password === value.confirm_password, {
    message: "Passwords do not match.",
    path: ["confirm_password"],
  });

function signInErrorMessage(error: {
  code?: string;
  status?: number;
  message?: string;
}) {
  if (
    error.code === "invalid_credentials" ||
    error.code === "user_not_found" ||
    error.status === 400
  ) {
    return "Email or password is incorrect.";
  }

  if (error.status === 429) {
    return "Too many sign-in attempts. Please wait a moment and try again.";
  }

  return "We could not sign you in. Please try again.";
}

function resetErrorMessage(error: {
  code?: string;
  status?: number;
  message?: string;
}) {
  if (
    error.code === "over_email_send_rate_limit" ||
    error.status === 429
  ) {
    return "Password recovery email is temporarily rate-limited. Please wait a little while and try again.";
  }

  return "We could not start password recovery. Please try again shortly.";
}

export async function signInWithPassword(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect("/login?error=Enter%20your%20email%20and%20password.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    redirect(
      `/login?error=${encodeURIComponent(signInErrorMessage(error))}`,
    );
  }

  redirect("/");
}

export async function requestPasswordReset(formData: FormData) {
  const parsed = emailSchema.safeParse(formData.get("email"));

  if (!parsed.success) {
    redirect("/forgot-password?error=Enter%20a%20valid%20email%20address.");
  }

  const supabase = await createClient();
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${siteUrl}/auth/callback?next=/account/password`,
  });

  if (error) {
    redirect(
      `/forgot-password?error=${encodeURIComponent(resetErrorMessage(error))}`,
    );
  }

  redirect("/forgot-password?sent=1");
}

export async function updatePassword(formData: FormData) {
  const parsed = passwordSchema.safeParse({
    password: formData.get("password"),
    confirm_password: formData.get("confirm_password"),
  });

  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? "Enter a valid new password.";
    redirect(`/account/password?error=${encodeURIComponent(message)}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=Sign%20in%20before%20changing%20your%20password.");
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    redirect(
      `/account/password?error=${encodeURIComponent(
        error.message || "We could not update your password.",
      )}`,
    );
  }

  redirect("/account/password?updated=1");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
