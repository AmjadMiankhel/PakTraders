import type { ReactNode } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { AccessDenied, AuthRequired } from "@/components/auth/auth-gate";
import { AdminNav } from "@/components/admin/admin-nav";
import { initials } from "@paktenders/shared-utils";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) return <AuthRequired next="/admin" />;
  if (!isAdmin(user)) return <AccessDenied />;

  return (
    <div className="min-h-[70vh] bg-surface">
      <div className="container-page py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-900 text-white">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-navy-900">Super Admin Control Center</p>
              <p className="text-xs text-ink-500">
                Signed in as {user.email} · actions are audited
              </p>
            </div>
          </div>
          <Link href="/dashboard" className="btn-secondary px-3 py-1.5 text-xs">
            Exit to dashboard
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="mb-4 flex items-center gap-3 rounded-2xl border border-line bg-white p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-sm font-bold text-white">
                {initials(user.fullName)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-navy-900">{user.fullName}</p>
                <p className="truncate text-xs text-ink-500">{user.roles[0]?.replaceAll("_", " ") ?? "Staff"}</p>
              </div>
            </div>
            <AdminNav />
          </aside>
          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
