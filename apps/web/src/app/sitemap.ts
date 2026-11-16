import type { MetadataRoute } from "next";
import type { CategoryDto, DepartmentDto, Paginated, ProvinceDto, TenderSummary } from "@paktenders/shared-types";
import { apiFetchSafe } from "@/lib/server-api";
import { siteConfig } from "@/lib/site";

export const revalidate = 3600;

const baseUrl = siteConfig.url.replace(/\/+$/, "");

const staticPaths: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }> = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/tenders", priority: 0.9, changeFrequency: "hourly" },
  { path: "/categories", priority: 0.7, changeFrequency: "weekly" },
  { path: "/locations", priority: 0.7, changeFrequency: "weekly" },
  { path: "/departments", priority: 0.7, changeFrequency: "weekly" },
  { path: "/pricing", priority: 0.6, changeFrequency: "monthly" },
  { path: "/about", priority: 0.4, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.4, changeFrequency: "monthly" },
  { path: "/terms", priority: 0.2, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.2, changeFrequency: "yearly" },
  { path: "/disclaimer", priority: 0.2, changeFrequency: "yearly" },
];

const emptyTenders: Paginated<TenderSummary> = {
  items: [],
  meta: { page: 1, pageSize: 100, total: 0, totalPages: 1 },
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, provinces, departments, firstPage] = await Promise.all([
    apiFetchSafe<CategoryDto[]>("/v1/categories", []),
    apiFetchSafe<ProvinceDto[]>("/v1/locations/provinces", []),
    apiFetchSafe<DepartmentDto[]>("/v1/departments?limit=200", []),
    apiFetchSafe<Paginated<TenderSummary>>("/v1/tenders?page=1&pageSize=100&sort=newest", emptyTenders),
  ]);

  const tenderPages: TenderSummary[] = [...firstPage.items];
  const maxPages = Math.min(firstPage.meta.totalPages, 50);
  for (let page = 2; page <= maxPages; page += 1) {
    const next = await apiFetchSafe<Paginated<TenderSummary>>(
      `/v1/tenders?page=${page}&pageSize=100&sort=newest`,
      emptyTenders,
    );
    tenderPages.push(...next.items);
  }

  const now = new Date();

  return [
    ...staticPaths.map((entry) => ({
      url: `${baseUrl}${entry.path}`,
      lastModified: now,
      changeFrequency: entry.changeFrequency,
      priority: entry.priority,
    })),
    ...categories.map((category) => ({
      url: `${baseUrl}/categories/${category.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...provinces.map((province) => ({
      url: `${baseUrl}/locations/${province.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...departments.map((department) => ({
      url: `${baseUrl}/departments/${department.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
    ...tenderPages.map((tender) => ({
      url: `${baseUrl}/tenders/${tender.slug}`,
      lastModified: tender.publishedAt ? new Date(tender.publishedAt) : now,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ];
}
