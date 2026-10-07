import {
  BriefcaseBusiness,
  CircleUserRound,
  ContactRound,
  Gavel,
  Inbox,
  MessageSquarePlus,
  House,
  ListTodo,
  BookOpen,
} from "lucide-react";
import { signOut } from "@/app/actions/auth";
import type { CurrentProfile } from "@/lib/auth/current-user";
import { NavItem } from "@/components/nav-item";

const nav = [
  { href: "/", label: "Home", icon: House },
  { href: "/work", label: "Work", icon: ListTodo },
  { href: "/crm", label: "CRM", icon: ContactRound },
  { href: "/projects", label: "Projects", icon: BriefcaseBusiness },
  { href: "/decisions", label: "Decisions", icon: Gavel },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/requests", label: "Requests", icon: MessageSquarePlus },
  { href: "/library", label: "Library", icon: BookOpen },
];

type AppShellProps = {
  profile: CurrentProfile;
  email: string;
  children: React.ReactNode;
};

export function AppShell({ profile, email, children }: AppShellProps) {
  const name = profile.display_name || email.split("@")[0];

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-[var(--border)] bg-[var(--surface)] p-4 md:flex md:flex-col">
        <div className="mb-7 flex items-center gap-3 px-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-[var(--text)] text-xs font-semibold text-white">
            KP
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight">KP Duty</p>
            <p className="text-[11px] text-[var(--muted)]">Operating system</p>
          </div>
        </div>

        <nav className="space-y-1">
          {nav.map((item) => (
            <NavItem key={item.href} href={item.href} label={item.label} icon={<item.icon size={17} strokeWidth={1.8} />} />
          ))}
        </nav>

        <div className="mt-auto border-t border-[var(--border)] pt-4">
          <div className="mb-3 flex items-center gap-2.5 px-2">
            <CircleUserRound size={18} className="text-[var(--muted)]" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{name}</p>
              <p className="truncate text-[11px] capitalize text-[var(--muted)]">
                {profile.role.replace("_", " ")}
              </p>
            </div>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="w-full rounded-lg px-3 py-2 text-left text-xs text-[var(--muted)] transition hover:bg-[var(--surface-subtle)] hover:text-[var(--text)]"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="pb-20 md:ml-60 md:pb-0">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[var(--border)] bg-[var(--background)]/95 px-5 backdrop-blur md:hidden">
          <span className="text-sm font-semibold">KP Duty</span>
          <span className="max-w-40 truncate text-xs text-[var(--muted)]">
            {name}
          </span>
        </header>

        <main className="mx-auto w-full max-w-6xl px-5 py-7 md:px-8 md:py-9">
          {children}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 overflow-x-auto border-t border-[var(--border)] bg-[var(--surface)]/95 px-1 backdrop-blur md:hidden">
        {nav.map((item) => (
          <NavItem key={item.href} href={item.href} label={item.label} icon={<item.icon size={18} strokeWidth={1.8} />} mobile />
        ))}
      </nav>
    </div>
  );
}
