"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  FileText,
  LayoutDashboard,
  ListChecks,
  Plug,
  Rss,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { cn } from "@paktenders/shared-utils";

const items = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/tenders", label: "Tenders", icon: FileText },
  { href: "/admin/collection", label: "Collection", icon: Rss },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/integrations", label: "Integrations", icon: Plug },
  { href: "/admin/audit", label: "Audit log", icon: ListChecks },
  { href: "/admin/health", label: "System health", icon: Activity },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin navigation" className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
              active
                ? "bg-navy-900 text-white"
                : "text-ink-600 hover:bg-white hover:text-navy-900",
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
      <Link
        href="/dashboard"
        className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-ink-600 hover:border-navy-200 hover:text-navy-900"
      >
        <ShieldCheck className="h-4 w-4" />
        My dashboard
      </Link>
    </nav>
  );
}
