import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { loadEnv } from "@paktenders/config";
import type { Prisma, SourceCategory, SourceRunStatus, IngestStatus, TenderStatus } from "@paktenders/database";
import type { AuthUser } from "../../common/decorators/auth.decorators";
import { PrismaService } from "../../common/prisma/prisma.service";
import type { RawTenderItem } from "./collection.types";
import { CollectionProcessorService } from "./collection-processor.service";
import { CollectionQueueService } from "./collection-queue.service";
import { hasConnector, listConnectors } from "./connectors/connector.registry";
import { DocumentExtractorService } from "./extraction/document-extractor.service";
import { cleanText, oneLine } from "./extraction/date-utils";

const env = loadEnv();

const SOURCE_STATUSES = ["ACTIVE", "PAUSED", "DEGRADED", "DISABLED", "PENDING_REVIEW"] as const;

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseDate(value: string | null | undefined, field: string): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new BadRequestException(`${field} is not a valid date.`);
  return date;
}

export interface SourceListParams {
  q?: string;
  enabled?: boolean;
  category?: SourceCategory;
  status?: (typeof SOURCE_STATUSES)[number];
  page?: number;
  pageSize?: number;
}

export interface SourceUpdateInput {
  name?: string;
  url?: string | null;
  baseUrl?: string | null;
  isEnabled?: boolean;
  isVerified?: boolean;
  status?: (typeof SOURCE_STATUSES)[number];
  priority?: number;
  scheduleMinutes?: number;
  rateLimitPerMinute?: number;
  maxPages?: number;
  respectRobots?: boolean;
  autoPublish?: boolean;
  minConfidence?: number;
  accessNotes?: string | null;
  licenseNotes?: string | null;
  termsUrl?: string | null;
  config?: Record<string, unknown> | null;
}

export interface ManualImportInput {
  sourceId: string;
  title: string;
  sourceUrl?: string | null;
  referenceNumber?: string | null;
  organization?: string | null;
  department?: string | null;
  category?: string | null;
  province?: string | null;
  city?: string | null;
  tenderType?: string | null;
  publishedAt?: string | null;
  closingAt?: string | null;
  openingAt?: string | null;
  estimatedValue?: string | null;
  bidSecurity?: string | null;
  eligibility?: string | null;
  requiredDocuments?: string[];
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  contactAddress?: string | null;
  description?: string | null;
  documentUrls?: string[];
}

export interface ImportReviewInput {
  action: "PUBLISH" | "REJECT" | "NEEDS_REVIEW";
  notes?: string;
  edits?: {
    title?: string;
    referenceNumber?: string | null;
    description?: string;
    summary?: string | null;
    categoryId?: string;
    departmentId?: string;
    provinceId?: string;
    cityId?: string | null;
    tenderType?: "GOVERNMENT" | "PRIVATE" | "NGO" | "AUCTION" | "CONSULTANCY" | "NEWSPAPER";
    publishedAt?: string | null;
    closingAt?: string | null;
    openingAt?: string | null;
    estimatedValue?: string | null;
    bidSecurityAmount?: string | null;
    eligibility?: string | null;
    contactName?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    contactAddress?: string | null;
  };
}

@Injectable()
export class CollectionAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly processor: CollectionProcessorService,
    private readonly queue: CollectionQueueService,
    private readonly documents: DocumentExtractorService,
  ) {}

  private async audit(
    actor: AuthUser,
    action: string,
    entityType: string,
    entityId: string | null,
    details?: { from?: unknown; to?: unknown },
  ): Promise<void> {
    await this.prisma.client.auditLog.create({
      data: {
        actorId: actor.id,
        actorEmail: actor.email,
        action,
        entityType,
        entityId,
        beforeJson: (details?.from ?? undefined) as Prisma.InputJsonValue | undefined,
        afterJson: (details?.to ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }

  private requirePermission(actor: AuthUser, permission: string): void {
    if (!actor.permissions.includes(permission)) {
      throw new ForbiddenException(`This action requires the ${permission} permission.`);
    }
  }

  /* ----------------------------------------------------------------------- */
  /* Overview                                                                */
  /* ----------------------------------------------------------------------- */

  async overview() {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 86_400_000);

    const [
      sourceTotal,
      sourceEnabled,
      sourceVerified,
      sourceFailing,
      sourcesByStatus,
      runs24h,
      importsByStatus,
      pendingImports,
      pendingDuplicates,
      documents,
      ocrFailures,
      tendersNeedingReview,
      lastSuccessfulRun,
      upcoming,
    ] = await Promise.all([
      this.prisma.client.tenderSource.count(),
      this.prisma.client.tenderSource.count({ where: { isEnabled: true } }),
      this.prisma.client.tenderSource.count({ where: { isVerified: true } }),
      this.prisma.client.tenderSource.count({ where: { consecutiveFailures: { gt: 0 } } }),
      this.prisma.client.tenderSource.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.client.sourceRun.groupBy({
        by: ["status"],
        where: { startedAt: { gte: dayAgo } },
        _count: { _all: true },
      }),
      this.prisma.client.tenderImport.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.client.tenderImport.count({ where: { status: "NEEDS_REVIEW" } }),
      this.prisma.client.tenderDuplicateReview.count({ where: { decision: "PENDING" } }),
      this.prisma.client.sourceDocument.aggregate({
        _count: { _all: true },
        _sum: { contentLength: true },
      }),
      this.prisma.client.sourceDocument.count({ where: { ocrStatus: "FAILED" } }),
      this.prisma.client.tender.count({ where: { deletedAt: null, needsReview: true } }),
      this.prisma.client.sourceRun.findFirst({
        where: { status: "SUCCEEDED" },
        orderBy: { finishedAt: "desc" },
        select: { id: true, sourceId: true, finishedAt: true, itemsNew: true, itemsUpdated: true },
      }),
      this.prisma.client.tenderSource.findMany({
        where: {
          isEnabled: true,
          connectorKey: { not: "manual" },
          collectionMethod: { not: "MANUAL_IMPORT" },
          nextRunAt: { not: null },
        },
        orderBy: { nextRunAt: "asc" },
        take: 6,
        select: { id: true, name: true, code: true, nextRunAt: true, scheduleMinutes: true, priority: true },
      }),
    ]);

    const queue = await this.queue.status();

    return {
      sources: {
        total: sourceTotal,
        enabled: sourceEnabled,
        verified: sourceVerified,
        failing: sourceFailing,
        byStatus: Object.fromEntries(sourcesByStatus.map((row) => [row.status, row._count._all])),
      },
      runs24h: Object.fromEntries(runs24h.map((row) => [row.status, row._count._all])),
      imports: {
        byStatus: Object.fromEntries(importsByStatus.map((row) => [row.status, row._count._all])),
        pendingReview: pendingImports,
      },
      duplicates: { pending: pendingDuplicates },
      documents: {
        total: documents._count._all,
        bytes: documents._sum.contentLength ?? 0,
        ocrFailures,
      },
      tendersNeedingReview,
      lastSuccessfulRun: lastSuccessfulRun
        ? {
            id: lastSuccessfulRun.id,
            sourceId: lastSuccessfulRun.sourceId,
            finishedAt: iso(lastSuccessfulRun.finishedAt),
            itemsNew: lastSuccessfulRun.itemsNew,
            itemsUpdated: lastSuccessfulRun.itemsUpdated,
          }
        : null,
      upcoming: upcoming.map((row) => ({
        id: row.id,
        name: row.name,
        code: row.code,
        nextRunAt: iso(row.nextRunAt),
        scheduleMinutes: row.scheduleMinutes,
        priority: row.priority,
      })),
      queue,
      connectors: listConnectors(),
      settings: {
        collectionEnabled: env.COLLECTION_ENABLED,
        workerEnabled: env.COLLECTION_WORKER_ENABLED,
        redisConfigured: Boolean(env.REDIS_URL),
        ocrEnabled: env.OCR_ENABLED,
        ocrLanguages: env.OCR_LANGUAGES,
        aiCollectionEnabled: env.AI_COLLECTION_ENABLED,
        aiConfigured: Boolean(env.AI_API_KEY),
      },
      generatedAt: now.toISOString(),
    };
  }

  /* ----------------------------------------------------------------------- */
  /* Sources                                                                 */
  /* ----------------------------------------------------------------------- */

  async sources(params: SourceListParams) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const where: Prisma.TenderSourceWhereInput = {
      ...(params.enabled !== undefined ? { isEnabled: params.enabled } : {}),
      ...(params.category ? { category: params.category } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.q
        ? {
            OR: [
              { name: { contains: params.q, mode: "insensitive" } },
              { code: { contains: params.q, mode: "insensitive" } },
              { url: { contains: params.q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [total, rows] = await this.prisma.client.$transaction([
      this.prisma.client.tenderSource.count({ where }),
      this.prisma.client.tenderSource.findMany({
        where,
        orderBy: [{ isEnabled: "desc" }, { priority: "asc" }, { name: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          province: { select: { id: true, name: true, slug: true } },
          authority: { select: { id: true, name: true, slug: true } },
          newspaper: { select: { id: true, name: true, slug: true } },
          _count: { select: { tenders: true, imports: true, runs: true } },
          runs: {
            orderBy: { startedAt: "desc" },
            take: 1,
            select: {
              id: true,
              status: true,
              trigger: true,
              startedAt: true,
              finishedAt: true,
              itemsFound: true,
              itemsNew: true,
              itemsFailed: true,
              errorSummary: true,
            },
          },
        },
      }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        slug: row.slug,
        type: row.type,
        category: row.category,
        collectionMethod: row.collectionMethod,
        connectorKey: row.connectorKey,
        connectorAvailable: hasConnector(row.connectorKey),
        url: row.url,
        baseUrl: row.baseUrl,
        isVerified: row.isVerified,
        isEnabled: row.isEnabled,
        status: row.status,
        priority: row.priority,
        scheduleMinutes: row.scheduleMinutes,
        rateLimitPerMinute: row.rateLimitPerMinute,
        maxPages: row.maxPages,
        respectRobots: row.respectRobots,
        requiresAuth: row.requiresAuth,
        autoPublish: row.autoPublish,
        minConfidence: row.minConfidence,
        accessNotes: row.accessNotes,
        licenseNotes: row.licenseNotes,
        termsUrl: row.termsUrl,
        lastRunAt: iso(row.lastRunAt),
        lastSuccessAt: iso(row.lastSuccessAt),
        nextRunAt: iso(row.nextRunAt),
        lastError: row.lastError,
        consecutiveFailures: row.consecutiveFailures,
        province: row.province,
        authority: row.authority,
        newspaper: row.newspaper,
        counts: row._count,
        lastRun: row.runs[0]
          ? {
              id: row.runs[0].id,
              status: row.runs[0].status,
              trigger: row.runs[0].trigger,
              startedAt: iso(row.runs[0].startedAt),
              finishedAt: iso(row.runs[0].finishedAt),
              itemsFound: row.runs[0].itemsFound,
              itemsNew: row.runs[0].itemsNew,
              itemsFailed: row.runs[0].itemsFailed,
              errorSummary: row.runs[0].errorSummary,
            }
          : null,
      })),
      meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  async sourceDetail(id: string) {
    const row = await this.prisma.client.tenderSource.findUnique({
      where: { id },
      include: {
        province: { select: { id: true, name: true, slug: true } },
        authority: { select: { id: true, name: true, slug: true } },
        newspaper: { select: { id: true, name: true, slug: true } },
        _count: { select: { tenders: true, imports: true, runs: true, documents: true } },
      },
    });
    if (!row) throw new NotFoundException("Source not found");

    const runs = await this.prisma.client.sourceRun.findMany({
      where: { sourceId: id },
      orderBy: { startedAt: "desc" },
      take: 10,
      select: {
        id: true,
        status: true,
        trigger: true,
        startedAt: true,
        finishedAt: true,
        durationMs: true,
        itemsFound: true,
        itemsNew: true,
        itemsUpdated: true,
        itemsDuplicate: true,
        itemsReview: true,
        itemsFailed: true,
        documentsFetched: true,
        bytesDownloaded: true,
        errorSummary: true,
      },
    });

    return {
      id: row.id,
      code: row.code,
      name: row.name,
      slug: row.slug,
      type: row.type,
      category: row.category,
      collectionMethod: row.collectionMethod,
      connectorKey: row.connectorKey,
      connectorAvailable: hasConnector(row.connectorKey),
      url: row.url,
      baseUrl: row.baseUrl,
      provinceId: row.provinceId,
      authorityId: row.authorityId,
      newspaperId: row.newspaperId,
      isVerified: row.isVerified,
      isEnabled: row.isEnabled,
      status: row.status,
      priority: row.priority,
      scheduleMinutes: row.scheduleMinutes,
      rateLimitPerMinute: row.rateLimitPerMinute,
      maxPages: row.maxPages,
      respectRobots: row.respectRobots,
      requiresAuth: row.requiresAuth,
      autoPublish: row.autoPublish,
      minConfidence: row.minConfidence,
      accessNotes: row.accessNotes,
      licenseNotes: row.licenseNotes,
      termsUrl: row.termsUrl,
      config: row.configJson,
      lastSyncedAt: iso(row.lastSyncedAt),
      lastRunAt: iso(row.lastRunAt),
      lastSuccessAt: iso(row.lastSuccessAt),
      nextRunAt: iso(row.nextRunAt),
      lastError: row.lastError,
      consecutiveFailures: row.consecutiveFailures,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      province: row.province,
      authority: row.authority,
      newspaper: row.newspaper,
      counts: row._count,
      recentRuns: runs.map((run) => ({
        ...run,
        startedAt: iso(run.startedAt),
        finishedAt: iso(run.finishedAt),
      })),
    };
  }

  async updateSource(actor: AuthUser, id: string, input: SourceUpdateInput) {
    this.requirePermission(actor, "tender.import");
    const existing = await this.prisma.client.tenderSource.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Source not found");

    if (input.isEnabled === true) {
      if (!hasConnector(existing.connectorKey) && existing.collectionMethod !== "MANUAL_IMPORT") {
        throw new BadRequestException(
          `The connector "${existing.connectorKey}" is not available in this build, so the source cannot be enabled.`,
        );
      }
      if (!existing.isVerified && input.isVerified !== true) {
        throw new BadRequestException(
          "Confirm the source's access conditions and mark it as verified before enabling it.",
        );
      }
    }

    const enabling = input.isEnabled === true && !existing.isEnabled;
    const disabling = input.isEnabled === false && existing.isEnabled;

    const data: Prisma.TenderSourceUpdateInput = {
      ...(input.name !== undefined ? { name: oneLine(input.name).slice(0, 160) } : {}),
      ...(input.url !== undefined ? { url: input.url } : {}),
      ...(input.baseUrl !== undefined ? { baseUrl: input.baseUrl } : {}),
      ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
      ...(input.isVerified !== undefined ? { isVerified: input.isVerified } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.scheduleMinutes !== undefined ? { scheduleMinutes: input.scheduleMinutes } : {}),
      ...(input.rateLimitPerMinute !== undefined ? { rateLimitPerMinute: input.rateLimitPerMinute } : {}),
      ...(input.maxPages !== undefined ? { maxPages: input.maxPages } : {}),
      ...(input.respectRobots !== undefined ? { respectRobots: input.respectRobots } : {}),
      ...(input.autoPublish !== undefined ? { autoPublish: input.autoPublish } : {}),
      ...(input.minConfidence !== undefined ? { minConfidence: input.minConfidence } : {}),
      ...(input.accessNotes !== undefined ? { accessNotes: input.accessNotes } : {}),
      ...(input.licenseNotes !== undefined ? { licenseNotes: input.licenseNotes } : {}),
      ...(input.termsUrl !== undefined ? { termsUrl: input.termsUrl } : {}),
      ...(input.config !== undefined
        ? { configJson: (input.config ?? null) as Prisma.InputJsonValue }
        : {}),
    };

    if (disabling) {
      data.status = "DISABLED";
      data.nextRunAt = null;
    }
    if (enabling) {
      data.status = input.status ?? "ACTIVE";
      data.nextRunAt = new Date();
    }
    if (input.scheduleMinutes !== undefined && existing.isEnabled && !enabling) {
      data.nextRunAt = new Date(Date.now() + input.scheduleMinutes * 60_000);
    }

    const updated = await this.prisma.client.tenderSource.update({ where: { id }, data });
    await this.audit(actor, "collection.source.update", "TenderSource", id, {
      from: {
        isEnabled: existing.isEnabled,
        isVerified: existing.isVerified,
        status: existing.status,
        scheduleMinutes: existing.scheduleMinutes,
        priority: existing.priority,
      },
      to: {
        isEnabled: updated.isEnabled,
        isVerified: updated.isVerified,
        status: updated.status,
        scheduleMinutes: updated.scheduleMinutes,
        priority: updated.priority,
      },
    });
    return this.sourceDetail(id);
  }

  async runSource(actor: AuthUser, sourceId: string, force = false) {
    this.requirePermission(actor, "tender.import");
    const source = await this.prisma.client.tenderSource.findUnique({ where: { id: sourceId } });
    if (!source) throw new NotFoundException("Source not found");
    if (source.collectionMethod === "MANUAL_IMPORT" || source.connectorKey === "manual") {
      throw new BadRequestException(
        "This source is manual-import only. Use the manual import screen instead of a scheduled run.",
      );
    }
    if (!source.isEnabled && !force) {
      throw new BadRequestException("The source is disabled. Enable it before running it.");
    }

    const run = await this.prisma.client.sourceRun.create({
      data: { sourceId, status: "QUEUED", trigger: "MANUAL" },
    });

    if (this.queue.canRunJobs) {
      const queued = await this.queue.enqueueSource(sourceId, "MANUAL", { runId: run.id, manual: true });
      if (queued.queued) {
        await this.prisma.client.sourceRun.update({
          where: { id: run.id },
          data: { jobId: queued.jobId },
        });
        await this.audit(actor, "collection.source.run", "TenderSource", sourceId, {
          to: { runId: run.id, mode: "queued" },
        });
        return { queued: true, runId: run.id, jobId: queued.jobId, summary: null };
      }
      await this.prisma.client.sourceRun.update({
        where: { id: run.id },
        data: {
          status: "SKIPPED",
          finishedAt: new Date(),
          errorSummary: queued.reason ?? "The collection queue rejected the job.",
        },
      });
      if (queued.reason === "A collection job for this source is already queued or running.") {
        // Running synchronously here would overlap with the queued job; the
        // administrator can retry once the current run finishes.
        await this.audit(actor, "collection.source.run", "TenderSource", sourceId, {
          to: { runId: run.id, mode: "skipped", reason: queued.reason },
        });
        return { queued: false, runId: run.id, jobId: null, summary: null, skipped: true };
      }
      // Fall through to a synchronous run so the administrator still gets a result.
    }

    const summary = await this.processor.processSource(sourceId, "MANUAL", run.id);
    await this.audit(actor, "collection.source.run", "TenderSource", sourceId, {
      to: { runId: run.id, mode: "synchronous", status: summary.status },
    });
    return { queued: false, runId: run.id, jobId: null, summary };
  }

  /* ----------------------------------------------------------------------- */
  /* Runs                                                                    */
  /* ----------------------------------------------------------------------- */

  async runs(params: {
    sourceId?: string;
    status?: SourceRunStatus;
    trigger?: "SCHEDULE" | "MANUAL" | "RETRY" | "WEBHOOK";
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const where: Prisma.SourceRunWhereInput = {
      ...(params.sourceId ? { sourceId: params.sourceId } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.trigger ? { trigger: params.trigger } : {}),
    };
    const [total, rows] = await this.prisma.client.$transaction([
      this.prisma.client.sourceRun.count({ where }),
      this.prisma.client.sourceRun.findMany({
        where,
        orderBy: { startedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          source: { select: { id: true, name: true, code: true, category: true } },
        },
      }),
    ]);
    return {
      items: rows.map((run) => ({
        id: run.id,
        source: run.source,
        jobId: run.jobId,
        status: run.status,
        trigger: run.trigger,
        startedAt: iso(run.startedAt),
        finishedAt: iso(run.finishedAt),
        durationMs: run.durationMs,
        itemsFound: run.itemsFound,
        itemsNew: run.itemsNew,
        itemsUpdated: run.itemsUpdated,
        itemsDuplicate: run.itemsDuplicate,
        itemsUnchanged: run.itemsUnchanged,
        itemsReview: run.itemsReview,
        itemsFailed: run.itemsFailed,
        documentsFetched: run.documentsFetched,
        bytesDownloaded: run.bytesDownloaded,
        errorSummary: run.errorSummary,
      })),
      meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  async runDetail(id: string) {
    const run = await this.prisma.client.sourceRun.findUnique({
      where: { id },
      include: {
        source: { select: { id: true, name: true, code: true, category: true, connectorKey: true } },
        imports: {
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            id: true,
            title: true,
            status: true,
            confidence: true,
            sourceUrl: true,
            createdAt: true,
            tenderId: true,
            duplicateOfId: true,
            duplicateScore: true,
          },
        },
        documents: {
          orderBy: { fetchedAt: "desc" },
          take: 30,
          select: {
            id: true,
            url: true,
            fileName: true,
            mimeType: true,
            contentLength: true,
            sha256: true,
            ocrStatus: true,
            ocrConfidence: true,
            extractionConfidence: true,
            error: true,
          },
        },
      },
    });
    if (!run) throw new NotFoundException("Run not found");

    return {
      id: run.id,
      source: run.source,
      jobId: run.jobId,
      status: run.status,
      trigger: run.trigger,
      startedAt: iso(run.startedAt),
      finishedAt: iso(run.finishedAt),
      durationMs: run.durationMs,
      itemsFound: run.itemsFound,
      itemsNew: run.itemsNew,
      itemsUpdated: run.itemsUpdated,
      itemsDuplicate: run.itemsDuplicate,
      itemsUnchanged: run.itemsUnchanged,
      itemsReview: run.itemsReview,
      itemsFailed: run.itemsFailed,
      documentsFetched: run.documentsFetched,
      bytesDownloaded: run.bytesDownloaded,
      errorSummary: run.errorSummary,
      log: run.logJson,
      imports: run.imports.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
      })),
      documents: run.documents,
    };
  }

  /* ----------------------------------------------------------------------- */
  /* Imports and review                                                      */
  /* ----------------------------------------------------------------------- */

  async imports(params: {
    sourceId?: string;
    status?: IngestStatus;
    q?: string;
    needsReview?: boolean;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const where: Prisma.TenderImportWhereInput = {
      ...(params.sourceId ? { sourceId: params.sourceId } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.needsReview ? { status: "NEEDS_REVIEW" } : {}),
      ...(params.q
        ? {
            OR: [
              { title: { contains: params.q, mode: "insensitive" } },
              { sourceUrl: { contains: params.q, mode: "insensitive" } },
              { externalId: { contains: params.q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [total, rows] = await this.prisma.client.$transaction([
      this.prisma.client.tenderImport.count({ where }),
      this.prisma.client.tenderImport.findMany({
        where,
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          source: { select: { id: true, name: true, code: true, category: true } },
          tender: {
            select: {
              id: true,
              slug: true,
              title: true,
              status: true,
              verificationStatus: true,
              needsReview: true,
              closingAt: true,
            },
          },
        },
      }),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        status: row.status,
        confidence: row.confidence,
        sourceUrl: row.sourceUrl,
        externalId: row.externalId,
        changeCount: row.changeCount,
        lastSeenAt: row.lastSeenAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
        source: row.source,
        tender: row.tender
          ? { ...row.tender, closingAt: iso(row.tender.closingAt) }
          : null,
        duplicateOfId: row.duplicateOfId,
        duplicateScore: row.duplicateScore,
      })),
      meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  async importDetail(id: string) {
    const row = await this.prisma.client.tenderImport.findUnique({
      where: { id },
      include: {
        source: {
          select: { id: true, name: true, code: true, category: true, connectorKey: true, url: true },
        },
        run: {
          select: { id: true, status: true, startedAt: true, finishedAt: true, trigger: true },
        },
        document: true,
        tender: {
          include: {
            category: { select: { id: true, name: true, slug: true } },
            province: { select: { id: true, name: true, slug: true } },
            city: { select: { id: true, name: true, slug: true } },
            department: { select: { id: true, name: true, slug: true } },
            provenance: { orderBy: { field: "asc" } },
            documents: { orderBy: { createdAt: "asc" } },
          },
        },
        reviews: {
          include: {
            candidate: { select: { id: true, slug: true, title: true, status: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!row) throw new NotFoundException("Import not found");

    return {
      id: row.id,
      sourceKey: row.sourceKey,
      source: row.source,
      run: row.run
        ? {
            ...row.run,
            startedAt: iso(row.run.startedAt),
            finishedAt: iso(row.run.finishedAt),
          }
        : null,
      externalId: row.externalId,
      sourceUrl: row.sourceUrl,
      title: row.title,
      status: row.status,
      confidence: row.confidence,
      changeCount: row.changeCount,
      lastSeenAt: row.lastSeenAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      reviewNotes: row.reviewNotes,
      duplicateOfId: row.duplicateOfId,
      duplicateScore: row.duplicateScore,
      duplicateSignals: row.duplicateSignals,
      raw: row.rawJson,
      normalized: row.normalizedJson,
      document: row.document
        ? {
            ...row.document,
            fetchedAt: row.document.fetchedAt.toISOString(),
            textContent: row.document.textContent ? row.document.textContent.slice(0, 20_000) : null,
            textTruncated: Boolean(row.document.textContent && row.document.textContent.length > 20_000),
          }
        : null,
      tender: row.tender
        ? {
            id: row.tender.id,
            slug: row.tender.slug,
            title: row.tender.title,
            referenceNumber: row.tender.referenceNumber,
            description: row.tender.description,
            summary: row.tender.summary,
            status: row.tender.status,
            verificationStatus: row.tender.verificationStatus,
            needsReview: row.tender.needsReview,
            tenderType: row.tender.tenderType,
            publishedAt: iso(row.tender.publishedAt),
            closingAt: iso(row.tender.closingAt),
            openingAt: iso(row.tender.openingAt),
            estimatedValue: row.tender.estimatedValue?.toString() ?? null,
            bidSecurityAmount: row.tender.bidSecurityAmount?.toString() ?? null,
            bidSecurityDetails: row.tender.bidSecurityDetails,
            eligibility: row.tender.eligibility,
            requiredDocuments: row.tender.requiredDocuments,
            contactName: row.tender.contactName,
            contactEmail: row.tender.contactEmail,
            contactPhone: row.tender.contactPhone,
            contactAddress: row.tender.contactAddress,
            originalUrl: row.tender.originalUrl,
            originalDocumentUrl: row.tender.originalDocumentUrl,
            sourceAttribution: row.tender.sourceAttribution,
            extractionConfidence: row.tender.extractionConfidence,
            category: row.tender.category,
            province: row.tender.province,
            city: row.tender.city,
            department: row.tender.department,
            provenance: row.tender.provenance.map((entry) => ({
              ...entry,
              createdAt: entry.createdAt.toISOString(),
            })),
            documents: row.tender.documents.map((document) => ({
              ...document,
              createdAt: document.createdAt.toISOString(),
              extractedText: document.extractedText ? document.extractedText.slice(0, 10_000) : null,
            })),
          }
        : null,
      reviews: row.reviews.map((review) => ({
        id: review.id,
        matchType: review.matchType,
        score: review.score,
        decision: review.decision,
        signals: review.signalsJson,
        candidate: review.candidate,
        mergedTenderId: review.mergedTenderId,
        reviewedAt: iso(review.reviewedAt),
        createdAt: review.createdAt.toISOString(),
      })),
    };
  }

  async reviewImport(actor: AuthUser, id: string, input: ImportReviewInput) {
    this.requirePermission(actor, "tender.import");
    if (input.action === "PUBLISH") this.requirePermission(actor, "tender.publish");

    const row = await this.prisma.client.tenderImport.findUnique({
      where: { id },
      include: { tender: { select: { id: true, status: true, closingAt: true, title: true } } },
    });
    if (!row) throw new NotFoundException("Import not found");
    if (!row.tender) {
      throw new BadRequestException(
        "This import has no tender record (it was merged into an existing tender or failed).",
      );
    }

    const tender = row.tender;
    const edits = input.edits ?? {};
    const tenderData: Prisma.TenderUncheckedUpdateInput = {
      ...(edits.title !== undefined ? { title: oneLine(edits.title).slice(0, 300) } : {}),
      ...(edits.referenceNumber !== undefined ? { referenceNumber: edits.referenceNumber || null } : {}),
      ...(edits.description !== undefined ? { description: cleanText(edits.description) } : {}),
      ...(edits.summary !== undefined ? { summary: edits.summary || null } : {}),
      ...(edits.categoryId !== undefined ? { categoryId: edits.categoryId } : {}),
      ...(edits.departmentId !== undefined ? { departmentId: edits.departmentId } : {}),
      ...(edits.provinceId !== undefined ? { provinceId: edits.provinceId } : {}),
      ...(edits.cityId !== undefined ? { cityId: edits.cityId } : {}),
      ...(edits.tenderType !== undefined ? { tenderType: edits.tenderType } : {}),
      ...(edits.publishedAt !== undefined ? { publishedAt: parseDate(edits.publishedAt, "publishedAt") } : {}),
      ...(edits.closingAt !== undefined ? { closingAt: parseDate(edits.closingAt, "closingAt") } : {}),
      ...(edits.openingAt !== undefined ? { openingAt: parseDate(edits.openingAt, "openingAt") } : {}),
      ...(edits.estimatedValue !== undefined
        ? { estimatedValue: edits.estimatedValue === null || edits.estimatedValue === "" ? null : edits.estimatedValue }
        : {}),
      ...(edits.bidSecurityAmount !== undefined
        ? {
            bidSecurityAmount:
              edits.bidSecurityAmount === null || edits.bidSecurityAmount === "" ? null : edits.bidSecurityAmount,
          }
        : {}),
      ...(edits.eligibility !== undefined ? { eligibility: edits.eligibility || null } : {}),
      ...(edits.contactName !== undefined ? { contactName: edits.contactName || null } : {}),
      ...(edits.contactEmail !== undefined ? { contactEmail: edits.contactEmail || null } : {}),
      ...(edits.contactPhone !== undefined ? { contactPhone: edits.contactPhone || null } : {}),
      ...(edits.contactAddress !== undefined ? { contactAddress: edits.contactAddress || null } : {}),
    };

    let nextStatus: TenderStatus = tender.status;
    let importStatus: IngestStatus = row.status;
    let verification: "VERIFIED" | "UNVERIFIED" | "PENDING" = "PENDING";
    let needsReview = false;

    if (input.action === "PUBLISH") {
      const closing = edits.closingAt !== undefined ? parseDate(edits.closingAt, "closingAt") : tender.closingAt;
      nextStatus = closing && closing.getTime() < Date.now() ? "CLOSED" : "PUBLISHED";
      importStatus = "PUBLISHED";
      verification = "VERIFIED";
    } else if (input.action === "REJECT") {
      nextStatus = "ARCHIVED";
      importStatus = "REJECTED";
      verification = "UNVERIFIED";
    } else {
      nextStatus = "PENDING_VERIFICATION";
      importStatus = "NEEDS_REVIEW";
      verification = "PENDING";
      needsReview = true;
    }

    const before = {
      tenderStatus: tender.status,
      importStatus: row.status,
      needsReview: true,
    };

    const reviewNote = oneLine(input.notes ?? "").slice(0, 2000);

    await this.prisma.client.$transaction(async (tx) => {
      await tx.tender.update({
        where: { id: tender.id },
        data: {
          ...tenderData,
          status: nextStatus,
          verificationStatus: verification,
          needsReview,
        },
      });

      if (input.action === "PUBLISH" || input.action === "REJECT") {
        await tx.tenderVerification.create({
          data: {
            tenderId: tender.id,
            status: input.action === "PUBLISH" ? "VERIFIED" : "UNVERIFIED",
            verifiedById: actor.id,
            notes:
              reviewNote ||
              (input.action === "PUBLISH"
                ? "Verified from the collection review screen."
                : "Rejected from the collection review screen."),
          },
        });
      }

      if (nextStatus !== tender.status) {
        await tx.tenderStatusHistory.create({
          data: {
            tenderId: tender.id,
            fromStatus: tender.status,
            toStatus: nextStatus,
            reason:
              reviewNote ||
              (input.action === "PUBLISH"
                ? "Published after collection review."
                : input.action === "REJECT"
                  ? "Rejected after collection review."
                  : "Returned to review."),
            changedById: actor.id,
          },
        });
      }

      await tx.tenderImport.update({
        where: { id },
        data: {
          status: importStatus,
          reviewNotes: reviewNote
            ? `${reviewNote}\n\nReviewer: ${actor.email}`
            : row.reviewNotes,
        },
      });
    });

    await this.audit(actor, "collection.import.review", "TenderImport", id, {
      from: before,
      to: { tenderStatus: nextStatus, importStatus, needsReview, notes: reviewNote || null },
    });

    return this.importDetail(id);
  }

  /* ----------------------------------------------------------------------- */
  /* Manual import                                                           */
  /* ----------------------------------------------------------------------- */

  async manualImport(actor: AuthUser, input: ManualImportInput, attachment?: {
    fileName: string;
    mimeType: string;
    data: Buffer;
  }) {
    this.requirePermission(actor, "tender.import");
    const source = await this.prisma.client.tenderSource.findUnique({ where: { id: input.sourceId } });
    if (!source) throw new NotFoundException("Source not found");

    const sourceUrl = oneLine(input.sourceUrl ?? "");
    if (!sourceUrl && !attachment) {
      throw new BadRequestException(
        "A source URL or an uploaded document is required so the notice can be traced back to its origin.",
      );
    }

    const publishedAt = parseDate(input.publishedAt, "publishedAt");
    const closingAt = parseDate(input.closingAt, "closingAt");
    const openingAt = parseDate(input.openingAt, "openingAt");
    const documentUrls = (input.documentUrls ?? []).filter((url) => /^https?:\/\//i.test(url));

    const item: RawTenderItem = {
      externalId: `manual:${actor.id}:${Date.now()}`,
      sourceUrl: sourceUrl || `upload://${source.code}/${Date.now()}`,
      title: oneLine(input.title).slice(0, 300),
      referenceNumber: input.referenceNumber ?? undefined,
      organization: input.organization ?? undefined,
      department: input.department ?? undefined,
      category: input.category ?? undefined,
      province: input.province ?? undefined,
      city: input.city ?? undefined,
      tenderType: input.tenderType ?? undefined,
      publishedAt: publishedAt ? publishedAt.toISOString() : undefined,
      closingAt: closingAt ? closingAt.toISOString() : undefined,
      openingAt: openingAt ? openingAt.toISOString() : undefined,
      estimatedValue: input.estimatedValue ?? undefined,
      bidSecurity: input.bidSecurity ?? undefined,
      eligibility: input.eligibility ?? undefined,
      requiredDocuments: input.requiredDocuments ?? undefined,
      contactName: input.contactName ?? undefined,
      contactEmail: input.contactEmail ?? undefined,
      contactPhone: input.contactPhone ?? undefined,
      contactAddress: input.contactAddress ?? undefined,
      description: input.description ?? undefined,
      documentUrls: documentUrls.length > 0 ? documentUrls : undefined,
      attachments: attachment ? [attachment] : undefined,
      fieldConfidence: {
        title: 0.8,
        referenceNumber: input.referenceNumber ? 0.85 : undefined,
        organization: input.organization ? 0.85 : undefined,
        publishedAt: publishedAt ? 0.9 : undefined,
        closingAt: closingAt ? 0.9 : undefined,
      },
      raw: {
        manualImport: true,
        importedById: actor.id,
        importedByEmail: actor.email,
        providedSourceUrl: sourceUrl || null,
        uploadedFileName: attachment?.fileName ?? null,
      },
    };

    if (!item.title) throw new BadRequestException("A title is required for a manual import.");

    const result = await this.processor.importManual(input.sourceId, item);
    await this.audit(actor, "collection.import.manual", "TenderImport", result.outcome.importId, {
      to: {
        sourceId: input.sourceId,
        title: item.title,
        status: result.outcome.status,
        tenderId: result.outcome.tenderId,
      },
    });
    return {
      runId: result.runId,
      outcome: result.outcome,
      import: result.outcome.importId ? await this.importDetail(result.outcome.importId) : null,
    };
  }

  /* ----------------------------------------------------------------------- */
  /* Duplicates                                                              */
  /* ----------------------------------------------------------------------- */

  async duplicates(params: { decision?: "PENDING" | "MERGED" | "KEPT_SEPARATE" | "IGNORED"; page?: number; pageSize?: number }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const where: Prisma.TenderDuplicateReviewWhereInput = params.decision
      ? { decision: params.decision }
      : {};
    const [total, rows] = await this.prisma.client.$transaction([
      this.prisma.client.tenderDuplicateReview.count({ where }),
      this.prisma.client.tenderDuplicateReview.findMany({
        where,
        orderBy: [{ decision: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          tender: {
            select: {
              id: true,
              slug: true,
              title: true,
              status: true,
              referenceNumber: true,
              closingAt: true,
              department: { select: { name: true } },
            },
          },
          candidate: {
            select: {
              id: true,
              slug: true,
              title: true,
              status: true,
              referenceNumber: true,
              closingAt: true,
              deletedAt: true,
              department: { select: { name: true } },
            },
          },
          import: {
            select: { id: true, sourceUrl: true, confidence: true, status: true },
          },
        },
      }),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.id,
        matchType: row.matchType,
        score: row.score,
        decision: row.decision,
        signals: row.signalsJson,
        mergedTenderId: row.mergedTenderId,
        reviewedAt: iso(row.reviewedAt),
        createdAt: row.createdAt.toISOString(),
        tender: { ...row.tender, closingAt: iso(row.tender.closingAt) },
        candidate: row.candidate
          ? { ...row.candidate, closingAt: iso(row.candidate.closingAt), deletedAt: iso(row.candidate.deletedAt) }
          : null,
        import: row.import,
      })),
      meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  async resolveDuplicate(
    actor: AuthUser,
    id: string,
    decision: "MERGE" | "KEEP_SEPARATE" | "IGNORE",
    notes?: string,
  ) {
    this.requirePermission(actor, "tender.import");
    if (decision === "MERGE") this.requirePermission(actor, "tender.publish");

    const review = await this.prisma.client.tenderDuplicateReview.findUnique({
      where: { id },
      include: {
        tender: { select: { id: true, title: true, status: true } },
        candidate: { select: { id: true, title: true, status: true, deletedAt: true } },
      },
    });
    if (!review) throw new NotFoundException("Duplicate review not found");
    if (review.decision !== "PENDING") {
      throw new BadRequestException("This duplicate review has already been resolved.");
    }

    const note = oneLine(notes ?? "").slice(0, 2000);

    if (decision === "MERGE") {
      if (!review.candidate || review.candidate.deletedAt) {
        throw new BadRequestException("The candidate tender is missing or already archived.");
      }
      const primaryId = review.tenderId;
      const candidateId = review.candidate.id;
      if (primaryId === candidateId) throw new BadRequestException("A tender cannot be merged into itself.");

      await this.prisma.client.$transaction(async (tx) => {
        await tx.tenderDocument.updateMany({
          where: { tenderId: candidateId },
          data: { tenderId: primaryId },
        });
        await tx.sourceDocument.updateMany({
          where: { tenderId: candidateId },
          data: { tenderId: primaryId },
        });
        await tx.tenderImport.updateMany({
          where: { tenderId: candidateId },
          data: { tenderId: primaryId, duplicateOfId: primaryId, status: "DUPLICATE" },
        });
        await tx.tenderDuplicateReview.update({
          where: { id },
          data: {
            decision: "MERGED",
            mergedTenderId: primaryId,
            reviewedById: actor.id,
            reviewedAt: new Date(),
            signalsJson: {
              ...((review.signalsJson as Record<string, unknown> | null) ?? {}),
              resolutionNote: note || null,
              resolvedBy: actor.email,
            } as Prisma.InputJsonValue,
          },
        });
        await tx.tenderStatusHistory.create({
          data: {
            tenderId: candidateId,
            fromStatus: review.candidate?.status ?? null,
            toStatus: "ARCHIVED",
            reason: `Merged into tender ${primaryId} after duplicate review.${note ? ` ${note}` : ""}`,
            changedById: actor.id,
          },
        });
        await tx.tender.update({
          where: { id: candidateId },
          data: { status: "ARCHIVED", deletedAt: new Date(), needsReview: false },
        });
      });

      await this.audit(actor, "collection.duplicate.merge", "TenderDuplicateReview", id, {
        to: { primaryId, candidateId, notes: note || null },
      });
      return { decision: "MERGED", primaryId, candidateId };
    }

    const mapped = decision === "KEEP_SEPARATE" ? "KEPT_SEPARATE" : "IGNORED";
    await this.prisma.client.$transaction(async (tx) => {
      await tx.tenderDuplicateReview.update({
        where: { id },
        data: {
          decision: mapped,
          reviewedById: actor.id,
          reviewedAt: new Date(),
          signalsJson: {
            ...((review.signalsJson as Record<string, unknown> | null) ?? {}),
            resolutionNote: note || null,
            resolvedBy: actor.email,
          } as Prisma.InputJsonValue,
        },
      });
      if (decision === "KEEP_SEPARATE" && review.candidate) {
        const otherPending = await tx.tenderDuplicateReview.count({
          where: {
            candidateId: review.candidate.id,
            decision: "PENDING",
            id: { not: id },
          },
        });
        if (otherPending === 0) {
          await tx.tender.update({
            where: { id: review.candidate.id },
            data: { needsReview: false },
          });
        }
      }
    });

    await this.audit(actor, "collection.duplicate.resolve", "TenderDuplicateReview", id, {
      to: { decision: mapped, notes: note || null },
    });
    return { decision: mapped };
  }

  /* ----------------------------------------------------------------------- */
  /* Jobs and documents                                                      */
  /* ----------------------------------------------------------------------- */

  async jobs() {
    const [queue, deadLetters] = await Promise.all([this.queue.status(), this.queue.deadLetters(20)]);
    return { queue, deadLetters };
  }

  async retryDeadLetter(actor: AuthUser, id: string) {
    this.requirePermission(actor, "tender.import");
    const result = await this.queue.retryDeadLetter(id);
    if (!result.retried) {
      throw new BadRequestException(result.reason ?? "The dead-letter entry could not be retried.");
    }
    await this.audit(actor, "collection.job.retry", "DeadLetter", id, {
      to: { sourceId: result.sourceId },
    });
    return { success: true, sourceId: result.sourceId };
  }

  async documentFile(id: string) {
    const document = await this.prisma.client.sourceDocument.findUnique({ where: { id } });
    if (!document) throw new NotFoundException("Document not found");
    if (!document.storagePath) {
      throw new BadRequestException("This document was not stored locally; use its original URL.");
    }
    const buffer = await this.documents.readStoredFile(document.storagePath);
    if (!buffer) throw new NotFoundException("The stored document file is missing from disk.");
    return { document, buffer };
  }
}
