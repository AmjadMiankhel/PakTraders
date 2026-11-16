import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import type { CategoryDto, ProvinceDto } from "@paktenders/shared-types";
import { formatDatePkt } from "@paktenders/shared-utils";
import { ActionForm } from "@/components/forms/action-form";
import { ActionButton } from "@/components/forms/action-button";
import { EmptyState } from "@/components/ui/states";
import { FormRow, Input, Select } from "@/components/ui/field";
import { apiFetchAuthed, apiFetchSafe } from "@/lib/server-api";
import { createSavedSearch, deleteSavedSearch } from "@/lib/actions";
import type { SavedSearchDto } from "@/lib/account-types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Saved searches",
  robots: { index: false, follow: false },
};

function querySummary(query: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const key of ["q", "category", "province", "city", "department", "type"]) {
    const value = query[key];
    if (typeof value === "string" && value.trim()) parts.push(`${key}: ${value}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "All tenders";
}

export default async function SavedSearchesPage() {
  const [searches, categories, provinces] = await Promise.all([
    apiFetchAuthed<SavedSearchDto[]>("/v1/me/saved-searches", []),
    apiFetchSafe<CategoryDto[]>("/v1/categories", []),
    apiFetchSafe<ProvinceDto[]>("/v1/locations/provinces", []),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">Saved searches</h1>
        <p className="mt-1 text-sm text-ink-500">
          Save filter combinations you run often and reopen them with one click.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          {searches.length > 0 ? (
            <div className="card divide-y divide-line">
              {searches.map((search) => {
                const params = new URLSearchParams();
                for (const key of ["q", "category", "province", "city", "department", "type"]) {
                  const value = search.queryJson[key];
                  if (typeof value === "string" && value.trim()) params.set(key, value);
                }
                const href = params.toString() ? `/tenders?${params.toString()}` : "/tenders";
                return (
                  <div key={search.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-navy-900">{search.name}</p>
                      <p className="mt-0.5 text-xs text-ink-500">{querySummary(search.queryJson)}</p>
                      <p className="mt-0.5 text-[11px] text-ink-500">
                        Saved {formatDatePkt(search.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href={href} className="btn-secondary px-3 py-1.5 text-xs">
                        Run search
                      </Link>
                      <ActionButton
                        action={deleteSavedSearch.bind(null, search.id)}
                        variant="danger"
                        confirm="Delete this saved search?"
                      >
                        Delete
                      </ActionButton>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="No saved searches"
              description="Save a search from the tender directory, or create one with the form."
              icon={<Search className="h-7 w-7" />}
            />
          )}
        </div>

        <section className="card h-fit p-5">
          <h2 className="text-base font-bold text-navy-900">Save a new search</h2>
          <ActionForm action={createSavedSearch} submitLabel="Save search" className="mt-4" successMessage="Search saved">
            <FormRow label="Name" htmlFor="search-name">
              <Input id="search-name" name="name" required minLength={2} maxLength={80} placeholder="e.g. Solar tenders in Punjab" />
            </FormRow>
            <FormRow label="Keyword" htmlFor="search-q">
              <Input id="search-q" name="q" placeholder="e.g. solar" />
            </FormRow>
            <FormRow label="Category" htmlFor="search-category">
              <Select id="search-category" name="category" defaultValue="">
                <option value="">Any category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.slug}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </FormRow>
            <FormRow label="Province" htmlFor="search-province">
              <Select id="search-province" name="province" defaultValue="">
                <option value="">Any province</option>
                {provinces.map((province) => (
                  <option key={province.id} value={province.slug}>
                    {province.name}
                  </option>
                ))}
              </Select>
            </FormRow>
          </ActionForm>
        </section>
      </div>
    </div>
  );
}
