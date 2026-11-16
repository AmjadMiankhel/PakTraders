import type { Metadata } from "next";
import Link from "next/link";
import type { CategoryDto, DepartmentDto, ProvinceDto } from "@paktenders/shared-types";
import { Alert } from "@/components/ui/feedback";
import { TenderForm } from "@/components/admin/tender-form";
import { apiFetchSafe } from "@/lib/server-api";
import type { TenderSourceDto } from "@/lib/admin-types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create tender",
  robots: { index: false, follow: false },
};

export default async function NewTenderPage() {
  const [categories, departments, provinces, sources] = await Promise.all([
    apiFetchSafe<CategoryDto[]>("/v1/categories", []),
    apiFetchSafe<DepartmentDto[]>("/v1/departments?limit=200", []),
    apiFetchSafe<ProvinceDto[]>("/v1/locations/provinces", []),
    apiFetchSafe<TenderSourceDto[]>("/v1/sources", []),
  ]);

  const ready = categories.length > 0 && departments.length > 0 && provinces.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900">Create tender</h1>
          <p className="mt-1 text-sm text-ink-500">
            Records start as drafts. Publish only after the source has been verified.
          </p>
        </div>
        <Link href="/admin/tenders" className="btn-secondary">
          Back to tenders
        </Link>
      </div>

      {!ready ? (
        <Alert tone="error">
          Categories, departments or provinces could not be loaded, so a tender cannot be created
          right now. Check the API connection and reference data.
        </Alert>
      ) : (
        <div className="card p-5">
          <TenderForm
            mode="create"
            categories={categories}
            departments={departments}
            provinces={provinces}
            sources={sources}
          />
        </div>
      )}
    </div>
  );
}
