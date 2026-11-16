"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Bookmark,
  CreditCard,
  LayoutDashboard,
  Search,
  ShieldCheck,
  User,
  BellRing,
} from "lucide-react";
import { cn } from "@paktenders/shared-utils";

const items = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/saved", label: "Saved tenders", icon: Bookmark },
  { href: "/dashboard/searches", label: "Saved searches", icon: Search },
  { href: "/dashboard/alerts", label: "Alert rules", icon: BellRing },
  { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
  { href: "/dashboard/profile", label: "Profile", icon: User },
  { href: "/dashboard/subscription", label: "Subscription", icon: CreditCard },
];

export function DashboardNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Dashboard navigation" className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
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
      {isAdmin ? (
        <Link
          href="/admin"
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-emerald-700 hover:border-emerald-200 hover:bg-emerald-50"
        >
          <ShieldCheck className="h-4 w-4" />
          Admin console
        </Link>
      ) : null}
    </nav>
  );
}
