"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/crm/solta", label: "Solta" },
  { href: "/crm/snd", label: "SnD" },
  { href: "/crm/nex", label: "Nex" },
  { href: "/crm/companies", label: "Companies" },
  { href: "/crm/people", label: "People" },
];

export function CrmTabs() {
  const pathname = usePathname();

  return (
    <nav className="mb-7 flex gap-1 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition",
              active
                ? "bg-[var(--surface-subtle)] text-[var(--text)]"
                : "text-[var(--muted)] hover:text-[var(--text)]",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
