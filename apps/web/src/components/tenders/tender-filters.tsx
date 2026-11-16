import Link from "next/link";
import { Search, SlidersHorizontal, X } from "lucide-react";
import type { CategoryDto, DepartmentDto, ProvinceDto, TenderType } from "@paktenders/shared-types";

const TYPES: Array<{ value: TenderType; label: string }> = [
  { value: "GOVERNMENT", label: "Government" },
  { value: "PRIVATE", label: "Private" },
  { value: "NGO", label: "NGO" },
  { value: "AUCTION", label: "Auction" },
  { value: "CONSULTANCY", label: "Consultancy" },
  { value: "NEWSPAPER", label: "Newspaper" },
];

export type TenderFilterValues = {
  q?: string;
  category?: string;
  province?: string;
  city?: string;
  department?: string;
  type?: string;
  closingWithinDays?: string;
  sort?: string;
};

export function TenderFilters({
  categories,
  provinces,
  departments,
  values,
  action = "/tenders",
  locked,
}: {
  categories: CategoryDto[];
  provinces: ProvinceDto[];
  departments: DepartmentDto[];
  values: TenderFilterValues;
  action?: string;
  locked?: { category?: string; province?: string; department?: string };
}) {
  const hasFilters = Object.entries(values).some(
    ([key, value]) => key !== "sort" && Boolean(value),
  );

  return (
    <aside className="lg:sticky lg:top-24">
      <form action={action} method="get" className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold text-navy-900">
            <SlidersHorizontal className="h-4 w-4 text-emerald-600" /> Filter tenders
          </h2>
          {hasFilters ? (
            <Link href={action} className="inline-flex items-center gap-1 text-xs font-medium text-ink-500 hover:text-red-600">
              <X className="h-3.5 w-3.5" /> Clear
            </Link>
          ) : null}
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="q" className="label">
              Keywords
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500/60" />
              <input
                id="q"
                name="q"
                defaultValue={values.q ?? ""}
                placeholder="Title, description or reference number"
                className="input pl-9"
              />
            </div>
          </div>

          {!locked?.category ? (
            <div>
              <label htmlFor="category" className="label">
                Category
              </label>
              <select id="category" name="category" defaultValue={values.category ?? ""} className="select">
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.slug}>
                    {category.name} ({category.tenderCount})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <input type="hidden" name="category" value={locked.category} />
          )}

          {!locked?.province ? (
            <div>
              <label htmlFor="province" className="label">
                Province / territory
              </label>
              <select id="province" name="province" defaultValue={values.province ?? ""} className="select">
                <option value="">All of Pakistan</option>
                {provinces.map((province) => (
                  <option key={province.id} value={province.slug}>
                    {province.name} ({province.tenderCount})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <input type="hidden" name="province" value={locked.province} />
          )}

          <div>
            <label htmlFor="city" className="label">
              City
            </label>
            <select id="city" name="city" defaultValue={values.city ?? ""} className="select">
              <option value="">All cities</option>
              {provinces.map((province) =>
                province.cities.length > 0 ? (
                  <optgroup key={province.id} label={province.name}>
                    {province.cities.map((city) => (
                      <option key={city.id} value={city.slug}>
                        {city.name}
                      </option>
                    ))}
                  </optgroup>
                ) : null,
              )}
            </select>
          </div>

          {!locked?.department ? (
            <div>
              <label htmlFor="department" className="label">
                Department
              </label>
              <select id="department" name="department" defaultValue={values.department ?? ""} className="select">
                <option value="">All departments</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.slug}>
                    {department.shortName ?? department.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <input type="hidden" name="department" value={locked.department} />
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="type" className="label">
                Type
              </label>
              <select id="type" name="type" defaultValue={values.type ?? ""} className="select">
                <option value="">Any type</option>
                {TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="closingWithinDays" className="label">
                Closing in
              </label>
              <select
                id="closingWithinDays"
                name="closingWithinDays"
                defaultValue={values.closingWithinDays ?? ""}
                className="select"
              >
                <option value="">Any time</option>
                <option value="3">3 days</option>
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="sort" className="label">
              Sort by
            </label>
            <select id="sort" name="sort" defaultValue={values.sort ?? "newest"} className="select">
              <option value="newest">Newest first</option>
              <option value="closing">Closing soonest</option>
              <option value="relevance">Relevance</option>
            </select>
          </div>

          <button type="submit" className="btn-primary w-full">
            Apply filters
          </button>
        </div>
      </form>

      <div className="mt-4 rounded-xl border border-line bg-surface p-4 text-xs leading-5 text-ink-500">
        <p className="font-semibold text-ink-700">About demo records</p>
        <p className="mt-1">
          Records marked <span className="font-semibold text-violet-700">Demo</span> are sample data
          for evaluating the platform. They are not real procurement notices.
        </p>
      </div>
    </aside>
  );
}
