import type { Metadata } from "next";
import Link from "next/link";
import type { CategoryDto, DepartmentDto, ProvinceDto } from "@paktenders/shared-types";
import { Alert } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { CollectionNav } from "@/components/admin/collection-nav";
import {
  ConfidenceValue,
  IngestStatusBadge,
  OcrStatusBadge,
  MatchTypeLabel,
} from "@/components/admin/collection-badges";
import { CollectionReviewForm } from "@/components/admin/collection-review-form";
import { apiFetchAuthed, apiFetchSafe } from "@/lib/server-api";
import { formatDateTimePkt } from "@paktenders/shared-utils";
import { formatBytes, percent } from "@/lib/collection-utils";
import type { CollectionImportDetail } from "@/lib/collection-types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Review collected tender",
  robots: { index: false, follow: false },
};

function jsonPreview(value: unknown): string {
  if (value === null || value === undefined) return "—";
  try {
    const text = JSON.stringify(value, null, 2);
    return text.length > 12_000 ? `${text.slice(0, 12_000)}\n… truncated` : text;
  } catch {
    return String(value);
  }
}

export default async function CollectionImportReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [record, categories, departments, provinces] = await Promise.all([
    apiFetchAuthed<CollectionImportDetail | null>(
      `/v1/admin/collection/imports/${encodeURIComponent(id)}`,
      null,
    ),
    apiFetchSafe<CategoryDto[]>("/v1/categories", []),
    apiFetchSafe<DepartmentDto[]>("/v1/departments?limit=200", []),
    apiFetchSafe<ProvinceDto[]>("/v1/locations/provinces", []),
  ]);

  if (!record) {
    return (
      <div className="space-y-6">
        <CollectionNav />
        <Alert tone="error" title="Import could not be loaded">
          Return to the{" "}
          <Link href="/admin/collection/review" className="font-semibold underline">
            review queue
          </Link>
          .
        </Alert>
      </div>
    );
  }

  const tender = record.tender;
  const ready = categories.length > 0 && departments.length > 0 && provinces.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/collection/review" className="text-xs font-semibold text-emerald-700 hover:underline">
            ← Review queue
          </Link>
          <h1 className="mt-1 max-w-3xl text-2xl font-bold tracking-tight text-navy-900">{record.title}</h1>
          <p className="mt-1 text-sm text-ink-500">
            <Link href={`/admin/collection/sources/${record.source.id}`} className="font-semibold text-navy-900 hover:text-emerald-700">
              {record.source.name}
            </Link>{" "}
            · imported {formatDateTimePkt(record.createdAt)} · last seen {formatDateTimePkt(record.lastSeenAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <IngestStatusBadge status={record.status} />
          <ConfidenceValue value={record.confidence} />
          {record.run ? (
            <Link href={`/admin/collection/runs/${record.run.id}`} className="btn-secondary px-3 py-1.5 text-xs">
              View run
            </Link>
          ) : null}
          <a href={record.sourceUrl} target="_blank" rel="noreferrer noopener" className="btn-secondary px-3 py-1.5 text-xs">
            Open source page
          </a>
        </div>
      </div>

      <CollectionNav />

      {record.duplicateOfId ? (
        <Alert tone="warning" title="Possible duplicate">
          This record was matched to an existing tender
          {record.duplicateScore ? ` (${percent(record.duplicateScore)} similarity)` : ""}. Review the
          duplicate suggestions on the{" "}
          <Link href="/admin/collection/duplicates" className="font-semibold underline">
            duplicates screen
          </Link>{" "}
          before publishing.
        </Alert>
      ) : null}

      {record.reviews.some((review) => review.decision === "PENDING") ? (
        <Alert tone="warning" title="Pending duplicate decision">
          {record.reviews
            .filter((review) => review.decision === "PENDING")
            .map((review) => (
              <span key={review.id} className="mr-3 inline-block">
                <MatchTypeLabel type={review.matchType} /> · {percent(review.score)}
                {review.candidate ? ` · ${review.candidate.title}` : ""}
              </span>
            ))}
        </Alert>
      ) : null}

      {tender ? (
        <section className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-navy-900">Extracted record</h2>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge tone="navy">{tender.status.replaceAll("_", " ").toLowerCase()}</Badge>
              <Badge tone={tender.verificationStatus === "VERIFIED" ? "green" : "amber"}>
                {tender.verificationStatus.toLowerCase()}
              </Badge>
              <ConfidenceValue value={tender.extractionConfidence} label="extraction" />
            </div>
          </div>

          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Reference</dt>
              <dd className="text-ink-700">{tender.referenceNumber ?? "Not published"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Organisation</dt>
              <dd className="text-ink-700">{tender.department.name}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Category</dt>
              <dd className="text-ink-700">{tender.category.name}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Location</dt>
              <dd className="text-ink-700">
                {[tender.city?.name, tender.province.name].filter(Boolean).join(", ")}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Published</dt>
              <dd className="text-ink-700">{formatDateTimePkt(tender.publishedAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Closing</dt>
              <dd className="text-ink-700">{formatDateTimePkt(tender.closingAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Opening</dt>
              <dd className="text-ink-700">{formatDateTimePkt(tender.openingAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Estimated value</dt>
              <dd className="text-ink-700">{tender.estimatedValue ?? "Not published"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Bid security</dt>
              <dd className="text-ink-700">{tender.bidSecurityAmount ?? tender.bidSecurityDetails ?? "Not published"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Contact</dt>
              <dd className="text-ink-700">
                {[tender.contactName, tender.contactPhone, tender.contactEmail].filter(Boolean).join(" · ") || "Not published"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Source attribution</dt>
              <dd className="text-ink-700">{tender.sourceAttribution ?? "—"}</dd>
            </div>
          </dl>

          {tender.description ? (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Description</p>
              <p className="mt-1 whitespace-pre-line text-sm leading-6 text-ink-600">{tender.description}</p>
            </div>
          ) : null}

          {tender.requiredDocuments.length > 0 ? (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Required documents</p>
              <ul className="mt-1 list-inside list-disc text-sm text-ink-600">
                {tender.requiredDocuments.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : (
        <Alert tone="warning" title="No tender record">
          This import has no attached tender record, so it cannot be published from this screen.
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="card p-5">
          <h2 className="text-base font-bold text-navy-900">Review and edit</h2>
          <p className="mt-1 text-xs text-ink-500">
            Only change a field when the source document supports the change. Empty optional fields
            stay unpublished rather than guessed.
          </p>
          <div className="mt-4">
            {ready ? (
              <CollectionReviewForm
                record={record}
                categories={categories}
                departments={departments}
                provinces={provinces}
              />
            ) : (
              <Alert tone="error">
                Reference data (categories, departments or provinces) could not be loaded, so the
                record cannot be edited right now.
              </Alert>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="card p-5">
            <h2 className="text-base font-bold text-navy-900">Field provenance</h2>
            <p className="mt-1 text-xs text-ink-500">Where each value came from and how confident extraction was.</p>
            {tender && tender.provenance.length > 0 ? (
              <div className="mt-3 overflow-x-auto">
                <table className="table-shell text-xs">
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Origin</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tender.provenance.map((entry) => (
                      <tr key={entry.id}>
                        <td className="font-medium text-navy-900">{entry.field}</td>
                        <td>
                          <Badge tone={entry.source === "AI" ? "purple" : entry.source === "SOURCE" ? "green" : "slate"}>
                            {entry.source}
                          </Badge>
                          <p className="mt-1 text-[11px] text-ink-500">{percent(entry.confidence)}</p>
                        </td>
                        <td className="max-w-40 break-words text-ink-600">{entry.value ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-2 text-sm text-ink-500">No provenance rows recorded.</p>
            )}
          </section>

          <section className="card p-5">
            <h2 className="text-base font-bold text-navy-900">Stored document</h2>
            {record.document ? (
              <div className="mt-2 space-y-2 text-sm">
                <p className="break-words font-medium text-navy-900">{record.document.fileName ?? "Untitled"}</p>
                <div className="flex flex-wrap gap-2">
                  <OcrStatusBadge status={record.document.ocrStatus} />
                  <Badge tone="slate">{record.document.mimeType ?? "unknown type"}</Badge>
                  <Badge tone="slate">{formatBytes(record.document.contentLength)}</Badge>
                </div>
                <p className="text-xs text-ink-500">
                  {record.document.pageCount ? `${record.document.pageCount} page(s) · ` : ""}
                  OCR confidence {percent(record.document.ocrConfidence)} · extraction{" "}
                  {percent(record.document.extractionConfidence)}
                </p>
                <p className="break-all font-mono text-[11px] text-ink-500">sha256 {record.document.sha256}</p>
                <div className="flex flex-wrap gap-3 text-xs">
                  <a href={`/admin/collection/documents/${record.document.id}`} className="font-semibold text-emerald-700 hover:underline">
                    Download stored copy
                  </a>
                  <a href={record.document.url} target="_blank" rel="noreferrer noopener" className="text-ink-500 hover:underline">
                    Source URL
                  </a>
                </div>
                {record.document.error ? <p className="text-xs text-red-600">{record.document.error}</p> : null}
                {record.document.textContent ? (
                  <details className="pt-1">
                    <summary className="cursor-pointer text-xs font-semibold text-emerald-700">
                      Extracted text {record.document.textTruncated ? "(truncated)" : ""}
                    </summary>
                    <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-surface p-3 font-mono text-[11px] leading-5 text-ink-600">
                      {record.document.textContent}
                    </pre>
                  </details>
                ) : null}
              </div>
            ) : (
              <p className="mt-2 text-sm text-ink-500">No document was stored for this import.</p>
            )}
          </section>

          {tender && tender.documents.some((document) => document.fileUrl) ? (
            <section className="card p-5">
              <h2 className="text-base font-bold text-navy-900">Tender documents</h2>
              <ul className="mt-2 space-y-2 text-sm">
                {tender.documents
                  .filter((document) => document.fileUrl)
                  .map((document) => (
                    <li key={document.id}>
                      <a href={document.fileUrl} target="_blank" rel="noreferrer noopener" className="font-semibold text-emerald-700 hover:underline">
                        {document.fileName}
                      </a>
                      <p className="text-xs text-ink-500">{formatBytes(document.sizeBytes)}</p>
                    </li>
                  ))}
              </ul>
            </section>
          ) : null}

          <section className="card p-5">
            <h2 className="text-base font-bold text-navy-900">Raw payload</h2>
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-semibold text-emerald-700">Connector output</summary>
              <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-surface p-3 font-mono text-[11px] leading-5 text-ink-600">
                {jsonPreview(record.raw)}
              </pre>
            </details>
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-semibold text-emerald-700">Normalized fields</summary>
              <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-surface p-3 font-mono text-[11px] leading-5 text-ink-600">
                {jsonPreview(record.normalized)}
              </pre>
            </details>
          </section>
        </aside>
      </div>
    </div>
  );
}
