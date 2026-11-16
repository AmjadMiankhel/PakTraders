import Link from "next/link";
import { ArrowRight, MapPin, Search } from "lucide-react";
import type { CategoryDto, ProvinceDto } from "@paktenders/shared-types";

export function HeroSearch({
  categories,
  provinces,
}: {
  categories: CategoryDto[];
  provinces: ProvinceDto[];
}) {
  return (
    <form action="/tenders" method="get" className="rounded-2xl border border-white/15 bg-white p-3 shadow-lifted sm:p-4">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-500/60" />
          <input
            name="q"
            placeholder="Search tenders, departments, reference numbers…"
            className="input h-12 pl-11 text-base"
            aria-label="Search tenders"
          />
        </div>
        <button type="submit" className="btn-primary h-12 px-6">
          Search tenders
        </button>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <select name="category" className="select h-11 text-sm" aria-label="Category">
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.slug}>
              {category.name}
            </option>
          ))}
        </select>
        <select name="province" className="select h-11 text-sm" aria-label="Province">
          <option value="">All of Pakistan</option>
          {provinces.map((province) => (
            <option key={province.id} value={province.slug}>
              {province.name}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-500">
        <span className="inline-flex items-center gap-1 font-medium">
          <MapPin className="h-3.5 w-3.5 text-emerald-600" /> Popular:
        </span>
        {["construction-civil-engineering", "it-technology", "medical-health", "solar-energy"].map((slug) => {
          const category = categories.find((item) => item.slug === slug);
          if (!category) return null;
          return (
            <Link key={slug} href={`/tenders?category=${slug}`} className="hover:text-emerald-700">
              {category.name}
            </Link>
          );
        })}
        <Link href="/tenders" className="ml-auto inline-flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-800">
          Browse all <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </form>
  );
}
