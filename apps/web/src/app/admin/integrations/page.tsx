import type { Metadata } from "next";
import { formatDateTimePkt } from "@paktenders/shared-utils";
import { Alert } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { IntegrationStatusBadge } from "@/components/admin/status-badge";
import { apiFetchAuthed } from "@/lib/server-api";
import type { AdminIntegration } from "@/lib/admin-types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Integrations",
  robots: { index: false, follow: false },
};

export default async function AdminIntegrationsPage() {
  const integrations = await apiFetchAuthed<AdminIntegration[]>("/v1/admin/integrations", []);

  const configured = integrations.filter((item) => item.status !== "NOT_CONFIGURED").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">Integrations</h1>
        <p className="mt-1 text-sm text-ink-500">
          {configured} of {integrations.length} integrations configured. Credentials are never
          returned by the API; only a flag shows whether configuration exists.
        </p>
      </div>

      <Alert tone="info">
        Integrations marked <strong>Not configured</strong> are intentionally disabled. The platform
        remains fully usable without them; features that depend on a provider (email, push, AI,
        payments, object storage) stay off until credentials are supplied through environment
        variables.
      </Alert>

      {integrations.length > 0 ? (
        <div className="card overflow-x-auto">
          <table className="table-shell">
            <thead>
              <tr>
                <th>Integration</th>
                <th>Category</th>
                <th>Status</th>
                <th>Configuration</th>
                <th>Last checked</th>
              </tr>
            </thead>
            <tbody>
              {integrations.map((item) => (
                <tr key={item.key}>
                  <td>
                    <p className="font-semibold text-navy-900">{item.name}</p>
                    <code className="text-[11px] text-ink-500">{item.key}</code>
                    {item.lastError ? (
                      <p className="mt-1 text-[11px] text-red-600">{item.lastError}</p>
                    ) : null}
                  </td>
                  <td>
                    <Badge tone="navy">{item.category.replaceAll("_", " ").toLowerCase()}</Badge>
                  </td>
                  <td>
                    <IntegrationStatusBadge status={item.status} />
                  </td>
                  <td className="text-xs">
                    {item.hasConfiguration ? "Credentials present" : "No credentials"}
                  </td>
                  <td className="whitespace-nowrap text-xs">
                    {item.lastCheckedAt ? formatDateTimePkt(item.lastCheckedAt) : "Never"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-ink-500">No integrations were returned by the API.</p>
      )}
    </div>
  );
}
