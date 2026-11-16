import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/feedback";
import { EmptyState, Pagination } from "@/components/ui/states";
import { Input, Select } from "@/components/ui/field";
import { CollectionNav } from "@/components/admin/collection-nav";
import { ConfidenceValue, IngestStatusBadge } from "@/components/admin/collection-badges";
import { apiFetchAuthed } from "@/lib/server-api";
import { formatDateTimePkt } from "@paktenders/shared-utils";
import type { CollectionImportsResponse, CollectionSourcesResponse } from "@/lib/collection-types";
import { firstValue, parsePositiveInt, type RawSearchParams } from "@/lib/search-params";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Collection review queue",
  robots: { index: false, follow: false },
};

const emptyImports: CollectionImportsResponse = {
  items: [],
  meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
};

const emptySources: CollectionSourcesResponse = {
  items: [],
  meta: { page: 1, pageSize: 100, total: 0, totalPages: 1 },
};

export default async function CollectionReviewPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const page = parsePositiveInt(firstValue(params.page), 1);
  const q = firstValue(params.q) ?? "";
  const sourceId = firstValue(params.sourceId) ?? "";
  const status = firstValue(params.status) ?? "NEEDS_REVIEW";

  const query = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (q.trim()) query.set("q", q.trim());
  if (sourceId) query.set("sourceId", sourceId);
  if (status) query.set("status", status);

  const [imports, sources] = await Promise.all([
    apiFetchAuthed<CollectionImportsResponse>(`/v1/admin/collection/imports?${query.toString()}`, emptyImports),
    apiFetchAuthed<CollectionSourcesResponse>("/v1/admin/collection/sources?pageSize=100", emptySources),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">Review queue</h1>
        <p className="mt-1 text-sm text-ink-500">
          Collected records are never published automatically unless the source allows it and the
          extraction confidence passes its threshold.
        </p>
      </div>

      <CollectionNav />

      {status === "NEEDS_REVIEW" && imports.items.length === 0 ? (
        <Alert tone="success" title="Nothing waiting">
          Every collected record has been reviewed. New imports will appear here.
        </Alert>
      ) : null}

      <form className="card flex flex-wrap items-end gap-3 p-4" method="get">
        <div className="min-w-48 flex-1">
          <label htmlFor="import-q" className="label">
            Search
          </label>
          <Input id="import-q" name="q" defaultValue={q} placeholder="Title, source URL or external ID…" />
        </div>
        <div className="min-w-52">
          <label htmlFor="import-source" className="label">
            Source
          </label>
          <Select id="import-source" name="sourceId" defaultValue={sourceId}>
            <option value="">All sources</option>
            {sources.items.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="import-status" className="label">
            Status
          </label>
          <Select id="import-status" name="status" defaultValue={status}>
            <option value="">All statuses</option>
            <option value="NEEDS_REVIEW">Needs review</option>
            <option value="NEW">New</option>
            <option value="UPDATED">Updated</option>
            <option value="DUPLICATE">Duplicate</option>
            <option value="PUBLISHED">Published</option>
            <option value="REJECTED">Rejected</option>
            <option value="FAILED">Failed</option>
          </Select>
        </div>
        <button type="submit" className="btn-secondary">
          Apply filters
        </button>
        <Link href="/admin/collection/review" className="btn-ghost">
          Reset
        </Link>
      </form>

      {imports.items.length > 0 ? (
        <>
          <div className="card overflow-x-auto">
            <table className="table-shell">
              <thead>
                <tr>
                  <th>Notice</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Confidence</th>
                  <th>Last seen</th>
                  <th>Tender</th>
                  <th>Review</th>
                </tr>
              </thead>
              <tbody>
                {imports.items.map((row) => (
                  <tr key={row.id}>
                    <td className="max-w-md">
                      <Link href={`/admin/collection/review/${row.id}`} className="font-semibold text-navy-900 hover:text-emerald-700">
                        {row.title}
                      </Link>
                      <p className="mt-0.5 truncate text-xs text-ink-500">{row.sourceUrl}</p>
                      {row.duplicateOfId ? (
                        <p className="mt-1 text-xs text-violet-700">Duplicate candidate · {row.duplicateScore ? `${Math.round(row.duplicateScore * 100)}%` : ""}</p>
                      ) : null}
                    </td>
                    <td className="text-xs">
                      <p className="font-semibold text-navy-900">{row.source.name}</p>
                      <p className="text-ink-500">{row.source.code}</p>
                    </td>
                    <td>
                      <IngestStatusBadge status={row.status} />
                    </td>
                    <td className="whitespace-nowrap">
                      <ConfidenceValue value={row.confidence} />
                    </td>
                    <td className="whitespace-nowrap text-xs">{formatDateTimePkt(row.lastSeenAt)}</td>
                    <td className="text-xs">
                      {row.tender ? (
                        <Link href={`/admin/tenders/${row.tender.id}`} className="font-semibold text-emerald-700 hover:underline">
                          {row.tender.status.replaceAll("_", " ").toLowerCase()}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <Link href={`/admin/collection/review/${row.id}`} className="btn-primary px-3 py-1.5 text-xs">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            meta={imports.meta}
            basePath="/admin/collection/review"
            searchParams={{ q, sourceId, status }}
          />
        </>
      ) : (
        <EmptyState
          title="No imports match these filters"
          description="Try another status or source, or wait for the next scheduled run."
        />
      )}
    </div>
  );
}
