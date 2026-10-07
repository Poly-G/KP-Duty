"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { createClient } from "@supabase/supabase-js";
import { passwordSetup } from "@/lib/auth/password-setup";

export function PasswordSetupForm({ expiresAt }: { expiresAt: number }) {
  const save = useRef<ReturnType<typeof passwordSetup> | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (save.current) return;
    const token = new URLSearchParams(window.location.hash.slice(1)).get("token_hash") ?? "";
    // Fragments never reach Render access logs; immediately remove from history.
    window.history.replaceState(null, "", window.location.pathname);
    if (!token) return;
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "kp-temporary-password-setup" } },
    );
    save.current = passwordSetup(client.auth, token, expiresAt);
    // The fragment is browser-only external state; enable the form after capturing it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(true);
  }, [expiresAt]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !save.current) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setMessage("");
    const error = await save.current(String(values.get("password") ?? ""), String(values.get("confirmation") ?? ""));
    form.reset();
    if (error) {
      setMessage(error);
      setBusy(false);
      return;
    }
    setSaved(true);
    window.location.replace("/login");
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <noscript>Enable JavaScript to securely set your password.</noscript>
      {saved ? <p role="status">Password saved. Returning to sign in…</p> : (
        <form onSubmit={submit} className="space-y-4">
          {!ready ? <p className="text-sm">Open your complete one-time setup link to continue. Used or expired links cannot be reused.</p> : null}
          {message ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{message}</p> : null}
          <label className="block text-sm font-medium">New password
            <input required minLength={8} maxLength={128} type="password" name="password" autoComplete="new-password" disabled={!ready || busy} className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3" />
          </label>
          <label className="block text-sm font-medium">Confirm new password
            <input required minLength={8} maxLength={128} type="password" name="confirmation" autoComplete="new-password" disabled={!ready || busy} className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3" />
          </label>
          <p className="text-xs text-[var(--muted)]">Use at least 8 characters. Keep this tab open until your password is saved.</p>
          <button disabled={!ready || busy} className="h-11 w-full rounded-xl bg-[var(--accent)] text-sm font-medium text-[var(--accent-foreground)] disabled:opacity-50">{busy ? "Saving…" : "Save password"}</button>
        </form>
      )}
      <a href="/login" className="mt-4 inline-block text-sm underline">Go to sign in</a>
    </div>
  );
}
