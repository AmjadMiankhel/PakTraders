import type { Metadata } from "next";
import Link from "next/link";
import type { CategoryDto, DepartmentDto, ProvinceDto } from "@paktenders/shared-types";
import { formatDateTimePkt } from "@paktenders/shared-utils";
import { Alert } from "@/components/ui/feedback";
import { Badge, TenderStatusBadge, VerificationBadge } from "@/components/ui/badge";
import { ActionButton } from "@/components/forms/action-button";
import { TenderForm } from "@/components/admin/tender-form";
import { apiFetchAuthed, apiFetchSafe } from "@/lib/server-api";
import { setTenderStatus, verifyTender } from "@/lib/actions";
import type { AdminTenderDetail, TenderSourceDto } from "@/lib/admin-types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edit tender",
  robots: { index: false, follow: false },
};

export default async function EditTenderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [tender, categories, departments, provinces, sources] = await Promise.all([
    apiFetchAuthed<AdminTenderDetail | null>(`/v1/admin/tenders/${encodeURIComponent(id)}`, null),
    apiFetchSafe<CategoryDto[]>("/v1/categories", []),
    apiFetchSafe<DepartmentDto[]>("/v1/departments?limit=200", []),
    apiFetchSafe<ProvinceDto[]>("/v1/locations/provinces", []),
    apiFetchSafe<TenderSourceDto[]>("/v1/sources", []),
  ]);

  if (!tender) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">Tender not found</h1>
        <Alert tone="error">This tender does not exist or has been removed.</Alert>
        <Link href="/admin/tenders" className="btn-secondary">
          Back to tenders
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-navy-900">Edit tender</h1>
            <TenderStatusBadge status={tender.status} />
            <VerificationBadge status={tender.verificationStatus} />
            {tender.isDemo ? <Badge tone="purple">Demo</Badge> : null}
          </div>
          <p className="mt-1 text-xs text-ink-500">
            Updated {formatDateTimePkt(tender.updatedAt)} · {tender.viewCount} views ·{" "}
            <Link href={`/tenders/${tender.slug}`} className="text-emerald-700 hover:underline">
              view public page
            </Link>
          </p>
        </div>
        <Link href="/admin/tenders" className="btn-secondary">
          Back to tenders
        </Link>
      </div>

      <div className="card flex flex-wrap items-center gap-2 p-4">
        <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
          Quick actions
        </span>
        {tender.status !== "PUBLISHED" ? (
          <ActionButton action={setTenderStatus.bind(null, tender.id, "PUBLISHED")} variant="primary">
            Publish
          </ActionButton>
        ) : (
          <ActionButton action={setTenderStatus.bind(null, tender.id, "CLOSED")}>Close</ActionButton>
        )}
        <ActionButton action={setTenderStatus.bind(null, tender.id, "PENDING_VERIFICATION")}>
          Request verification
        </ActionButton>
        {tender.verificationStatus !== "VERIFIED" ? (
          <ActionButton action={verifyTender.bind(null, tender.id, "VERIFIED")}>
            Mark verified
          </ActionButton>
        ) : (
          <ActionButton action={verifyTender.bind(null, tender.id, "UNVERIFIED")}>
            Remove verification
          </ActionButton>
        )}
        <ActionButton action={setTenderStatus.bind(null, tender.id, "ARCHIVED")} variant="danger">
          Archive
        </ActionButton>
      </div>

      <div className="card p-5">
        <TenderForm
          mode="edit"
          tender={tender}
          categories={categories}
          departments={departments}
          provinces={provinces}
          sources={sources}
        />
      </div>
    </div>
  );
}
