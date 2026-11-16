import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Activity, FileText, Users, Wallet } from "lucide-react";
import { formatDateTimePkt, formatPkr } from "@paktenders/shared-utils";
import { Alert, StatTile } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { apiFetchAuthed } from "@/lib/server-api";
import type { AdminOverview } from "@/lib/admin-types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin overview",
  robots: { index: false, follow: false },
};

export default async function AdminOverviewPage() {
  const overview = await apiFetchAuthed<AdminOverview | null>("/v1/admin/overview", null);

  if (!overview) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">Overview</h1>
        <Alert tone="error">
          The overview could not be loaded. Check that the API is running and that your account has
          the <code>audit.read</code> permission.
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900">Platform overview</h1>
          <p className="mt-1 text-sm text-ink-500">
            Live figures from the database · generated {formatDateTimePkt(overview.generatedAt)} PKT
          </p>
        </div>
        <Link href="/admin/tenders/new" className="btn-primary">
          Create tender
        </Link>
      </div>

      {overview.tenders.demoRecords > 0 ? (
        <Alert tone="warning" title="Demo data is present">
          {overview.tenders.demoRecords} demo tender record
          {overview.tenders.demoRecords === 1 ? " is" : "s are"} marked with{" "}
          <code>verificationStatus=DEMO</code>. Remove them with{" "}
          <code>pnpm db:purge-demo</code> before launch. They are never counted as real tenders on
          public pages.
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Published / active"
          value={overview.tenders.active}
          hint={`${overview.tenders.total} total records`}
          icon={<FileText className="h-5 w-5" />}
        />
        <StatTile
          label="Closing in 7 days"
          value={overview.tenders.closingSoon}
          hint={`${overview.tenders.closed} closed`}
          icon={<Activity className="h-5 w-5" />}
        />
        <StatTile
          label="Users"
          value={overview.users.total}
          hint={`${overview.users.active} active · ${overview.users.companies} companies`}
          icon={<Users className="h-5 w-5" />}
        />
        <StatTile
          label="Verified revenue"
          value={formatPkr(overview.finance.revenuePkr)}
          hint={`${overview.finance.pendingPayments} payments pending`}
          icon={<Wallet className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Awaiting review" value={overview.tenders.pendingVerification} hint="Draft or pending verification" />
        <StatTile label="Paid subscribers" value={overview.users.paidSubscribers} hint="Active or trial" />
        <StatTile
          label="Refund requests"
          value={overview.finance.refundRequests}
          hint={`${overview.finance.failedPayments} failed payments`}
        />
        <StatTile
          label="Errors (24h)"
          value={overview.system.errors24h}
          hint={`${overview.system.notificationsSent24h} notifications sent`}
        />
      </div>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="text-base font-bold text-navy-900">Recent admin activity</h2>
          <Link href="/admin/audit" className="text-xs font-semibold text-emerald-700 hover:underline">
            Full audit log
          </Link>
        </div>
        {overview.recentActivity.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="table-shell">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Actor</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {overview.recentActivity.map((entry) => (
                  <tr key={entry.id}>
                    <td className="font-medium text-navy-900">{entry.action}</td>
                    <td>
                      <Badge tone="navy">{entry.entityType}</Badge>
                    </td>
                    <td className="text-xs">{entry.actorEmail ?? "—"}</td>
                    <td className="whitespace-nowrap text-xs">{formatDateTimePkt(entry.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 py-6 text-sm text-ink-500">No admin actions recorded yet.</p>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Link href="/admin/tenders" className="card card-hover p-5">
          <FileText className="h-5 w-5 text-emerald-600" />
          <p className="mt-3 text-sm font-semibold text-navy-900">Manage tenders</p>
          <p className="mt-1 text-xs text-ink-500">Create, verify, publish and archive records.</p>
        </Link>
        <Link href="/admin/users" className="card card-hover p-5">
          <Users className="h-5 w-5 text-emerald-600" />
          <p className="mt-3 text-sm font-semibold text-navy-900">Manage users</p>
          <p className="mt-1 text-xs text-ink-500">Search accounts, suspend or reactivate.</p>
        </Link>
        <Link href="/admin/health" className="card card-hover p-5">
          <AlertTriangle className="h-5 w-5 text-emerald-600" />
          <p className="mt-3 text-sm font-semibold text-navy-900">System health</p>
          <p className="mt-1 text-xs text-ink-500">Check database, storage and integrations.</p>
        </Link>
      </section>
    </div>
  );
}
