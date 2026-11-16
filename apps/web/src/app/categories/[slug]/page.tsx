import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { CategoryDto } from "@paktenders/shared-types";
import { FilteredTenderList } from "@/components/tenders/filtered-tender-list";
import { ApiError, apiFetchSafe } from "@/lib/server-api";
import type { RawSearchParams } from "@/lib/search-params";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }>; searchParams: Promise<RawSearchParams> };

async function getCategory(slug: string): Promise<CategoryDto | null> {
  try {
    return await apiFetchSafe<CategoryDto | null>(`/v1/categories/${encodeURIComponent(slug)}`, null);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) return { title: "Category not found" };
  return {
    title: category.seoTitle ?? `${category.name} tenders in Pakistan`,
    description:
      category.metaDescription ??
      category.description ??
      `Browse open ${category.name.toLowerCase()} tenders across Pakistan.`,
    alternates: { canonical: `/categories/${category.slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) notFound();
  const filters = await searchParams;

  return (
    <FilteredTenderList
      title={`${category.name} tenders`}
      description={
        category.description ??
        `Open procurement opportunities classified under ${category.name}. Filter by province, city, department and closing date.`
      }
      breadcrumbs={[
        { href: "/categories", label: "Categories" },
        { label: category.name },
      ]}
      basePath={`/categories/${category.slug}`}
      locked={{ category: category.slug }}
      searchParams={filters}
    />
  );
}
