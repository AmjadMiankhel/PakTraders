import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/feedback";
import { CollectionNav } from "@/components/admin/collection-nav";
import { CollectionManualImportForm } from "@/components/admin/collection-manual-import-form";
import { apiFetchAuthed } from "@/lib/server-api";
import type { CollectionSourcesResponse } from "@/lib/collection-types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Manual tender import",
  robots: { index: false, follow: false },
};

const empty: CollectionSourcesResponse = {
  items: [],
  meta: { page: 1, pageSize: 100, total: 0, totalPages: 1 },
};

export default async function CollectionManualImportPage() {
  const sources = await apiFetchAuthed<CollectionSourcesResponse>(
    "/v1/admin/collection/sources?pageSize=100",
    empty,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">Manual tender import</h1>
        <p className="mt-1 text-sm text-ink-500">
          Record a notice an administrator has collected directly from a permitted source. Imports
          still go through duplicate checks and review.
        </p>
      </div>

      <CollectionNav />

      <Alert tone="info" title="Only import notices you are allowed to use">
        Paste the public source URL or upload the original document so the record can be traced and
        verified. Do not import from pages that require bypassing a login, CAPTCHA or paywall.
      </Alert>

      {sources.items.length > 0 ? (
        <section className="card p-5">
          <CollectionManualImportForm sources={sources.items} />
        </section>
      ) : (
        <Alert tone="error" title="No sources available">
          The source registry could not be loaded. Check the API connection before importing a notice.
          You can still browse the{" "}
          <Link href="/admin/collection/sources" className="font-semibold underline">
            source registry
          </Link>
          .
        </Alert>
      )}

      <p className="text-xs text-ink-500">
        After import, the record opens in the review queue. It is published only when you choose
        “Publish tender”, unless the selected source explicitly allows automatic publishing above its
        confidence threshold.
      </p>
    </div>
  );
}
