import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@paktenders/database";
import type { Paginated, TenderDetail, TenderSearchParams, TenderSummary } from "@paktenders/shared-types";
import { slugify } from "@paktenders/shared-utils";
import type { CreateTenderInput, UpdateTenderInput } from "@paktenders/validation";
import { PrismaService } from "../../common/prisma/prisma.service";
import {
  tenderDetailInclude,
  tenderSummaryInclude,
  toTenderDetail,
  toTenderSummary,
} from "./tender.serializer";

export interface AdminTenderFilters extends TenderSearchParams {
  verificationStatus?: "UNVERIFIED" | "PENDING" | "VERIFIED" | "DEMO";
  includeDeleted?: boolean;
}

@Injectable()
export class TendersService {
  constructor(private readonly prisma: PrismaService) {}

  /* ------------------------------- public -------------------------------- */

  async list(params: TenderSearchParams): Promise<Paginated<TenderSummary>> {
    const page = params.page ?? 1;
    const pageSize = Math.min(params.pageSize ?? 20, 100);

    const where: Prisma.TenderWhereInput = {
      deletedAt: null,
      // Public listings are always PUBLISHED, regardless of query parameters.
      status: "PUBLISHED",
    };

    this.applyCommonFilters(where, params);

    if (params.closingWithinDays !== undefined) {
      const now = new Date();
      const until = new Date(now.getTime() + params.closingWithinDays * 86_400_000);
      where.closingAt = { gte: now, lte: until };
    }
    if (params.publishedFrom) {
      const from = new Date(params.publishedFrom);
      if (!Number.isNaN(from.getTime())) where.publishedAt = { gte: from };
    }

    const orderBy = this.orderBy(params.sort);

    const [total, rows] = await this.prisma.client.$transaction([
      this.prisma.client.tender.count({ where }),
      this.prisma.client.tender.findMany({
        where,
        include: tenderSummaryInclude,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map(toTenderSummary),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async bySlug(slug: string, userId?: string): Promise<TenderDetail> {
    const row = await this.prisma.client.tender.findFirst({
      where: { slug, deletedAt: null, status: { in: ["PUBLISHED", "CLOSED"] } },
      include: tenderDetailInclude,
    });
    if (!row) throw new NotFoundException("Tender not found");

    // Fire-and-forget view counter; never block or fail the request.
    void this.prisma.client.tender
      .update({ where: { id: row.id }, data: { viewCount: { increment: 1 } } })
      .catch(() => undefined);

    let isSaved = false;
    if (userId) {
      const saved = await this.prisma.client.savedTender.findUnique({
        where: { userId_tenderId: { userId, tenderId: row.id } },
      });
      isSaved = Boolean(saved);
    }

    return toTenderDetail(row, isSaved);
  }

  async similar(slug: string, limit = 4): Promise<TenderSummary[]> {
    const tender = await this.prisma.client.tender.findUnique({
      where: { slug },
      select: { id: true, categoryId: true, provinceId: true },
    });
    if (!tender) return [];

    const rows = await this.prisma.client.tender.findMany({
      where: {
        id: { not: tender.id },
        deletedAt: null,
        status: "PUBLISHED",
        OR: [{ categoryId: tender.categoryId }, { provinceId: tender.provinceId }],
      },
      include: tenderSummaryInclude,
      orderBy: [{ publishedAt: "desc" }],
      take: Math.min(limit, 12),
    });
    return rows.map(toTenderSummary);
  }

  /* -------------------------------- admin -------------------------------- */

  async adminDetail(id: string): Promise<TenderDetail> {
    const row = await this.prisma.client.tender.findFirst({
      where: { id, deletedAt: null },
      include: tenderDetailInclude,
    });
    if (!row) throw new NotFoundException("Tender not found");
    return toTenderDetail(row);
  }

  async adminList(params: AdminTenderFilters): Promise<Paginated<TenderSummary>> {
    const page = params.page ?? 1;
    const pageSize = Math.min(params.pageSize ?? 20, 100);

    const where: Prisma.TenderWhereInput = {
      ...(params.includeDeleted ? {} : { deletedAt: null }),
    };
    if (params.status) where.status = params.status;
    if (params.verificationStatus) where.verificationStatus = params.verificationStatus;
    this.applyCommonFilters(where, params);

    const [total, rows] = await this.prisma.client.$transaction([
      this.prisma.client.tender.count({ where }),
      this.prisma.client.tender.findMany({
        where,
        include: tenderSummaryInclude,
        orderBy: this.orderBy(params.sort),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map(toTenderSummary),
      meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  async create(input: CreateTenderInput, actorId: string): Promise<TenderDetail> {
    const slug = await this.uniqueSlug(input.slug ?? input.title);

    const row = await this.prisma.client.tender.create({
      data: {
        slug,
        title: input.title,
        referenceNumber: input.referenceNumber || null,
        description: input.description,
        summary: input.summary || null,
        categoryId: input.categoryId,
        departmentId: input.departmentId,
        provinceId: input.provinceId,
        cityId: input.cityId ?? null,
        sourceId: input.sourceId ?? null,
        tenderType: input.tenderType,
        status: input.status,
        verificationStatus: input.verificationStatus,
        publishedAt: input.publishedAt ?? (input.status === "PUBLISHED" ? new Date() : null),
        closingAt: input.closingAt ?? null,
        openingAt: input.openingAt ?? null,
        estimatedValue: input.estimatedValue ?? null,
        eligibility: input.eligibility || null,
        bidSecurityAmount: input.bidSecurityAmount ?? null,
        bidSecurityDetails: input.bidSecurityDetails || null,
        requiredDocuments: input.requiredDocuments,
        contactName: input.contactName || null,
        contactEmail: input.contactEmail || null,
        contactPhone: input.contactPhone || null,
        contactAddress: input.contactAddress || null,
        originalUrl: input.originalUrl || null,
        sourceAttribution: input.sourceAttribution || null,
        isFeatured: input.isFeatured,
        createdById: actorId,
        statusHistory: {
          create: { toStatus: input.status, changedById: actorId, reason: "Created via admin" },
        },
      },
      include: tenderDetailInclude,
    });

    return toTenderDetail(row);
  }

  async update(id: string, input: UpdateTenderInput, actorId: string): Promise<TenderDetail> {
    const existing = await this.prisma.client.tender.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Tender not found");

    const data: Prisma.TenderUpdateInput = {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.referenceNumber !== undefined ? { referenceNumber: input.referenceNumber || null } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.summary !== undefined ? { summary: input.summary || null } : {}),
      ...(input.categoryId !== undefined ? { category: { connect: { id: input.categoryId } } } : {}),
      ...(input.departmentId !== undefined ? { department: { connect: { id: input.departmentId } } } : {}),
      ...(input.provinceId !== undefined ? { province: { connect: { id: input.provinceId } } } : {}),
      ...(input.cityId !== undefined
        ? { city: input.cityId ? { connect: { id: input.cityId } } : { disconnect: true } }
        : {}),
      ...(input.sourceId !== undefined
        ? { source: input.sourceId ? { connect: { id: input.sourceId } } : { disconnect: true } }
        : {}),
      ...(input.tenderType !== undefined ? { tenderType: input.tenderType } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.verificationStatus !== undefined ? { verificationStatus: input.verificationStatus } : {}),
      ...(input.publishedAt !== undefined ? { publishedAt: input.publishedAt } : {}),
      ...(input.closingAt !== undefined ? { closingAt: input.closingAt } : {}),
      ...(input.openingAt !== undefined ? { openingAt: input.openingAt } : {}),
      ...(input.estimatedValue !== undefined ? { estimatedValue: input.estimatedValue } : {}),
      ...(input.eligibility !== undefined ? { eligibility: input.eligibility || null } : {}),
      ...(input.bidSecurityAmount !== undefined ? { bidSecurityAmount: input.bidSecurityAmount } : {}),
      ...(input.bidSecurityDetails !== undefined
        ? { bidSecurityDetails: input.bidSecurityDetails || null }
        : {}),
      ...(input.requiredDocuments !== undefined ? { requiredDocuments: input.requiredDocuments } : {}),
      ...(input.contactName !== undefined ? { contactName: input.contactName || null } : {}),
      ...(input.contactEmail !== undefined ? { contactEmail: input.contactEmail || null } : {}),
      ...(input.contactPhone !== undefined ? { contactPhone: input.contactPhone || null } : {}),
      ...(input.contactAddress !== undefined ? { contactAddress: input.contactAddress || null } : {}),
      ...(input.originalUrl !== undefined ? { originalUrl: input.originalUrl || null } : {}),
      ...(input.sourceAttribution !== undefined
        ? { sourceAttribution: input.sourceAttribution || null }
        : {}),
      ...(input.isFeatured !== undefined ? { isFeatured: input.isFeatured } : {}),
    };

    const row = await this.prisma.client.tender.update({
      where: { id },
      data: {
        ...data,
        ...(input.status && input.status !== existing.status
          ? {
              statusHistory: {
                create: {
                  fromStatus: existing.status,
                  toStatus: input.status,
                  changedById: actorId,
                  reason: "Status changed via admin",
                },
              },
            }
          : {}),
      },
      include: tenderDetailInclude,
    });

    return toTenderDetail(row);
  }

  async setStatus(
    id: string,
    status: "PUBLISHED" | "CLOSED" | "CANCELLED" | "ARCHIVED" | "PENDING_VERIFICATION" | "DRAFT",
    actorId: string,
    reason?: string,
  ): Promise<TenderDetail> {
    const existing = await this.prisma.client.tender.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Tender not found");

    const row = await this.prisma.client.tender.update({
      where: { id },
      data: {
        status,
        ...(status === "PUBLISHED" && !existing.publishedAt ? { publishedAt: new Date() } : {}),
        statusHistory: {
          create: {
            fromStatus: existing.status,
            toStatus: status,
            changedById: actorId,
            reason: reason ?? "Status changed via admin",
          },
        },
      },
      include: tenderDetailInclude,
    });

    return toTenderDetail(row);
  }

  async verify(
    id: string,
    status: "VERIFIED" | "PENDING" | "UNVERIFIED",
    actorId: string,
    notes?: string,
  ): Promise<TenderDetail> {
    const existing = await this.prisma.client.tender.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Tender not found");

    const row = await this.prisma.client.tender.update({
      where: { id },
      data: {
        verificationStatus: status,
        verifications: { create: { status, verifiedById: actorId, notes } },
      },
      include: tenderDetailInclude,
    });
    return toTenderDetail(row);
  }

  async archive(id: string, actorId: string): Promise<{ success: true }> {
    await this.setStatus(id, "ARCHIVED", actorId, "Archived via admin");
    return { success: true };
  }

  async softDelete(id: string, actorId: string): Promise<{ success: true }> {
    const existing = await this.prisma.client.tender.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Tender not found");
    await this.prisma.client.tender.update({
      where: { id },
      data: { deletedAt: new Date(), status: "ARCHIVED" },
    });
    await this.prisma.client.auditLog.create({
      data: {
        actorId,
        action: "tender.delete",
        entityType: "Tender",
        entityId: id,
        beforeJson: { title: existing.title, status: existing.status },
      },
    });
    return { success: true };
  }

  /* ------------------------------- helpers ------------------------------- */

  private applyCommonFilters(where: Prisma.TenderWhereInput, params: TenderSearchParams): void {
    if (params.q) {
      const q = params.q.trim();
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { referenceNumber: { contains: q, mode: "insensitive" } },
      ];
    }
    if (params.category) where.category = { slug: params.category };
    if (params.province) where.province = { slug: params.province };
    if (params.city) where.city = { slug: params.city };
    if (params.department) where.department = { slug: params.department };
    if (params.type) where.tenderType = params.type;
  }

  private orderBy(sort: TenderSearchParams["sort"]): Prisma.TenderOrderByWithRelationInput[] {
    switch (sort) {
      case "closing":
        return [{ closingAt: { sort: "asc", nulls: "last" } }, { publishedAt: "desc" }];
      case "relevance":
      case "newest":
      default:
        return [{ isFeatured: "desc" }, { publishedAt: "desc" }];
    }
  }

  private async uniqueSlug(source: string): Promise<string> {
    const base = slugify(source) || "tender";
    let candidate = base;
    let suffix = 2;
    // Slugs are unique in the database; loop is bounded in practice.
    while (await this.prisma.client.tender.findUnique({ where: { slug: candidate }, select: { id: true } })) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
      if (suffix > 50) {
        candidate = `${base}-${Date.now().toString(36)}`;
        break;
      }
    }
    return candidate;
  }
}
