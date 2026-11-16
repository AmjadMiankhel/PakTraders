import type { Metadata } from "next";
import { formatDateTimePkt } from "@paktenders/shared-utils";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Pagination } from "@/components/ui/states";
import { apiFetchAuthed } from "@/lib/server-api";
import type { AdminAuditResponse } from "@/lib/admin-types";
import { firstValue, parsePositiveInt, type RawSearchParams } from "@/lib/search-params";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Audit log",
  robots: { index: false, follow: false },
};

const empty: AdminAuditResponse = {
  items: [],
  meta: { page: 1, pageSize: 30, total: 0, totalPages: 1 },
};

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const page = parsePositiveInt(firstValue(params.page), 1);
  const data = await apiFetchAuthed<AdminAuditResponse>(
    `/v1/admin/audit-logs?page=${page}&pageSize=30`,
    empty,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">Audit log</h1>
        <p className="mt-1 text-sm text-ink-500">
          {data.meta.total.toLocaleString("en-PK")} recorded admin action
          {data.meta.total === 1 ? "" : "s"}. Entries are append-only.
        </p>
      </div>

      {data.items.length > 0 ? (
        <>
          <div className="card overflow-x-auto">
            <table className="table-shell">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Actor</th>
                  <th>When</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((entry) => (
                  <tr key={entry.id}>
                    <td className="font-medium text-navy-900">{entry.action}</td>
                    <td>
                      <Badge tone="navy">{entry.entityType}</Badge>
                      {entry.entityId ? (
                        <p className="mt-1 max-w-40 truncate text-[11px] text-ink-500">{entry.entityId}</p>
                      ) : null}
                    </td>
                    <td className="text-xs">{entry.actorEmail ?? "—"}</td>
                    <td className="whitespace-nowrap text-xs">{formatDateTimePkt(entry.createdAt)}</td>
                    <td>
                      {entry.before || entry.after ? (
                        <details className="text-xs">
                          <summary className="cursor-pointer font-medium text-emerald-700">
                            View
                          </summary>
                          <pre className="mt-2 max-w-xs overflow-x-auto rounded bg-surface p-2 text-[10px] leading-4 text-ink-600">
                            {JSON.stringify({ before: entry.before, after: entry.after }, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        <span className="text-xs text-ink-500">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={data.meta} basePath="/admin/audit" />
        </>
      ) : (
        <EmptyState title="No audit entries yet" description="Admin actions will appear here." />
      )}
    </div>
  );
}
