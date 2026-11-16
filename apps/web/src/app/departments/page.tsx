import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Globe } from "lucide-react";
import type { DepartmentDto, ProvinceDto } from "@paktenders/shared-types";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { EmptyState } from "@/components/ui/states";
import { apiFetchSafe } from "@/lib/server-api";
import { firstValue } from "@/lib/search-params";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Government departments & buyers",
  description:
    "Browse Pakistani government departments, public bodies and organisations that publish procurement notices.",
  alternates: { canonical: "/departments" },
};

export default async function DepartmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const province = firstValue(params.province);

  const [departments, provinces] = await Promise.all([
    apiFetchSafe<DepartmentDto[]>(
      `/v1/departments?limit=200${province ? `&province=${encodeURIComponent(province)}` : ""}`,
      [],
    ),
    apiFetchSafe<ProvinceDto[]>("/v1/locations/provinces", []),
  ]);

  const grouped = departments.reduce<Record<string, DepartmentDto[]>>((acc, department) => {
    const key = department.province?.name ?? "Federal / national";
    (acc[key] ??= []).push(department);
    return acc;
  }, {});

  return (
    <div className="container-page py-8 lg:py-12">
      <Breadcrumbs items={[{ href: "/departments", label: "Departments" }]} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-navy-900">Departments &amp; buyers</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-500">
            Public departments, authorities and organisations that issue procurement notices. Follow
            a department to see all of its published tenders.
          </p>
        </div>
        <form action="/departments" method="get" className="flex items-center gap-2">
          <label htmlFor="province" className="sr-only">
            Filter by province
          </label>
          <select id="province" name="province" defaultValue={province ?? ""} className="select w-56">
            <option value="">All provinces</option>
            {provinces.map((item) => (
              <option key={item.id} value={item.slug}>
                {item.name}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-secondary">
            Filter
          </button>
        </form>
      </div>

      {departments.length > 0 ? (
        <div className="mt-8 space-y-8">
          {Object.entries(grouped).map(([group, items]) => (
            <section key={group}>
              <h2 className="text-sm font-bold uppercase tracking-wide text-ink-500">{group}</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((department) => (
                  <div key={department.id} className="card card-hover flex flex-col p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-700">
                        <Building2 className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold leading-5 text-navy-900">
                          <Link href={`/departments/${department.slug}`} className="hover:text-emerald-700">
                            {department.name}
                          </Link>
                        </h3>
                        <p className="mt-0.5 text-[11px] text-ink-500">
                          {department.shortName ? `${department.shortName} · ` : ""}
                          {department.type.replaceAll("_", " ").toLowerCase()}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
                      <span className="text-xs text-ink-500">
                        {department.tenderCount} open tender{department.tenderCount === 1 ? "" : "s"}
                      </span>
                      <div className="flex items-center gap-3">
                        {department.website ? (
                          <a
                            href={department.website}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className="text-ink-500 hover:text-emerald-700"
                            aria-label={`${department.name} website`}
                          >
                            <Globe className="h-4 w-4" />
                          </a>
                        ) : null}
                        <Link href={`/departments/${department.slug}`} className="text-xs font-semibold text-emerald-700 hover:underline">
                          View →
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="mt-8">
          <EmptyState
            title="No departments found"
            description="No departments match this province filter. Try selecting another province."
            action={
              <Link href="/departments" className="btn-secondary">
                Clear filter
              </Link>
            }
          />
        </div>
      )}
    </div>
  );
}
