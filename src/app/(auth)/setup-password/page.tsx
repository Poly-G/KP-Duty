import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PasswordSetupForm } from "./password-setup-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Set your KP Duty password", referrer: "no-referrer" };

export default function PasswordSetupPage() {
  const expiresAt = Date.parse(process.env.KP_PASSWORD_SETUP_EXPIRES_AT ?? "");
  // This dynamic server page must enforce the deadline on every request.
  // eslint-disable-next-line react-hooks/purity
  if (process.env.KP_PASSWORD_SETUP_ENABLED !== "true" || !Number.isFinite(expiresAt) || Date.now() >= expiresAt) {
    notFound();
  }

  return (
    <main className="grid min-h-screen place-items-center px-5 py-12">
      <section className="w-full max-w-sm">
        <div className="mb-5 flex size-10 items-center justify-center rounded-xl bg-[var(--text)] text-sm font-semibold text-white">KP</div>
        <h1 className="text-2xl font-semibold tracking-tight">Set your KP Duty password</h1>
        <p className="mt-2 mb-6 text-sm leading-6 text-[var(--muted)]">Choose a password for your existing account. Enter it only here, never in chat.</p>
        <PasswordSetupForm expiresAt={expiresAt} />
      </section>
    </main>
  );
}
