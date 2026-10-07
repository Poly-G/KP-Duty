import type { SupabaseClient } from "@supabase/supabase-js";

// One isolated, memory-only client per tab. Supabase atomically consumes the
// recovery token; no admin password API, database writes or custom auth bypass.
export function passwordSetup(auth: SupabaseClient["auth"], initialToken: string, expiresAt: number) {
  let token = initialToken;
  let verified = false;
  let finished = false;
  let busy = false;
  return async (password: string, confirmation: string): Promise<string | null> => {
    if (busy) return "A save is already in progress.";
    if (finished) return "This setup link has already been used.";
    if (Date.now() >= expiresAt) return "This setup page has expired.";
    if (password.length < 8) return "Use at least 8 characters.";
    if (password.length > 128) return "Use no more than 128 characters.";
    if (password !== confirmation) return "Passwords do not match.";
    if (!verified && !token) return "Open your complete one-time setup link.";
    busy = true;
    try {
      if (!verified) {
        const { data, error } = await auth.verifyOtp({ token_hash: token, type: "recovery" });
        if (error || !data.session) return "This setup link is invalid, expired, or already used. Request a new link.";
        verified = true;
        token = "";
      }
      const { error } = await auth.updateUser({ password });
      if (error) return "Could not save this password. Try a different password in this tab. If it still fails, request a new setup link.";
      finished = true;
      // A cleanup failure must not make a successful password change look failed.
      try { await auth.signOut({ scope: "local" }); } catch { /* Memory is discarded on navigation. */ }
      return null;
    } catch {
      return "Could not reach the password service. Try again in this tab. If the link was consumed, request a new link.";
    } finally {
      busy = false;
    }
  };
}
