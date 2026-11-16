import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import type { DepartmentDto } from "@paktenders/shared-types";
import { FilteredTenderList } from "@/components/tenders/filtered-tender-list";
import { apiFetchSafe } from "@/lib/server-api";
import type { RawSearchParams } from "@/lib/search-params";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }>; searchParams: Promise<RawSearchParams> };

async function getDepartment(slug: string): Promise<DepartmentDto | null> {
  return apiFetchSafe<DepartmentDto | null>(`/v1/departments/${encodeURIComponent(slug)}`, null);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const department = await getDepartment(slug);
  if (!department) return { title: "Department not found" };
  return {
    title: `${department.name} tenders`,
    description: `Open tender notices published by ${department.name}${department.province ? `, ${department.province.name}` : ""}.`,
    alternates: { canonical: `/departments/${department.slug}` },
  };
}

export default async function DepartmentPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const department = await getDepartment(slug);
  if (!department) notFound();
  const filters = await searchParams;

  return (
    <FilteredTenderList
      title={`${department.name} tenders`}
      description={`Procurement notices published by ${department.name}${department.province ? ` in ${department.province.name}` : ""}.`}
      breadcrumbs={[
        { href: "/departments", label: "Departments" },
        { label: department.shortName ?? department.name },
      ]}
      basePath={`/departments/${department.slug}`}
      locked={{ department: department.slug }}
      searchParams={filters}
      headerAction={
        department.website ? (
          <a
            href={department.website}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="btn-secondary shrink-0"
          >
            <ExternalLink className="h-4 w-4" /> Department website
          </a>
        ) : null
      }
    />
  );
}
