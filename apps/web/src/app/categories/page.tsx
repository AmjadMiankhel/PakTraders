import type { Metadata } from "next";
import Link from "next/link";
import type { CategoryDto } from "@paktenders/shared-types";
import { CategoryIcon } from "@/components/category-icon";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { EmptyState } from "@/components/ui/states";
import { apiFetchSafe } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tender categories – browse by sector",
  description:
    "Browse Pakistani procurement opportunities by sector: construction, IT, healthcare, solar, transport, consultancy, education and more.",
  alternates: { canonical: "/categories" },
};

export default async function CategoriesPage() {
  const categories = await apiFetchSafe<CategoryDto[]>("/v1/categories", []);
  const sorted = [...categories].sort((a, b) => b.tenderCount - a.tenderCount || a.name.localeCompare(b.name));

  return (
    <div className="container-page py-8 lg:py-12">
      <Breadcrumbs items={[{ href: "/categories", label: "Categories" }]} />
      <h1 className="text-3xl font-bold tracking-tight text-navy-900">Browse tenders by category</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-500">
        Every tender is classified into a procurement sector. Choose a category to see open
        opportunities, or use the directory filters for a more precise search.
      </p>

      {sorted.length > 0 ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((category) => (
            <Link
              key={category.id}
              href={`/categories/${category.slug}`}
              className="card card-hover flex flex-col p-5"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-50 text-navy-700">
                  <CategoryIcon name={category.icon} className="h-5 w-5" />
                </span>
                <span className="badge bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                  {category.tenderCount} open
                </span>
              </div>
              <h2 className="mt-4 text-base font-semibold text-navy-900">{category.name}</h2>
              {category.description ? (
                <p className="mt-2 text-sm leading-6 text-ink-500">{category.description}</p>
              ) : null}
              <span className="mt-4 text-xs font-semibold text-emerald-700">View tenders →</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-8">
          <EmptyState
            title="Categories are not available"
            description="The category catalogue has not been loaded yet. Please check back shortly."
          />
        </div>
      )}

      <div className="mt-10 rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-base font-semibold text-navy-900">Looking for something specific?</h2>
        <p className="mt-1 text-sm text-ink-500">
          Search the full directory by keyword, department, city or closing date.
        </p>
        <Link href="/tenders" className="btn-primary mt-4">
          Search all tenders
        </Link>
      </div>
    </div>
  );
}
