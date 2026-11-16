import type { Metadata } from "next";
import Link from "next/link";
import { MapPin } from "lucide-react";
import type { ProvinceDto } from "@paktenders/shared-types";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { EmptyState } from "@/components/ui/states";
import { apiFetchSafe } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tender locations – browse by province and city",
  description:
    "Browse procurement opportunities across Punjab, Sindh, Khyber Pakhtunkhwa, Balochistan, Islamabad, AJK and Gilgit-Baltistan.",
  alternates: { canonical: "/locations" },
};

export default async function LocationsPage() {
  const provinces = await apiFetchSafe<ProvinceDto[]>("/v1/locations/provinces", []);

  return (
    <div className="container-page py-8 lg:py-12">
      <Breadcrumbs items={[{ href: "/locations", label: "Locations" }]} />
      <h1 className="text-3xl font-bold tracking-tight text-navy-900">Browse tenders by location</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-500">
        Procurement is published at federal, provincial and district level. Choose a province or
        territory to see its cities and open opportunities.
      </p>

      {provinces.length > 0 ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {provinces.map((province) => (
            <div key={province.id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-navy-900">
                    <Link href={`/locations/${province.slug}`} className="hover:text-emerald-700">
                      {province.name}
                    </Link>
                  </h2>
                  <p className="mt-1 text-xs text-ink-500">
                    {province.code} · {province.tenderCount} open tender
                    {province.tenderCount === 1 ? "" : "s"}
                  </p>
                </div>
                <span className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
                  <MapPin className="h-4 w-4" />
                </span>
              </div>
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {province.cities.slice(0, 8).map((city) => (
                  <li key={city.id}>
                    <Link
                      href={`/tenders?province=${province.slug}&city=${city.slug}`}
                      className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[11px] text-ink-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                    >
                      {city.name}
                      {city.tenderCount > 0 ? <span className="text-emerald-700">({city.tenderCount})</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href={`/locations/${province.slug}`}
                className="mt-4 inline-block text-xs font-semibold text-emerald-700 hover:underline"
              >
                View {province.name} tenders →
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-8">
          <EmptyState title="Locations are unavailable" description="The location catalogue could not be loaded." />
        </div>
      )}
    </div>
  );
}
