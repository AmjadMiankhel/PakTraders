import type { ReactNode } from "react";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { AuthRequired } from "@/components/auth/auth-gate";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { initials } from "@paktenders/shared-utils";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) return <AuthRequired next="/dashboard" />;

  return (
    <div className="min-h-[70vh] bg-surface">
      <div className="container-page py-8">
        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="mb-4 flex items-center gap-3 rounded-2xl border border-line bg-white p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy-900 text-sm font-bold text-white">
                {initials(user.fullName)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-navy-900">{user.fullName}</p>
                <p className="truncate text-xs text-ink-500">{user.email}</p>
              </div>
            </div>
            <DashboardNav isAdmin={isAdmin(user)} />
          </aside>
          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
