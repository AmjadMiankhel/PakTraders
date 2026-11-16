"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Phone,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import type { AuthUser } from "@paktenders/shared-types";
import { cn, initials } from "@paktenders/shared-utils";
import { Logo } from "@/components/brand/logo";
import { mainNav } from "@/lib/site";

export function SiteHeader({
  user,
  supportEmail,
  supportPhone,
  announcement,
}: {
  user: AuthUser | null;
  supportEmail: string;
  supportPhone: string;
  announcement: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const isAdmin = Boolean(
    user?.roles.some((role) =>
      ["SUPER_ADMIN", "ADMIN", "TENDER_MANAGER", "VERIFICATION_OFFICER", "CONTENT_MANAGER", "SEO_MANAGER"].includes(role),
    ),
  );

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    setMenuOpen(false);
    router.push("/");
    router.refresh();
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <div className="hidden bg-navy-950 text-white/70 sm:block">
        <div className="container-page flex h-9 items-center justify-between text-[11px]">
          <div className="flex items-center gap-5">
            <a href={`mailto:${supportEmail}`} className="inline-flex items-center gap-1.5 hover:text-white">
              <Mail className="h-3.5 w-3.5" /> {supportEmail}
            </a>
            <a href={`tel:${supportPhone.replace(/\s+/g, "")}`} className="inline-flex items-center gap-1.5 hover:text-white">
              <Phone className="h-3.5 w-3.5" /> {supportPhone}
            </a>
          </div>
          <p className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            Pakistan procurement intelligence · Asia/Karachi (PKT)
          </p>
        </div>
      </div>

      {announcement ? (
        <div className="bg-emerald-700 px-4 py-2 text-center text-xs font-medium text-white">
          {announcement}
        </div>
      ) : null}

      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <Logo />

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main navigation">
            {mainNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition",
                  isActive(item.href)
                    ? "bg-navy-50 text-navy-900"
                    : "text-ink-600 hover:bg-slate-50 hover:text-navy-900",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            {user ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((open) => !open)}
                  className="flex items-center gap-2 rounded-full border border-line bg-white py-1 pl-1 pr-3 text-sm font-medium text-ink-700 hover:border-navy-200"
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-900 text-xs font-bold text-white">
                    {initials(user.fullName)}
                  </span>
                  <span className="max-w-32 truncate">{user.fullName.split(" ")[0]}</span>
                  <ChevronDown className="h-4 w-4 text-ink-500" />
                </button>
                {menuOpen ? (
                  <div
                    className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-lifted"
                    role="menu"
                  >
                    <div className="border-b border-line px-4 py-2.5">
                      <p className="truncate text-sm font-semibold text-navy-900">{user.fullName}</p>
                      <p className="truncate text-xs text-ink-500">{user.email}</p>
                    </div>
                    <Link href="/dashboard" className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-surface" role="menuitem">
                      <LayoutDashboard className="h-4 w-4" /> Dashboard
                    </Link>
                    <Link href="/dashboard/profile" className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-surface" role="menuitem">
                      <User className="h-4 w-4" /> Profile
                    </Link>
                    {isAdmin ? (
                      <Link href="/admin" className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-surface" role="menuitem">
                        <ShieldCheck className="h-4 w-4" /> Admin console
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      onClick={signOut}
                      className="flex w-full items-center gap-2 border-t border-line px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                      role="menuitem"
                    >
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <>
                <Link href="/login" className="btn-ghost px-3 py-2 text-sm">
                  Sign in
                </Link>
                <Link href="/register" className="btn-primary px-4 py-2 text-sm">
                  Create account
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-line text-ink-700 lg:hidden"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileOpen ? (
          <div className="border-t border-line bg-white lg:hidden">
            <nav className="container-page flex flex-col py-3" aria-label="Mobile navigation">
              {mainNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "rounded-lg px-3 py-2.5 text-sm font-medium",
                    isActive(item.href) ? "bg-navy-50 text-navy-900" : "text-ink-700 hover:bg-surface",
                  )}
                >
                  {item.label}
                </Link>
              ))}
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3">
                {user ? (
                  <>
                    <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="btn-secondary">
                      Dashboard
                    </Link>
                    <button type="button" onClick={signOut} className="btn-danger">
                      Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <Link href="/login" onClick={() => setMobileOpen(false)} className="btn-secondary">
                      Sign in
                    </Link>
                    <Link href="/register" onClick={() => setMobileOpen(false)} className="btn-primary">
                      Get started
                    </Link>
                  </>
                )}
              </div>
            </nav>
          </div>
        ) : null}
      </header>
    </>
  );
}
