import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ProvinceDto } from "@paktenders/shared-types";
import { FilteredTenderList } from "@/components/tenders/filtered-tender-list";
import { apiFetchSafe } from "@/lib/server-api";
import type { RawSearchParams } from "@/lib/search-params";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }>; searchParams: Promise<RawSearchParams> };

async function getProvince(slug: string): Promise<ProvinceDto | null> {
  const provinces = await apiFetchSafe<ProvinceDto[]>("/v1/locations/provinces", []);
  return provinces.find((province) => province.slug === slug) ?? null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const province = await getProvince(slug);
  if (!province) return { title: "Location not found" };
  return {
    title: `Tenders in ${province.name}`,
    description: `Browse open government, private and NGO tenders in ${province.name}, Pakistan. Filter by city, category and closing date.`,
    alternates: { canonical: `/locations/${province.slug}` },
  };
}

export default async function ProvincePage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const province = await getProvince(slug);
  if (!province) notFound();
  const filters = await searchParams;

  const cityLinks =
    province.cities.length > 0 ? (
      <div className="flex flex-wrap gap-1.5">
        {province.cities.map((city) => (
          <Link
            key={city.id}
            href={`/tenders?province=${province.slug}&city=${city.slug}`}
            className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1 text-[11px] text-ink-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
          >
            {city.name}
            {city.tenderCount > 0 ? <span className="text-emerald-700">({city.tenderCount})</span> : null}
          </Link>
        ))}
      </div>
    ) : null;

  return (
    <>
      <div className="border-b border-line bg-surface">
        <div className="container-page py-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Cities in {province.name}</p>
          <div className="mt-2">{cityLinks}</div>
        </div>
      </div>
      <FilteredTenderList
        title={`Tenders in ${province.name}`}
        description={`Open procurement opportunities published for ${province.name}. Use the filters to narrow results by city, department and closing date.`}
        breadcrumbs={[
          { href: "/locations", label: "Locations" },
          { label: province.name },
        ]}
        basePath={`/locations/${province.slug}`}
        locked={{ province: province.slug }}
        searchParams={filters}
      />
    </>
  );
}
