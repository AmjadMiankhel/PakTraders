import type { Metadata } from "next";
import { formatDateTimePkt } from "@paktenders/shared-utils";
import { Alert } from "@/components/ui/feedback";
import { IntegrationStatusBadge } from "@/components/admin/status-badge";
import { apiFetchAuthed } from "@/lib/server-api";
import type { AdminHealth } from "@/lib/admin-types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "System health",
  robots: { index: false, follow: false },
};

const labels: Record<keyof Omit<AdminHealth, "payments" | "integrations" | "timestamp">, string> = {
  api: "API",
  database: "PostgreSQL",
  redis: "Redis / queues",
  email: "Email delivery",
  ai: "AI assistant",
  storage: "Object storage",
  push: "Push notifications",
};

export default async function AdminHealthPage() {
  const health = await apiFetchAuthed<AdminHealth | null>("/v1/admin/health", null);

  if (!health) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">System health</h1>
        <Alert tone="error">
          Health data could not be loaded. The API may be unreachable, or your account may lack the{" "}
          <code>system.health</code> permission.
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">System health</h1>
        <p className="mt-1 text-sm text-ink-500">
          Checked {formatDateTimePkt(health.timestamp)} PKT · API uptime{" "}
          {Math.floor(health.api.uptimeSeconds / 60)} minutes
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(Object.keys(labels) as Array<keyof typeof labels>).map((key) => {
          const item = health[key];
          return (
            <div key={key} className="card p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-bold text-navy-900">{labels[key]}</h2>
                <IntegrationStatusBadge status={item.status} />
              </div>
              {key === "api" ? (
                <p className="mt-2 text-xs text-ink-500">
                  Uptime {Math.floor(health.api.uptimeSeconds / 3600)}h{" "}
                  {Math.floor((health.api.uptimeSeconds % 3600) / 60)}m
                </p>
              ) : null}
              {key === "database" && item.status !== "connected" ? (
                <p className="mt-2 text-xs text-red-600">
                  The database is unreachable. Public pages will show fallbacks until it recovers.
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      <section className="card p-5">
        <h2 className="text-base font-bold text-navy-900">Payment providers</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {(
            [
              ["JazzCash", health.payments.jazzcash],
              ["Easypaisa", health.payments.easypaisa],
              ["Card payments", health.payments.card],
            ] as const
          ).map(([name, status]) => (
            <div key={name} className="rounded-xl border border-line p-4">
              <p className="text-sm font-semibold text-navy-900">{name}</p>
              <div className="mt-2">
                <IntegrationStatusBadge status={status} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-base font-bold text-navy-900">Integration registry</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="table-shell">
            <thead>
              <tr>
                <th>Key</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {health.integrations.map((integration) => (
                <tr key={integration.key}>
                  <td>
                    <code className="text-xs">{integration.key}</code>
                  </td>
                  <td>
                    <IntegrationStatusBadge status={integration.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
