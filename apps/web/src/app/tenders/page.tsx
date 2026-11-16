import type { Metadata } from "next";
import Link from "next/link";
import type { CategoryDto, DepartmentDto, Paginated, ProvinceDto, TenderSummary } from "@paktenders/shared-types";
import { TenderCard } from "@/components/tenders/tender-card";
import { TenderFilters } from "@/components/tenders/tender-filters";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { EmptyState, Pagination } from "@/components/ui/states";
import { apiFetchSafe } from "@/lib/server-api";
import { firstValue, parsePositiveInt, tenderQueryString, type RawSearchParams } from "@/lib/search-params";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tender directory – search government & private tenders",
  description:
    "Search open tenders across Pakistan by keyword, category, province, city, department, type and closing date.",
  alternates: { canonical: "/tenders" },
};

const emptyPage: Paginated<TenderSummary> = {
  items: [],
  meta: { page: 1, pageSize: 12, total: 0, totalPages: 1 },
};

export default async function TendersPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const query = tenderQueryString(params);
  const page = parsePositiveInt(firstValue(params.page), 1);

  const [tenders, categories, provinces, departments] = await Promise.all([
    apiFetchSafe<Paginated<TenderSummary>>(`/v1/tenders?${query}`, emptyPage),
    apiFetchSafe<CategoryDto[]>("/v1/categories", []),
    apiFetchSafe<ProvinceDto[]>("/v1/locations/provinces", []),
    apiFetchSafe<DepartmentDto[]>("/v1/departments?limit=200", []),
  ]);

  const values = {
    q: firstValue(params.q),
    category: firstValue(params.category),
    province: firstValue(params.province),
    city: firstValue(params.city),
    department: firstValue(params.department),
    type: firstValue(params.type),
    closingWithinDays: firstValue(params.closingWithinDays),
    sort: firstValue(params.sort),
  };

  const activeCategory = categories.find((category) => category.slug === values.category);
  const activeProvince = provinces.find((province) => province.slug === values.province);
  const activeDepartment = departments.find((department) => department.slug === values.department);

  const headline = activeCategory
    ? `${activeCategory.name} tenders`
    : activeDepartment
      ? `${activeDepartment.name} tenders`
      : activeProvince
        ? `Tenders in ${activeProvince.name}`
        : "Tender directory";

  return (
    <div className="container-page py-8 lg:py-12">
      <Breadcrumbs items={[{ href: "/tenders", label: "Tenders" }]} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">{headline}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-500">
            {tenders.meta.total > 0
              ? `${tenders.meta.total.toLocaleString("en-PK")} tender${tenders.meta.total === 1 ? "" : "s"} matching your filters. Deadlines are shown in Pakistan Standard Time.`
              : "No tenders match the current filters. Try widening your search."}
          </p>
        </div>
        <Link href="/register" className="btn-primary shrink-0">
          Get tender alerts
        </Link>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[300px_1fr]">
        <TenderFilters
          categories={categories}
          provinces={provinces}
          departments={departments}
          values={values}
          locked={{
            category: activeCategory?.slug,
            province: activeProvince?.slug,
            department: activeDepartment?.slug,
          }}
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
                basePath="/tenders"
                searchParams={{
                  q: values.q,
                  category: values.category,
                  province: values.province,
                  city: values.city,
                  department: values.department,
                  type: values.type,
                  closingWithinDays: values.closingWithinDays,
                  sort: values.sort,
                }}
              />
            </>
          ) : (
            <EmptyState
              title="No matching tenders"
              description="Nothing matches these filters right now. Clear a filter or search a broader keyword."
              action={
                <Link href="/tenders" className="btn-secondary">
                  Clear all filters
                </Link>
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
