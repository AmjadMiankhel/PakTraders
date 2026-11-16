import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  Clock,
  Copy,
  Database,
  FileSearch,
  HardDrive,
  ListChecks,
  Rss,
  Wifi,
} from "lucide-react";
import { formatDateTimePkt } from "@paktenders/shared-utils";
import { Alert, StatTile } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { CollectionNav } from "@/components/admin/collection-nav";
import { apiFetchAuthed } from "@/lib/server-api";
import { formatBytes, scheduleLabel } from "@/lib/collection-utils";
import type { CollectionOverview } from "@/lib/collection-types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tender collection",
  robots: { index: false, follow: false },
};

const empty: CollectionOverview = {
  sources: { total: 0, enabled: 0, verified: 0, failing: 0, byStatus: {} },
  runs24h: {},
  imports: { byStatus: {}, pendingReview: 0 },
  duplicates: { pending: 0 },
  documents: { total: 0, bytes: 0, ocrFailures: 0 },
  tendersNeedingReview: 0,
  lastSuccessfulRun: null,
  upcoming: [],
  queue: {
    enabled: false,
    workerEnabled: false,
    ready: false,
    waiting: 0,
    active: 0,
    delayed: 0,
    failed: 0,
    completed: 0,
    deadLetters: 0,
  },
  connectors: [],
  settings: {
    collectionEnabled: false,
    workerEnabled: false,
    redisConfigured: false,
    ocrEnabled: false,
    ocrLanguages: "",
    aiCollectionEnabled: false,
    aiConfigured: false,
  },
  generatedAt: new Date().toISOString(),
};

export default async function CollectionOverviewPage() {
  const overview = await apiFetchAuthed<CollectionOverview>("/v1/admin/collection/overview", empty);
  const runs24hTotal = Object.values(overview.runs24h).reduce((sum, value) => sum + value, 0);
  const failedRuns24h = overview.runs24h.FAILED ?? 0;
  const partialRuns24h = overview.runs24h.PARTIAL ?? 0;
  const importsTotal = Object.values(overview.imports.byStatus).reduce((sum, value) => sum + value, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900">Tender collection</h1>
          <p className="mt-1 text-sm text-ink-500">
            Automated source runs, extraction and review · generated{" "}
            {formatDateTimePkt(overview.generatedAt)} PKT
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/collection/import" className="btn-secondary">
            Manual import
          </Link>
          <Link href="/admin/collection/sources" className="btn-primary">
            Manage sources
          </Link>
        </div>
      </div>

      <CollectionNav />

      {!overview.settings.collectionEnabled ? (
        <Alert tone="warning" title="Automated collection is switched off">
          Set <code>COLLECTION_ENABLED=true</code> to let the scheduler fetch sources. Manual imports
          still work.
        </Alert>
      ) : null}

      {!overview.queue.ready ? (
        <Alert tone="info" title="Queue is not connected">
          Redis or BullMQ is unavailable, so scheduled runs are paused and “Run now” executes
          synchronously inside the API. Configure <code>REDIS_URL</code> to enable the worker.
        </Alert>
      ) : null}

      {overview.queue.deadLetters > 0 ? (
        <Alert tone="error" title={`${overview.queue.deadLetters} dead-letter job(s)`}>
          Some runs failed after every retry. Review them on the{" "}
          <Link href="/admin/collection/jobs" className="font-semibold underline">
            queue &amp; errors
          </Link>{" "}
          screen.
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Enabled sources"
          value={overview.sources.enabled}
          hint={`${overview.sources.total} configured · ${overview.sources.verified} verified`}
          icon={<Rss className="h-5 w-5" />}
        />
        <StatTile
          label="Runs (24h)"
          value={runs24hTotal}
          hint={`${failedRuns24h} failed · ${partialRuns24h} partial`}
          icon={<ListChecks className="h-5 w-5" />}
        />
        <StatTile
          label="Awaiting review"
          value={overview.imports.pendingReview}
          hint={`${importsTotal} imports recorded`}
          icon={<FileSearch className="h-5 w-5" />}
        />
        <StatTile
          label="Duplicate checks"
          value={overview.duplicates.pending}
          hint="Pending decisions"
          icon={<Copy className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Stored documents"
          value={overview.documents.total}
          hint={formatBytes(overview.documents.bytes)}
          icon={<HardDrive className="h-5 w-5" />}
        />
        <StatTile
          label="OCR failures"
          value={overview.documents.ocrFailures}
          hint={overview.settings.ocrEnabled ? "OCR is enabled" : "OCR is disabled"}
        />
        <StatTile
          label="Tenders needing review"
          value={overview.tendersNeedingReview}
          hint="Includes collected and duplicate records"
        />
        <StatTile
          label="Failing sources"
          value={overview.sources.failing}
          hint="Consecutive failures above zero"
          icon={<AlertTriangle className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <h2 className="text-base font-bold text-navy-900">Next scheduled runs</h2>
            <Link href="/admin/collection/runs" className="text-xs font-semibold text-emerald-700 hover:underline">
              All runs
            </Link>
          </div>
          {overview.upcoming.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="table-shell">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Schedule</th>
                    <th>Next run</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.upcoming.map((source) => (
                    <tr key={source.id}>
                      <td>
                        <Link
                          href={`/admin/collection/sources/${source.id}`}
                          className="font-semibold text-navy-900 hover:text-emerald-700"
                        >
                          {source.name}
                        </Link>
                        <p className="text-xs text-ink-500">{source.code}</p>
                      </td>
                      <td className="whitespace-nowrap text-xs">{scheduleLabel(source.scheduleMinutes)}</td>
                      <td className="whitespace-nowrap text-xs">{formatDateTimePkt(source.nextRunAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-5 py-6 text-sm text-ink-500">
              No automated source is scheduled. Enable a source or check the queue connection.
            </p>
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-base font-bold text-navy-900">Queue and integration state</h2>
          </div>
          <div className="space-y-3 px-5 py-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-ink-600">
                <Wifi className="h-4 w-4" /> Queue
              </span>
              <Badge tone={overview.queue.ready ? "green" : "amber"}>
                {overview.queue.ready ? "Ready" : "Not connected"}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-ink-600">
                <Clock className="h-4 w-4" /> Worker
              </span>
              <Badge tone={overview.queue.workerEnabled ? "green" : "slate"}>
                {overview.queue.workerEnabled ? "Enabled" : "Disabled"}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-ink-600">
                <Database className="h-4 w-4" /> Redis
              </span>
              <Badge tone={overview.settings.redisConfigured ? "green" : "slate"}>
                {overview.settings.redisConfigured ? "Configured" : "Not configured"}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-ink-600">Waiting / active / delayed</span>
              <span className="font-semibold tabular-nums text-navy-900">
                {overview.queue.waiting} / {overview.queue.active} / {overview.queue.delayed}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-ink-600">OCR</span>
              <Badge tone={overview.settings.ocrEnabled ? "green" : "slate"}>
                {overview.settings.ocrEnabled ? `Enabled (${overview.settings.ocrLanguages})` : "Disabled"}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-ink-600">AI classification</span>
              <Badge
                tone={
                  overview.settings.aiCollectionEnabled && overview.settings.aiConfigured
                    ? "green"
                    : "slate"
                }
              >
                {!overview.settings.aiCollectionEnabled
                  ? "Disabled"
                  : overview.settings.aiConfigured
                    ? "Configured"
                    : "Rules only (no API key)"}
              </Badge>
            </div>
            {overview.lastSuccessfulRun ? (
              <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
                <span className="text-ink-600">Last successful run</span>
                <Link
                  href={`/admin/collection/runs/${overview.lastSuccessfulRun.id}`}
                  className="text-xs font-semibold text-emerald-700 hover:underline"
                >
                  {formatDateTimePkt(overview.lastSuccessfulRun.finishedAt)} ·{" "}
                  {overview.lastSuccessfulRun.itemsNew} new
                </Link>
              </div>
            ) : (
              <p className="border-t border-line pt-3 text-xs text-ink-500">
                No successful automated run recorded yet.
              </p>
            )}
          </div>
        </section>
      </div>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-navy-900">Available connectors</h2>
            <p className="mt-0.5 text-xs text-ink-500">
              Connectors are only used by sources that are configured and enabled.
            </p>
          </div>
          <Link href="/admin/collection/sources" className="text-xs font-semibold text-emerald-700 hover:underline">
            Source registry
          </Link>
        </div>
        <div className="grid gap-3 px-5 py-4 sm:grid-cols-2 xl:grid-cols-4">
          {overview.connectors.map((connector) => (
            <div key={connector.key} className="rounded-xl border border-line bg-surface p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-navy-900">{connector.label}</p>
                <Badge tone={connector.automated ? "green" : "slate"}>
                  {connector.automated ? "Automated" : "Manual"}
                </Badge>
              </div>
              <p className="mt-0.5 font-mono text-[11px] text-ink-500">{connector.key}</p>
              <p className="mt-1 text-xs leading-5 text-ink-500">
                {connector.supportsEnrichment
                  ? "Reads listing pages and can load detail pages and documents."
                  : "Imports records without fetching detail pages."}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
