import { Injectable, NotFoundException } from "@nestjs/common";
import type { CategoryDto, DepartmentDto, ProvinceDto } from "@paktenders/shared-types";
import { PrismaService } from "../../common/prisma/prisma.service";

const publishedTenderFilter = {
  deletedAt: null,
  status: "PUBLISHED" as const,
};

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async categories(): Promise<CategoryDto[]> {
    const rows = await this.prisma.client.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        _count: {
          select: { tenders: { where: publishedTenderFilter } },
        },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      icon: row.icon,
      description: row.description,
      parentId: row.parentId,
      seoTitle: row.seoTitle,
      metaDescription: row.metaDescription,
      tenderCount: row._count.tenders,
    }));
  }

  async categoryBySlug(slug: string): Promise<CategoryDto> {
    const row = await this.prisma.client.category.findUnique({
      where: { slug },
      include: { _count: { select: { tenders: { where: publishedTenderFilter } } } },
    });
    if (!row || !row.isActive) throw new NotFoundException("Category not found");
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      icon: row.icon,
      description: row.description,
      parentId: row.parentId,
      seoTitle: row.seoTitle,
      metaDescription: row.metaDescription,
      tenderCount: row._count.tenders,
    };
  }

  async provinces(): Promise<ProvinceDto[]> {
    const rows = await this.prisma.client.province.findMany({
      orderBy: { name: "asc" },
      include: {
        cities: {
          orderBy: [{ isMajor: "desc" }, { name: "asc" }],
          include: {
            _count: { select: { tenders: { where: publishedTenderFilter } } },
          },
        },
        _count: { select: { tenders: { where: publishedTenderFilter } } },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      code: row.code,
      tenderCount: row._count.tenders,
      cities: row.cities.map((city) => ({
        id: city.id,
        name: city.name,
        slug: city.slug,
        tenderCount: city._count.tenders,
      })),
    }));
  }

  async departments(params: { province?: string; limit?: number }): Promise<DepartmentDto[]> {
    const rows = await this.prisma.client.department.findMany({
      where: {
        isActive: true,
        ...(params.province ? { province: { slug: params.province } } : {}),
      },
      orderBy: { name: "asc" },
      take: Math.min(params.limit ?? 100, 200),
      include: {
        province: { select: { id: true, name: true, slug: true, code: true } },
        _count: { select: { tenders: { where: publishedTenderFilter } } },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      shortName: row.shortName,
      type: row.type,
      website: row.website,
      province: row.province,
      tenderCount: row._count.tenders,
    }));
  }

  async departmentBySlug(slug: string): Promise<DepartmentDto> {
    const row = await this.prisma.client.department.findUnique({
      where: { slug },
      include: {
        province: { select: { id: true, name: true, slug: true, code: true } },
        _count: { select: { tenders: { where: publishedTenderFilter } } },
      },
    });
    if (!row || !row.isActive) throw new NotFoundException("Department not found");
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      shortName: row.shortName,
      type: row.type,
      website: row.website,
      province: row.province,
      tenderCount: row._count.tenders,
    };
  }

  /** Public, non-sensitive settings consumed by the website and mobile app. */
  async publicSettings(): Promise<Record<string, unknown>> {
    const rows = await this.prisma.client.systemSetting.findMany({
      where: { isPublic: true },
      orderBy: { key: "asc" },
    });
    return Object.fromEntries(rows.map((row) => [row.key, row.valueJson]));
  }

  async sources() {
    return this.prisma.client.tenderSource.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        url: true,
        type: true,
        isVerified: true,
        _count: { select: { tenders: { where: publishedTenderFilter } } },
      },
    });
  }
}
