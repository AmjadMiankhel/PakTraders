import type { Metadata } from "next";
import { Bookmark } from "lucide-react";
import { TenderCard } from "@/components/tenders/tender-card";
import { EmptyState, Pagination } from "@/components/ui/states";
import { ButtonLink } from "@/components/ui/button";
import { apiFetchAuthed } from "@/lib/server-api";
import type { SavedTendersResponse } from "@/lib/account-types";
import { firstValue, parsePositiveInt, type RawSearchParams } from "@/lib/search-params";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Saved tenders",
  robots: { index: false, follow: false },
};

const empty: SavedTendersResponse = {
  items: [],
  meta: { page: 1, pageSize: 12, total: 0, totalPages: 1 },
};

export default async function SavedTendersPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const page = parsePositiveInt(firstValue(params.page), 1);
  const data = await apiFetchAuthed<SavedTendersResponse>(
    `/v1/me/saved-tenders?page=${page}&pageSize=12`,
    empty,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">Saved tenders</h1>
        <p className="mt-1 text-sm text-ink-500">
          {data.meta.total.toLocaleString("en-PK")} saved tender{data.meta.total === 1 ? "" : "s"}.
          Saved tenders sync with the mobile apps.
        </p>
      </div>

      {data.items.length > 0 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.items.map((tender) => (
              <TenderCard key={tender.id} tender={tender} />
            ))}
          </div>
          <Pagination meta={data.meta} basePath="/dashboard/saved" />
        </>
      ) : (
        <EmptyState
          title="No saved tenders"
          description="Open a tender and use the Save button to keep it here for later."
          icon={<Bookmark className="h-7 w-7" />}
          action={<ButtonLink href="/tenders">Browse tenders</ButtonLink>}
        />
      )}
    </div>
  );
}
