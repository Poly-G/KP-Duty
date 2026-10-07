import { updatePassword } from "@/app/actions/auth";

type PasswordPageProps = {
  searchParams: Promise<{
    updated?: string;
    error?: string;
  }>;
};

export default async function PasswordPage({
  searchParams,
}: PasswordPageProps) {
  const params = await searchParams;

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Password</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          Set the password you will use to sign in to KP Duty.
        </p>
      </div>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
        {params.updated ? (
          <div className="mb-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Password updated.
          </div>
        ) : null}

        {params.error ? (
          <div className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
            {params.error}
          </div>
        ) : null}

        <form action={updatePassword} className="space-y-4">
          <label className="block text-xs font-medium text-[var(--muted-strong)]">
            New password
            <input
              required
              minLength={8}
              type="password"
              name="password"
              autoComplete="new-password"
              className="mt-1.5 h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3.5 text-sm outline-none transition focus:border-[var(--focus)] focus:ring-2 focus:ring-orange-100"
            />
          </label>

          <label className="block text-xs font-medium text-[var(--muted-strong)]">
            Confirm new password
            <input
              required
              minLength={8}
              type="password"
              name="confirm_password"
              autoComplete="new-password"
              className="mt-1.5 h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3.5 text-sm outline-none transition focus:border-[var(--focus)] focus:ring-2 focus:ring-orange-100"
            />
          </label>

          <button
            type="submit"
            className="h-11 rounded-xl bg-[var(--accent)] px-5 text-sm font-medium text-[var(--accent-foreground)] transition hover:opacity-90"
          >
            Save password
          </button>
        </form>
      </section>
    </div>
  );
}
