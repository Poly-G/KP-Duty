import { requestMagicLink } from "@/app/actions/auth";

type LoginPageProps = {
  searchParams: Promise<{
    sent?: string;
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center px-5 py-12">
      <section className="w-full max-w-sm">
        <div className="mb-8">
          <div className="mb-5 flex size-10 items-center justify-center rounded-xl bg-[var(--text)] text-sm font-semibold text-white">
            KP
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">KP Duty</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Shared operations for Poly + Keshia.
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
          <h2 className="text-sm font-medium">Sign in</h2>
          <p className="mt-1 text-sm leading-5 text-[var(--muted)]">
            Use an email address already invited to KP Duty. We will send a
            secure sign-in link.
          </p>

          {params.sent ? (
            <div className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Check your email for the KP Duty sign-in link.
            </div>
          ) : null}

          {params.error ? (
            <div className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
              {params.error}
            </div>
          ) : null}

          <form action={requestMagicLink} className="mt-5 space-y-3">
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
              Send sign-in link
            </button>
          </form>
        </div>

        <p className="mt-4 text-xs leading-5 text-[var(--muted)]">
          KP Duty is invite-only. There is no public account creation.
        </p>
      </section>
    </main>
  );
}
