import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Pagination } from "@/components/ui/states";
import { Input, Select } from "@/components/ui/field";
import { ActionButton } from "@/components/forms/action-button";
import { CollectionNav } from "@/components/admin/collection-nav";
import { RunStatusBadge, SourceStatusBadge } from "@/components/admin/collection-badges";
import { apiFetchAuthed } from "@/lib/server-api";
import { runCollectionSource } from "@/lib/actions";
import { formatDateTimePkt } from "@paktenders/shared-utils";
import { scheduleLabel } from "@/lib/collection-utils";
import type { CollectionSourcesResponse } from "@/lib/collection-types";
import { firstValue, parsePositiveInt, type RawSearchParams } from "@/lib/search-params";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Collection sources",
  robots: { index: false, follow: false },
};

const empty: CollectionSourcesResponse = {
  items: [],
  meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
};

export default async function CollectionSourcesPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const page = parsePositiveInt(firstValue(params.page), 1);
  const q = firstValue(params.q) ?? "";
  const status = firstValue(params.status) ?? "";
  const enabled = firstValue(params.enabled) ?? "";
  const category = firstValue(params.category) ?? "";

  const query = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (q.trim()) query.set("q", q.trim());
  if (status) query.set("status", status);
  if (enabled) query.set("enabled", enabled);
  if (category) query.set("category", category);

  const data = await apiFetchAuthed<CollectionSourcesResponse>(
    `/v1/admin/collection/sources?${query.toString()}`,
    empty,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">Collection sources</h1>
        <p className="mt-1 text-sm text-ink-500">
          Enable, pause and configure each source. Access notes explain why a source is disabled.
        </p>
      </div>

      <CollectionNav />

      {data.items.some((source) => source.consecutiveFailures > 0) ? (
        <Alert tone="warning" title="Some sources are failing">
          A source with repeated failures backs off automatically. Open its detail page to read the
          last error before re-enabling it.
        </Alert>
      ) : null}

      <form className="card flex flex-wrap items-end gap-3 p-4" method="get">
        <div className="min-w-48 flex-1">
          <label htmlFor="source-q" className="label">
            Search
          </label>
          <Input id="source-q" name="q" defaultValue={q} placeholder="Name, code or URL…" />
        </div>
        <div>
          <label htmlFor="source-enabled" className="label">
            Enabled
          </label>
          <Select id="source-enabled" name="enabled" defaultValue={enabled}>
            <option value="">All</option>
            <option value="true">Enabled</option>
            <option value="false">Disabled</option>
          </Select>
        </div>
        <div>
          <label htmlFor="source-status" className="label">
            Status
          </label>
          <Select id="source-status" name="status" defaultValue={status}>
            <option value="">All</option>
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused</option>
            <option value="DEGRADED">Degraded</option>
            <option value="DISABLED">Disabled</option>
            <option value="PENDING_REVIEW">Pending review</option>
          </Select>
        </div>
        <div>
          <label htmlFor="source-category" className="label">
            Category
          </label>
          <Select id="source-category" name="category" defaultValue={category}>
            <option value="">All</option>
            <option value="FEDERAL">Federal</option>
            <option value="PROVINCIAL">Provincial</option>
            <option value="AJK">AJK</option>
            <option value="GILGIT_BALTISTAN">Gilgit-Baltistan</option>
            <option value="DEPARTMENT">Department</option>
            <option value="HOSPITAL">Hospital</option>
            <option value="UNIVERSITY">University</option>
            <option value="DEVELOPMENT_AUTHORITY">Development authority</option>
            <option value="PUBLIC_SECTOR">Public sector</option>
            <option value="NEWSPAPER">Newspaper</option>
            <option value="PRIVATE">Private</option>
          </Select>
        </div>
        <button type="submit" className="btn-secondary">
          Apply filters
        </button>
        <Link href="/admin/collection/sources" className="btn-ghost">
          Reset
        </Link>
      </form>

      {data.items.length > 0 ? (
        <>
          <div className="card overflow-x-auto">
            <table className="table-shell">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Connector</th>
                  <th>Status</th>
                  <th>Schedule</th>
                  <th>Last run</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((source) => (
                  <tr key={source.id}>
                    <td className="max-w-md">
                      <Link
                        href={`/admin/collection/sources/${source.id}`}
                        className="font-semibold text-navy-900 hover:text-emerald-700"
                      >
                        {source.name}
                      </Link>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {source.code} · {source.category.replaceAll("_", " ").toLowerCase()}
                        {source.province ? ` · ${source.province.name}` : ""}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {source.isVerified ? <Badge tone="green">Verified</Badge> : <Badge tone="amber">Unverified</Badge>}
                        {source.requiresAuth ? <Badge tone="amber">Requires login</Badge> : null}
                        {!source.connectorAvailable ? <Badge tone="red">No connector</Badge> : null}
                      </div>
                    </td>
                    <td className="text-xs">
                      <p className="font-mono text-[11px] text-navy-900">{source.connectorKey}</p>
                      <p className="mt-0.5 text-ink-500">
                        {source.collectionMethod.replaceAll("_", " ").toLowerCase()}
                      </p>
                    </td>
                    <td>
                      <SourceStatusBadge status={source.status} />
                      {source.lastError ? (
                        <p className="mt-1 max-w-48 truncate text-xs text-red-600" title={source.lastError}>
                          {source.lastError}
                        </p>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap text-xs">
                      {source.collectionMethod === "MANUAL_IMPORT" ? (
                        <span className="text-ink-500">Manual only</span>
                      ) : (
                        <>
                          <p>{scheduleLabel(source.scheduleMinutes)}</p>
                          <p className="text-ink-500">next {formatDateTimePkt(source.nextRunAt)}</p>
                        </>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-xs">
                      {source.lastRun ? (
                        <>
                          <RunStatusBadge status={source.lastRun.status} />
                          <p className="mt-1 text-ink-500">{formatDateTimePkt(source.lastRun.finishedAt ?? source.lastRun.startedAt)}</p>
                        </>
                      ) : (
                        <span className="text-ink-500">Never run</span>
                      )}
                    </td>
                    <td>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {source.collectionMethod !== "MANUAL_IMPORT" ? (
                          <ActionButton
                            action={runCollectionSource.bind(null, source.id)}
                            variant="primary"
                            pendingLabel="Running…"
                            title="Queue this source now"
                          >
                            Run now
                          </ActionButton>
                        ) : null}
                        <Link
                          href={`/admin/collection/sources/${source.id}`}
                          className="btn-secondary px-3 py-1.5 text-xs"
                        >
                          Configure
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            meta={data.meta}
            basePath="/admin/collection/sources"
            searchParams={{ q, status, enabled, category }}
          />
        </>
      ) : (
        <EmptyState
          title="No sources match these filters"
          description="Adjust the filters, or add a source through the seed registry and restart the API."
        />
      )}
    </div>
  );
}
