import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, Pagination } from "@/components/ui/states";
import { Select } from "@/components/ui/field";
import { CollectionNav } from "@/components/admin/collection-nav";
import { RunStatusBadge } from "@/components/admin/collection-badges";
import { apiFetchAuthed } from "@/lib/server-api";
import { formatDateTimePkt } from "@paktenders/shared-utils";
import { formatBytes, formatDuration } from "@/lib/collection-utils";
import type { CollectionRunsResponse, CollectionSourcesResponse } from "@/lib/collection-types";
import { firstValue, parsePositiveInt, type RawSearchParams } from "@/lib/search-params";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Collection runs",
  robots: { index: false, follow: false },
};

const emptyRuns: CollectionRunsResponse = {
  items: [],
  meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
};

const emptySources: CollectionSourcesResponse = {
  items: [],
  meta: { page: 1, pageSize: 100, total: 0, totalPages: 1 },
};

export default async function CollectionRunsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const page = parsePositiveInt(firstValue(params.page), 1);
  const sourceId = firstValue(params.sourceId) ?? "";
  const status = firstValue(params.status) ?? "";
  const trigger = firstValue(params.trigger) ?? "";

  const query = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (sourceId) query.set("sourceId", sourceId);
  if (status) query.set("status", status);
  if (trigger) query.set("trigger", trigger);

  const [runs, sources] = await Promise.all([
    apiFetchAuthed<CollectionRunsResponse>(`/v1/admin/collection/runs?${query.toString()}`, emptyRuns),
    apiFetchAuthed<CollectionSourcesResponse>("/v1/admin/collection/sources?pageSize=100", emptySources),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">Collection runs</h1>
        <p className="mt-1 text-sm text-ink-500">
          Every scheduled, manual and retried run, with what it found and where it failed.
        </p>
      </div>

      <CollectionNav />

      <form className="card flex flex-wrap items-end gap-3 p-4" method="get">
        <div className="min-w-56 flex-1">
          <label htmlFor="run-source" className="label">
            Source
          </label>
          <Select id="run-source" name="sourceId" defaultValue={sourceId}>
            <option value="">All sources</option>
            {sources.items.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="run-status" className="label">
            Status
          </label>
          <Select id="run-status" name="status" defaultValue={status}>
            <option value="">All</option>
            <option value="QUEUED">Queued</option>
            <option value="RUNNING">Running</option>
            <option value="SUCCEEDED">Succeeded</option>
            <option value="PARTIAL">Partial</option>
            <option value="FAILED">Failed</option>
            <option value="SKIPPED">Skipped</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
        </div>
        <div>
          <label htmlFor="run-trigger" className="label">
            Trigger
          </label>
          <Select id="run-trigger" name="trigger" defaultValue={trigger}>
            <option value="">All</option>
            <option value="SCHEDULE">Schedule</option>
            <option value="MANUAL">Manual</option>
            <option value="RETRY">Retry</option>
            <option value="WEBHOOK">Webhook</option>
          </Select>
        </div>
        <button type="submit" className="btn-secondary">
          Apply filters
        </button>
        <Link href="/admin/collection/runs" className="btn-ghost">
          Reset
        </Link>
      </form>

      {runs.items.length > 0 ? (
        <>
          <div className="card overflow-x-auto">
            <table className="table-shell">
              <thead>
                <tr>
                  <th>Run</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Started</th>
                  <th>Duration</th>
                  <th>Found / new / dup / review</th>
                  <th>Failed</th>
                  <th>Documents</th>
                </tr>
              </thead>
              <tbody>
                {runs.items.map((run) => (
                  <tr key={run.id}>
                    <td>
                      <Link href={`/admin/collection/runs/${run.id}`} className="font-mono text-xs font-semibold text-navy-900 hover:text-emerald-700">
                        {run.id.slice(0, 8)}…
                      </Link>
                      <p className="text-xs text-ink-500">{run.trigger.toLowerCase()}</p>
                    </td>
                    <td className="max-w-56">
                      <Link href={`/admin/collection/sources/${run.source.id}`} className="text-sm font-semibold text-navy-900 hover:text-emerald-700">
                        {run.source.name}
                      </Link>
                      <p className="text-xs text-ink-500">{run.source.code}</p>
                    </td>
                    <td>
                      <RunStatusBadge status={run.status} />
                      {run.errorSummary ? (
                        <p className="mt-1 max-w-56 truncate text-xs text-red-600" title={run.errorSummary}>
                          {run.errorSummary}
                        </p>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap text-xs">
                      {formatDateTimePkt(run.startedAt)}
                      {run.finishedAt ? (
                        <p className="text-ink-500">finished {formatDateTimePkt(run.finishedAt)}</p>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap text-xs">{formatDuration(run.durationMs)}</td>
                    <td className="whitespace-nowrap text-xs tabular-nums">
                      {run.itemsFound} / {run.itemsNew} / {run.itemsDuplicate} / {run.itemsReview}
                    </td>
                    <td className="whitespace-nowrap text-xs tabular-nums">{run.itemsFailed}</td>
                    <td className="whitespace-nowrap text-xs">
                      {run.documentsFetched} · {formatBytes(run.bytesDownloaded)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            meta={runs.meta}
            basePath="/admin/collection/runs"
            searchParams={{ sourceId, status, trigger }}
          />
        </>
      ) : (
        <EmptyState
          title="No runs recorded"
          description="Start a run from a source, or wait for the scheduler tick."
        />
      )}
    </div>
  );
}
