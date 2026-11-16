import type { Metadata } from "next";
import Link from "next/link";
import { Alert, StatTile } from "@/components/ui/feedback";
import { CollectionNav } from "@/components/admin/collection-nav";
import { IngestStatusBadge, OcrStatusBadge, RunStatusBadge } from "@/components/admin/collection-badges";
import { apiFetchAuthed } from "@/lib/server-api";
import { formatDateTimePkt } from "@paktenders/shared-utils";
import { formatBytes, formatDuration, percent } from "@/lib/collection-utils";
import type { CollectionRunDetail } from "@/lib/collection-types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Collection run",
  robots: { index: false, follow: false },
};

export default async function CollectionRunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const run = await apiFetchAuthed<CollectionRunDetail | null>(
    `/v1/admin/collection/runs/${encodeURIComponent(id)}`,
    null,
  );

  if (!run) {
    return (
      <div className="space-y-6">
        <CollectionNav />
        <Alert tone="error" title="Run could not be loaded">
          Return to the{" "}
          <Link href="/admin/collection/runs" className="font-semibold underline">
            run history
          </Link>
          .
        </Alert>
      </div>
    );
  }

  const log = run.log as { notes?: unknown } | null;
  const notes = Array.isArray(log?.notes) ? (log.notes as unknown[]).filter((note): note is string => typeof note === "string") : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/collection/runs" className="text-xs font-semibold text-emerald-700 hover:underline">
            ← All runs
          </Link>
          <h1 className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight text-navy-900">
            Run <span className="font-mono text-lg">{run.id.slice(0, 8)}…</span>
            <RunStatusBadge status={run.status} />
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            <Link href={`/admin/collection/sources/${run.source.id}`} className="font-semibold text-navy-900 hover:text-emerald-700">
              {run.source.name}
            </Link>{" "}
            · {run.trigger.toLowerCase()} · started {formatDateTimePkt(run.startedAt)} PKT
          </p>
        </div>
        {run.jobId ? <p className="font-mono text-xs text-ink-500">job {run.jobId}</p> : null}
      </div>

      <CollectionNav />

      {run.errorSummary ? (
        <Alert tone="error" title="Run error">
          <p className="break-words font-mono text-xs">{run.errorSummary}</p>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Items found" value={run.itemsFound} hint={`${run.itemsUnchanged} unchanged`} />
        <StatTile label="New / updated" value={`${run.itemsNew} / ${run.itemsUpdated}`} hint={`${run.itemsReview} awaiting review`} />
        <StatTile label="Duplicates" value={run.itemsDuplicate} hint={`${run.itemsFailed} failed`} />
        <StatTile label="Duration" value={formatDuration(run.durationMs)} hint={`finished ${formatDateTimePkt(run.finishedAt)}`} />
      </div>

      <section className="card overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-base font-bold text-navy-900">Imports from this run</h2>
          <p className="mt-0.5 text-xs text-ink-500">Showing up to 50 records. Each opens the review screen.</p>
        </div>
        {run.imports.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="table-shell">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Confidence</th>
                  <th>Created</th>
                  <th>Duplicate</th>
                </tr>
              </thead>
              <tbody>
                {run.imports.map((row) => (
                  <tr key={row.id}>
                    <td className="max-w-md">
                      <Link href={`/admin/collection/review/${row.id}`} className="font-semibold text-navy-900 hover:text-emerald-700">
                        {row.title}
                      </Link>
                      <p className="mt-0.5 truncate text-xs text-ink-500">{row.sourceUrl}</p>
                    </td>
                    <td>
                      <IngestStatusBadge status={row.status} />
                    </td>
                    <td className="whitespace-nowrap text-xs">{percent(row.confidence)}</td>
                    <td className="whitespace-nowrap text-xs">{formatDateTimePkt(row.createdAt)}</td>
                    <td className="text-xs">
                      {row.duplicateOfId ? (
                        <span title={row.duplicateOfId}>Merged · {percent(row.duplicateScore)}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 py-6 text-sm text-ink-500">No imports were recorded by this run.</p>
        )}
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-base font-bold text-navy-900">Stored documents</h2>
          <p className="mt-0.5 text-xs text-ink-500">
            {run.documentsFetched} fetched in this run · {formatBytes(run.bytesDownloaded)} downloaded. Originals are kept for audit.
          </p>
        </div>
        {run.documents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="table-shell">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>OCR</th>
                  <th>Extraction</th>
                  <th>Size</th>
                  <th>SHA-256</th>
                  <th>Download</th>
                </tr>
              </thead>
              <tbody>
                {run.documents.map((document) => (
                  <tr key={document.id}>
                    <td className="max-w-sm">
                      <p className="truncate text-sm font-medium text-navy-900">{document.fileName ?? "Untitled document"}</p>
                      <p className="truncate text-xs text-ink-500" title={document.url}>
                        {document.url}
                      </p>
                      {document.error ? <p className="mt-1 text-xs text-red-600">{document.error}</p> : null}
                    </td>
                    <td>
                      <OcrStatusBadge status={document.ocrStatus} />
                      <p className="mt-1 text-xs text-ink-500">{percent(document.ocrConfidence)}</p>
                    </td>
                    <td className="text-xs">{percent(document.extractionConfidence)}</td>
                    <td className="whitespace-nowrap text-xs">{formatBytes(document.contentLength)}</td>
                    <td className="font-mono text-[11px] text-ink-500">{document.sha256.slice(0, 12)}…</td>
                    <td>
                      <div className="flex flex-col gap-1 text-xs">
                        <a href={`/admin/collection/documents/${document.id}`} className="font-semibold text-emerald-700 hover:underline">
                          Stored copy
                        </a>
                        <a href={document.url} target="_blank" rel="noreferrer noopener" className="text-ink-500 hover:underline">
                          Source URL
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 py-6 text-sm text-ink-500">No documents were stored by this run.</p>
        )}
      </section>

      <section className="card p-5">
        <h2 className="text-base font-bold text-navy-900">Run log</h2>
        {notes.length > 0 ? (
          <ul className="mt-3 space-y-2 text-sm text-ink-600">
            {notes.map((note, index) => (
              <li key={`${index}-${note.slice(0, 24)}`} className="rounded-lg bg-surface px-3 py-2 font-mono text-xs leading-5">
                {note}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-ink-500">No log notes were recorded.</p>
        )}
      </section>
    </div>
  );
}
