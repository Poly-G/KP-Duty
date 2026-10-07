import { AppShell } from "@/components/app-shell";
import { KPSiteTools } from "@/components/webmcp/kp-site-tools";
import { requireCurrentIdentity } from "@/lib/auth/current-user";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await requireCurrentIdentity();

  if (!profile) {
    return (
      <main className="grid min-h-screen place-items-center px-5">
        <section className="max-w-md rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold">Account setup pending</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Your KP Duty login is valid, but the team profile has not been
            created yet. Ask the KP Duty admin to verify your profile.
          </p>
        </section>
      </main>
    );
  }

  if (profile.status === "disabled") {
    return (
      <main className="grid min-h-screen place-items-center px-5">
        <section className="max-w-md rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold">Team access inactive</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Your team access is inactive or awaiting admin activation. Contact your KP Duty admin.
          </p>
        </section>
      </main>
    );
  }

  return (
    <AppShell profile={profile} email={user.email ?? "team member"}>
      <KPSiteTools />
      {children}
    </AppShell>
  );
}
