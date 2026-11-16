import type { Metadata } from "next";
import Link from "next/link";
import { Alert, StatTile } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/forms/action-button";
import { CollectionNav } from "@/components/admin/collection-nav";
import { RunStatusBadge, SourceStatusBadge } from "@/components/admin/collection-badges";
import { CollectionSourceForm } from "@/components/admin/collection-source-form";
import { apiFetchAuthed } from "@/lib/server-api";
import { runCollectionSource } from "@/lib/actions";
import { formatDateTimePkt } from "@paktenders/shared-utils";
import { formatBytes, formatDuration, scheduleLabel } from "@/lib/collection-utils";
import type { CollectionSourceDetail } from "@/lib/collection-types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Collection source",
  robots: { index: false, follow: false },
};

export default async function CollectionSourceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const source = await apiFetchAuthed<CollectionSourceDetail | null>(
    `/v1/admin/collection/sources/${encodeURIComponent(id)}`,
    null,
  );

  if (!source) {
    return (
      <div className="space-y-6">
        <CollectionNav />
        <Alert tone="error" title="Source could not be loaded">
          It may have been removed, or the API is unavailable. Return to the{" "}
          <Link href="/admin/collection/sources" className="font-semibold underline">
            source registry
          </Link>
          .
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/collection/sources" className="text-xs font-semibold text-emerald-700 hover:underline">
            ← All sources
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-navy-900">{source.name}</h1>
          <p className="mt-1 text-sm text-ink-500">
            {source.code} · {source.category.replaceAll("_", " ").toLowerCase()} ·{" "}
            <span className="font-mono text-xs">{source.connectorKey}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SourceStatusBadge status={source.status} />
          {source.isEnabled ? <Badge tone="green">Enabled</Badge> : <Badge tone="slate">Disabled</Badge>}
          {source.isVerified ? <Badge tone="green">Access verified</Badge> : <Badge tone="amber">Unverified</Badge>}
          {source.collectionMethod !== "MANUAL_IMPORT" ? (
            <ActionButton action={runCollectionSource.bind(null, source.id)} variant="primary" pendingLabel="Running…">
              Run now
            </ActionButton>
          ) : null}
        </div>
      </div>

      <CollectionNav />

      {source.lastError ? (
        <Alert tone="error" title={`Last error (${source.consecutiveFailures} consecutive failure${source.consecutiveFailures === 1 ? "" : "s"})`}>
          <p className="break-words font-mono text-xs">{source.lastError}</p>
        </Alert>
      ) : null}

      {!source.connectorAvailable ? (
        <Alert tone="warning" title="No connector registered">
          The configured connector key is not available in this API build. The source cannot run until
          a connector is registered or the source is switched to manual import.
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Tenders" value={source.counts.tenders} hint="Records created from this source" />
        <StatTile label="Imports" value={source.counts.imports} hint={`${source.counts.documents ?? 0} stored documents`} />
        <StatTile label="Runs" value={source.counts.runs} hint={`Last ${formatDateTimePkt(source.lastRunAt)}`} />
        <StatTile
          label="Schedule"
          value={source.collectionMethod === "MANUAL_IMPORT" ? "Manual" : scheduleLabel(source.scheduleMinutes)}
          hint={
            source.collectionMethod === "MANUAL_IMPORT"
              ? "Not scheduled"
              : `Next ${formatDateTimePkt(source.nextRunAt)}`
          }
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="card p-5">
          <h2 className="mb-4 text-base font-bold text-navy-900">Configuration</h2>
          <CollectionSourceForm source={source} />
        </section>

        <aside className="space-y-4">
          <section className="card p-5 text-sm">
            <h2 className="text-base font-bold text-navy-900">Source facts</h2>
            <dl className="mt-3 space-y-2.5">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Collection method</dt>
                <dd className="text-ink-700">{source.collectionMethod.replaceAll("_", " ").toLowerCase()}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Authority</dt>
                <dd className="text-ink-700">{source.authority?.name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Province</dt>
                <dd className="text-ink-700">{source.province?.name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Licence notes</dt>
                <dd className="text-ink-700">{source.licenseNotes ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Terms</dt>
                <dd className="truncate text-ink-700">
                  {source.termsUrl ? (
                    <a href={source.termsUrl} target="_blank" rel="noreferrer noopener" className="text-emerald-700 hover:underline">
                      {source.termsUrl}
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
            </dl>
          </section>

          <section className="card p-5 text-sm">
            <h2 className="text-base font-bold text-navy-900">Access notes</h2>
            <p className="mt-2 whitespace-pre-line leading-6 text-ink-600">
              {source.accessNotes ?? "No access notes recorded."}
            </p>
          </section>
        </aside>
      </div>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="text-base font-bold text-navy-900">Recent runs</h2>
          <Link href={`/admin/collection/runs?sourceId=${source.id}`} className="text-xs font-semibold text-emerald-700 hover:underline">
            All runs for this source
          </Link>
        </div>
        {source.recentRuns.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="table-shell">
              <thead>
                <tr>
                  <th>Run</th>
                  <th>Status</th>
                  <th>Started</th>
                  <th>Duration</th>
                  <th>Found / new / review</th>
                  <th>Failed</th>
                  <th>Documents</th>
                </tr>
              </thead>
              <tbody>
                {source.recentRuns.map((run) => (
                  <tr key={run.id}>
                    <td>
                      <Link href={`/admin/collection/runs/${run.id}`} className="font-mono text-xs font-semibold text-navy-900 hover:text-emerald-700">
                        {run.id.slice(0, 8)}…
                      </Link>
                      <p className="text-xs text-ink-500">{run.trigger.toLowerCase()}</p>
                    </td>
                    <td>
                      <RunStatusBadge status={run.status} />
                      {run.errorSummary ? (
                        <p className="mt-1 max-w-56 truncate text-xs text-red-600" title={run.errorSummary}>
                          {run.errorSummary}
                        </p>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap text-xs">{formatDateTimePkt(run.startedAt)}</td>
                    <td className="whitespace-nowrap text-xs">{formatDuration(run.durationMs)}</td>
                    <td className="whitespace-nowrap text-xs tabular-nums">
                      {run.itemsFound} / {run.itemsNew} / {run.itemsReview}
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
        ) : (
          <p className="px-5 py-6 text-sm text-ink-500">This source has not run yet.</p>
        )}
      </section>
    </div>
  );
}
