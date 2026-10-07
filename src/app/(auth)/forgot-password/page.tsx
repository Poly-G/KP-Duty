import Link from "next/link";
import { requestPasswordReset } from "@/app/actions/auth";

type ForgotPasswordPageProps = {
  searchParams: Promise<{
    sent?: string;
    error?: string;
  }>;
};

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const params = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center px-5 py-12">
      <section className="w-full max-w-sm">
        <div className="mb-8">
          <div className="mb-5 flex size-10 items-center justify-center rounded-xl bg-[var(--text)] text-sm font-semibold text-white">
            KP
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Reset password
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Recovery is only for existing KP Duty accounts.
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
          {params.sent ? (
            <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              If that email belongs to a KP Duty account, check it for the
              password reset link.
            </div>
          ) : (
            <>
              {params.error ? (
                <div className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
                  {params.error}
                </div>
              ) : null}

              <form action={requestPasswordReset} className="space-y-3">
                <label className="block text-xs font-medium text-[var(--muted-strong)]">
                  Email
                  <input
                    required
                    type="email"
                    name="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="mt-1.5 h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3.5 text-sm outline-none transition focus:border-[var(--focus)] focus:ring-2 focus:ring-orange-100"
                  />
                </label>

                <button
                  type="submit"
                  className="h-11 w-full rounded-xl bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-foreground)] transition hover:opacity-90"
                >
                  Send reset link
                </button>
              </form>
            </>
          )}

          <Link
            href="/login"
            className="mt-4 inline-block text-xs font-medium text-[var(--muted-strong)] underline underline-offset-4"
          >
            Back to sign in
          </Link>
        </div>
      </section>
    </main>
  );
}
