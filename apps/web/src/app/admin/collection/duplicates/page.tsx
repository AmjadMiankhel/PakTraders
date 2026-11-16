import type { Metadata } from "next";
import Link from "next/link";
import { Copy } from "lucide-react";
import { Alert } from "@/components/ui/feedback";
import { EmptyState, Pagination } from "@/components/ui/states";
import { Select } from "@/components/ui/field";
import { ActionButton } from "@/components/forms/action-button";
import { CollectionNav } from "@/components/admin/collection-nav";
import {
  ConfidenceValue,
  DuplicateDecisionBadge,
  IngestStatusBadge,
  MatchTypeLabel,
} from "@/components/admin/collection-badges";
import { apiFetchAuthed } from "@/lib/server-api";
import { resolveCollectionDuplicate } from "@/lib/actions";
import { formatDateTimePkt } from "@paktenders/shared-utils";
import { percent } from "@/lib/collection-utils";
import type { CollectionDuplicatesResponse } from "@/lib/collection-types";
import { firstValue, parsePositiveInt, type RawSearchParams } from "@/lib/search-params";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Duplicate reviews",
  robots: { index: false, follow: false },
};

const empty: CollectionDuplicatesResponse = {
  items: [],
  meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
};

type DuplicateSignals = {
  titleScore?: number;
  referenceEqual?: boolean;
  organizationEqual?: boolean;
  publishedDistanceDays?: number | null;
  closingDistanceDays?: number | null;
  sha256?: string;
  sourceUrl?: string;
  referenceNumber?: string;
  organization?: string;
  resolutionNote?: string | null;
  resolvedBy?: string;
};

function readSignals(value: unknown): DuplicateSignals {
  return value && typeof value === "object" ? (value as DuplicateSignals) : {};
}

function SignalSummary({ signals }: { signals: DuplicateSignals }) {
  const parts: string[] = [];
  if (typeof signals.titleScore === "number") parts.push(`title ${percent(signals.titleScore)}`);
  if (signals.referenceEqual) parts.push("same reference");
  if (signals.organizationEqual) parts.push("same organisation");
  if (typeof signals.publishedDistanceDays === "number") {
    parts.push(`published ±${signals.publishedDistanceDays}d`);
  }
  if (typeof signals.closingDistanceDays === "number") {
    parts.push(`closing ±${signals.closingDistanceDays}d`);
  }
  if (signals.sha256) parts.push("identical document");
  if (signals.sourceUrl) parts.push("same source URL");
  if (parts.length === 0) return <span className="text-xs text-ink-500">No signals recorded</span>;
  return <span className="text-xs text-ink-600">{parts.join(" · ")}</span>;
}

export default async function CollectionDuplicatesPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const page = parsePositiveInt(firstValue(params.page), 1);
  const decision = firstValue(params.decision) ?? "PENDING";

  const query = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (decision) query.set("decision", decision);

  const data = await apiFetchAuthed<CollectionDuplicatesResponse>(
    `/v1/admin/collection/duplicates?${query.toString()}`,
    empty,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">Duplicate reviews</h1>
        <p className="mt-1 text-sm text-ink-500">
          Exact matches are merged automatically. Similar records are held here so two different
          tenders are never merged on a similar title alone.
        </p>
      </div>

      <CollectionNav />

      {decision === "PENDING" && data.items.length === 0 ? (
        <Alert tone="success" title="No duplicate decisions waiting">
          When a run finds a possible duplicate, it appears here with the signals that matched.
        </Alert>
      ) : null}

      <form className="card flex flex-wrap items-end gap-3 p-4" method="get">
        <div className="min-w-52">
          <label htmlFor="duplicate-decision" className="label">
            Decision
          </label>
          <Select id="duplicate-decision" name="decision" defaultValue={decision}>
            <option value="PENDING">Pending</option>
            <option value="MERGED">Merged</option>
            <option value="KEPT_SEPARATE">Kept separate</option>
            <option value="IGNORED">Ignored</option>
            <option value="">All decisions</option>
          </Select>
        </div>
        <button type="submit" className="btn-secondary">
          Apply
        </button>
        <Link href="/admin/collection/duplicates" className="btn-ghost">
          Reset
        </Link>
      </form>

      {data.items.length > 0 ? (
        <>
          <div className="space-y-4">
            {data.items.map((row) => {
              const signals = readSignals(row.signals);
              const pending = row.decision === "PENDING";
              return (
                <section key={row.id} className="card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <DuplicateDecisionBadge decision={row.decision} />
                      <span className="rounded-full bg-surface px-2 py-0.5 font-semibold text-ink-600">
                        <MatchTypeLabel type={row.matchType} />
                      </span>
                      <ConfidenceValue value={row.score} label="match" />
                      <span className="text-ink-500">detected {formatDateTimePkt(row.createdAt)}</span>
                      {row.reviewedAt ? (
                        <span className="text-ink-500">· reviewed {formatDateTimePkt(row.reviewedAt)}</span>
                      ) : null}
                    </div>
                    {row.import ? (
                      <Link
                        href={`/admin/collection/review/${row.import.id}`}
                        className="btn-secondary px-3 py-1.5 text-xs"
                      >
                        Open import
                      </Link>
                    ) : null}
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border border-line bg-surface p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                        Existing tender (kept on merge)
                      </p>
                      <Link
                        href={`/admin/tenders/${row.tender.id}`}
                        className="mt-1 block font-semibold text-navy-900 hover:text-emerald-700"
                      >
                        {row.tender.title}
                      </Link>
                      <p className="mt-1 text-xs text-ink-500">
                        {row.tender.department?.name ?? "Organisation not recorded"} ·{" "}
                        {row.tender.referenceNumber ?? "no reference"} · closes{" "}
                        {formatDateTimePkt(row.tender.closingAt)}
                      </p>
                      <p className="mt-1 text-xs text-ink-500">
                        Status: {row.tender.status.replaceAll("_", " ").toLowerCase()}
                      </p>
                    </div>

                    <div className="rounded-xl border border-line bg-surface p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                        Candidate (archived on merge)
                      </p>
                      {row.candidate ? (
                        <>
                          <Link
                            href={`/admin/tenders/${row.candidate.id}`}
                            className="mt-1 block font-semibold text-navy-900 hover:text-emerald-700"
                          >
                            {row.candidate.title}
                          </Link>
                          <p className="mt-1 text-xs text-ink-500">
                            {row.candidate.department?.name ?? "Organisation not recorded"} ·{" "}
                            {row.candidate.referenceNumber ?? "no reference"} · closes{" "}
                            {formatDateTimePkt(row.candidate.closingAt)}
                          </p>
                          <p className="mt-1 text-xs text-ink-500">
                            Status: {row.candidate.status.replaceAll("_", " ").toLowerCase()}
                            {row.candidate.deletedAt ? " · archived" : ""}
                          </p>
                        </>
                      ) : (
                        <p className="mt-1 text-sm text-ink-500">The candidate tender was removed.</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <SignalSummary signals={signals} />
                    {row.import ? (
                      <>
                        <span className="text-xs text-ink-500">· import</span>
                        <IngestStatusBadge status={row.import.status} />
                        <ConfidenceValue value={row.import.confidence} label="extraction" />
                      </>
                    ) : null}
                  </div>

                  {row.mergedTenderId ? (
                    <p className="mt-3 text-xs text-ink-500">
                      Merged into{" "}
                      <Link
                        href={`/admin/tenders/${row.mergedTenderId}`}
                        className="font-semibold text-emerald-700 hover:underline"
                      >
                        the primary tender
                      </Link>
                      .
                    </p>
                  ) : null}

                  {signals.resolutionNote ? (
                    <p className="mt-2 rounded-lg bg-surface px-3 py-2 text-xs text-ink-600">
                      Resolution note: {signals.resolutionNote}
                      {signals.resolvedBy ? ` — ${signals.resolvedBy}` : ""}
                    </p>
                  ) : null}

                  {pending ? (
                    <div className="mt-4 flex flex-wrap items-start gap-2 border-t border-line pt-4">
                      <ActionButton
                        action={resolveCollectionDuplicate.bind(null, row.id, "MERGE")}
                        variant="primary"
                        confirm="Merge the candidate into the existing tender? The candidate will be archived and its documents moved."
                        pendingLabel="Merging…"
                      >
                        Merge into existing
                      </ActionButton>
                      <ActionButton
                        action={resolveCollectionDuplicate.bind(null, row.id, "KEEP_SEPARATE")}
                        variant="secondary"
                        pendingLabel="Saving…"
                      >
                        Keep separate
                      </ActionButton>
                      <ActionButton
                        action={resolveCollectionDuplicate.bind(null, row.id, "IGNORE")}
                        variant="ghost"
                        pendingLabel="Saving…"
                      >
                        Ignore suggestion
                      </ActionButton>
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
          <Pagination
            meta={data.meta}
            basePath="/admin/collection/duplicates"
            searchParams={{ decision }}
          />
        </>
      ) : (
        <EmptyState
          icon={<Copy className="h-8 w-8" />}
          title="No duplicate reviews for this filter"
          description="Choose another decision, or run a source to look for new matches."
        />
      )}
    </div>
  );
}
