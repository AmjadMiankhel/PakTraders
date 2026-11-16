import type { Metadata } from "next";
import Link from "next/link";
import { Alert, StatTile } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { ActionButton } from "@/components/forms/action-button";
import { CollectionNav } from "@/components/admin/collection-nav";
import { apiFetchAuthed } from "@/lib/server-api";
import { retryCollectionDeadLetter } from "@/lib/actions";
import { formatDateTimePkt } from "@paktenders/shared-utils";
import type { CollectionJobs } from "@/lib/collection-types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Collection queue and errors",
  robots: { index: false, follow: false },
};

const empty: CollectionJobs = {
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
  deadLetters: [],
};

export default async function CollectionJobsPage() {
  const data = await apiFetchAuthed<CollectionJobs>("/v1/admin/collection/jobs", empty);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">Queue and errors</h1>
        <p className="mt-1 text-sm text-ink-500">
          BullMQ queue health, retry state and the dead-letter entries that need attention.
        </p>
      </div>

      <CollectionNav />

      {!data.queue.ready ? (
        <Alert tone="warning" title="The queue is not connected">
          Redis or BullMQ is unavailable. Scheduled runs are paused and “Run now” executes inside the
          API process instead. Set <code>REDIS_URL</code> and restart the API to restore the worker.
        </Alert>
      ) : null}

      {!data.queue.workerEnabled ? (
        <Alert tone="info" title="Worker disabled">
          The queue is reachable but this process does not consume jobs. Set{" "}
          <code>COLLECTION_WORKER_ENABLED=true</code> on exactly one API instance.
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Waiting" value={data.queue.waiting} hint="Jobs ready to run" />
        <StatTile label="Active" value={data.queue.active} hint="Runs in progress" />
        <StatTile label="Delayed" value={data.queue.delayed} hint="Scheduled for later" />
        <StatTile label="Failed" value={data.queue.failed} hint={`${data.queue.deadLetters} dead-letter entries`} />
      </div>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-navy-900">Queue state</h2>
            <p className="mt-0.5 text-xs text-ink-500">
              Counts come from BullMQ; run history stays in the database even after jobs are removed.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge tone={data.queue.ready ? "green" : "amber"}>
              {data.queue.ready ? "Queue ready" : "Queue unavailable"}
            </Badge>
            <Badge tone={data.queue.workerEnabled ? "green" : "slate"}>
              {data.queue.workerEnabled ? "Worker enabled" : "Worker disabled"}
            </Badge>
            <Badge tone="slate">{data.queue.completed} completed</Badge>
          </div>
        </div>
        <div className="grid gap-3 px-5 py-4 text-sm sm:grid-cols-2">
          <p className="text-ink-600">
            Each source can only have one queued job at a time. A Redis lock also stops two workers
            from processing the same source.
          </p>
          <p className="text-ink-600">
            Failed jobs retry with exponential backoff. Once every attempt is exhausted the job is
            copied to the dead-letter queue below and the source is backed off.
          </p>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-base font-bold text-navy-900">Dead-letter entries</h2>
          <p className="mt-0.5 text-xs text-ink-500">
            Retrying re-queues the source as a manual retry run and removes the entry.
          </p>
        </div>
        {data.deadLetters.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="table-shell">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Source</th>
                  <th>Error</th>
                  <th>Failed at</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.deadLetters.map((entry, index) => (
                  <tr key={entry.id ?? `${entry.name}-${index}`}>
                    <td className="font-mono text-xs text-navy-900">{entry.name}</td>
                    <td className="text-xs">
                      {entry.sourceId ? (
                        <Link
                          href={`/admin/collection/sources/${entry.sourceId}`}
                          className="font-semibold text-emerald-700 hover:underline"
                        >
                          {entry.sourceId.slice(0, 8)}…
                        </Link>
                      ) : (
                        <span className="text-ink-500">Not linked</span>
                      )}
                    </td>
                    <td className="max-w-md">
                      <p className="break-words font-mono text-[11px] leading-5 text-red-700">{entry.error}</p>
                    </td>
                    <td className="whitespace-nowrap text-xs">{formatDateTimePkt(entry.failedAt)}</td>
                    <td>
                      {entry.id && entry.sourceId ? (
                        <ActionButton
                          action={retryCollectionDeadLetter.bind(null, entry.id)}
                          variant="secondary"
                          pendingLabel="Re-queuing…"
                        >
                          Retry
                        </ActionButton>
                      ) : (
                        <span className="text-xs text-ink-500">Cannot retry</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-6">
            <EmptyState
              title="No dead-letter entries"
              description="Nothing has failed beyond its retry budget. Failed runs are still listed in the run history."
            />
          </div>
        )}
      </section>

      <div className="flex flex-wrap gap-2">
        <Link href="/admin/collection/runs?status=FAILED" className="btn-secondary">
          View failed runs
        </Link>
        <Link href="/admin/collection/sources" className="btn-secondary">
          Source registry
        </Link>
      </div>
    </div>
  );
}
