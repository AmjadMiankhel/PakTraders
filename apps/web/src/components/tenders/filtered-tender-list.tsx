import Link from "next/link";
import type { CategoryDto, DepartmentDto, Paginated, ProvinceDto, TenderSummary } from "@paktenders/shared-types";
import { TenderCard } from "@/components/tenders/tender-card";
import { TenderFilters } from "@/components/tenders/tender-filters";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { EmptyState, Pagination } from "@/components/ui/states";
import { apiFetchSafe } from "@/lib/server-api";
import { parsePositiveInt, type RawSearchParams } from "@/lib/search-params";
import { firstValue } from "@/lib/search-params";

const emptyPage: Paginated<TenderSummary> = {
  items: [],
  meta: { page: 1, pageSize: 12, total: 0, totalPages: 1 },
};

/**
 * Shared listing used by category, province and department landing pages.
 * The locked filter is forced server-side so a page cannot show tenders that
 * do not belong to the entity in its heading.
 */
export async function FilteredTenderList({
  title,
  description,
  breadcrumbs,
  basePath,
  locked,
  searchParams,
  headerAction,
}: {
  title: string;
  description: string;
  breadcrumbs: Array<{ href?: string; label: string }>;
  basePath: string;
  locked: { category?: string; province?: string; department?: string };
  searchParams: RawSearchParams;
  headerAction?: React.ReactNode;
}) {
  const page = parsePositiveInt(firstValue(searchParams.page), 1);
  const query = new URLSearchParams();
  query.set("pageSize", "12");
  query.set("page", String(page));
  if (locked.category) query.set("category", locked.category);
  if (locked.province) query.set("province", locked.province);
  if (locked.department) query.set("department", locked.department);

  for (const key of ["q", "city", "type", "closingWithinDays", "sort"]) {
    const value = firstValue(searchParams[key]);
    if (value) query.set(key, value);
  }

  const [tenders, categories, provinces, departments] = await Promise.all([
    apiFetchSafe<Paginated<TenderSummary>>(`/v1/tenders?${query.toString()}`, emptyPage),
    apiFetchSafe<CategoryDto[]>("/v1/categories", []),
    apiFetchSafe<ProvinceDto[]>("/v1/locations/provinces", []),
    apiFetchSafe<DepartmentDto[]>("/v1/departments?limit=200", []),
  ]);

  const values = {
    q: firstValue(searchParams.q),
    category: locked.category ?? firstValue(searchParams.category),
    province: locked.province ?? firstValue(searchParams.province),
    city: firstValue(searchParams.city),
    department: locked.department ?? firstValue(searchParams.department),
    type: firstValue(searchParams.type),
    closingWithinDays: firstValue(searchParams.closingWithinDays),
    sort: firstValue(searchParams.sort),
  };

  return (
    <div className="container-page py-8 lg:py-12">
      <Breadcrumbs items={breadcrumbs} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-500">{description}</p>
        </div>
        {headerAction}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[300px_1fr]">
        <TenderFilters
          categories={categories}
          provinces={provinces}
          departments={departments}
          values={values}
          action={basePath}
          locked={locked}
        />
        <div>
          {tenders.items.length > 0 ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {tenders.items.map((tender) => (
                  <TenderCard key={tender.id} tender={tender} />
                ))}
              </div>
              <Pagination
                meta={tenders.meta}
                basePath={basePath}
                searchParams={{
                  q: values.q,
                  city: values.city,
                  type: values.type,
                  closingWithinDays: values.closingWithinDays,
                  sort: values.sort,
                }}
              />
            </>
          ) : (
            <EmptyState
              title="No open tenders here yet"
              description="There are no published tenders for this selection right now. Explore the full directory or clear your filters."
              action={
                <Link href="/tenders" className="btn-secondary">
                  Browse all tenders
                </Link>
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
