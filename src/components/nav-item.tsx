"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type NavItemProps = {
  href: string;
  label: string;
  icon: ReactNode;
  mobile?: boolean;
};

export function NavItem({
  href,
  label,
  icon,
  mobile = false,
}: NavItemProps) {
  const pathname = usePathname();
  const active =
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center rounded-lg text-sm transition",
        mobile
          ? "min-w-0 flex-1 flex-col justify-center gap-1 px-1 py-2 text-[10px]"
          : "gap-2.5 px-3 py-2",
        active
          ? "bg-[var(--surface-subtle)] font-medium text-[var(--text)]"
          : "text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text)]",
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </Link>
  );
}
