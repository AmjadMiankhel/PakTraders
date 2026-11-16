"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@paktenders/shared-utils";

const items = [
  { href: "/admin/collection", label: "Overview", exact: true },
  { href: "/admin/collection/sources", label: "Sources" },
  { href: "/admin/collection/runs", label: "Runs" },
  { href: "/admin/collection/review", label: "Review queue" },
  { href: "/admin/collection/duplicates", label: "Duplicates" },
  { href: "/admin/collection/import", label: "Manual import" },
  { href: "/admin/collection/jobs", label: "Queue & errors" },
];

export function CollectionNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Collection navigation"
      className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-white p-1.5"
    >
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition",
              active ? "bg-navy-900 text-white" : "text-ink-600 hover:bg-surface hover:text-navy-900",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
