import { createHash } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { loadEnv } from "@paktenders/config";
import { slugify } from "@paktenders/shared-utils";
import type { Prisma, SourceRunTrigger } from "@paktenders/database";
import { PrismaService } from "../../common/prisma/prisma.service";
import type {
  CollectSourceJobData,
  ConnectorResult,
  IngestOutcome,
  RawTenderItem,
  SourceConfig,
  StoredDocument,
} from "./collection.types";
import { getConnector, isAutomatedSource } from "./connectors/connector.registry";
import { CollectionHttpClient } from "./connectors/http-client";
import { ConnectorError, type ConnectorLogger } from "./connectors/connector.types";
import { DedupeService } from "./dedupe.service";
import { AiClassifierService } from "./extraction/ai-classifier.service";
import { cleanText, oneLine } from "./extraction/date-utils";
import { DocumentExtractorService } from "./extraction/document-extractor.service";
import { extractFields } from "./extraction/field-extractor";
import { stableStringify } from "./extraction/parse-helpers";
import { NormalizationService } from "./normalization.service";

const env = loadEnv();
const MAX_DOCUMENTS_PER_ITEM = 3;

interface SourceRow {
  id: string;
  code: string;
  name: string;
  slug: string;
  category: SourceConfig["category"];
  collectionMethod: SourceConfig["collectionMethod"];
  connectorKey: string;
  url: string | null;
  baseUrl: string | null;
  provinceId: string | null;
  authorityId: string | null;
  newspaperId: string | null;
  isVerified: boolean;
  isEnabled: boolean;
  autoPublish: boolean;
  minConfidence: number;
  priority: number;
  scheduleMinutes: number;
  rateLimitPerMinute: number;
  maxPages: number;
  respectRobots: boolean;
  licenseNotes: string | null;
  accessNotes: string | null;
  termsUrl: string | null;
  configJson: Prisma.JsonValue | null;
  province: { slug: string } | null;
}

export interface RunSummary {
  runId: string;
  sourceId: string;
  status: "SUCCEEDED" | "PARTIAL" | "FAILED" | "SKIPPED";
  itemsFound: number;
  itemsNew: number;
  itemsUpdated: number;
  itemsDuplicate: number;
  itemsUnchanged: number;
  itemsReview: number;
  itemsFailed: number;
  documentsFetched: number;
  bytesDownloaded: number;
  notes: string[];
  error: string | null;
}

function toSourceConfig(row: SourceRow): SourceConfig {
  const config =
    row.configJson && typeof row.configJson === "object" && !Array.isArray(row.configJson)
      ? (row.configJson as Record<string, unknown>)
      : {};
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    slug: row.slug,
    category: row.category,
    collectionMethod: row.collectionMethod,
    connectorKey: row.connectorKey,
    url: row.url,
    baseUrl: row.baseUrl,
    provinceId: row.provinceId,
    provinceSlug: row.province?.slug ?? null,
    authorityId: row.authorityId,
    newspaperId: row.newspaperId,
    priority: row.priority,
    scheduleMinutes: row.scheduleMinutes,
    rateLimitPerMinute: row.rateLimitPerMinute,
    maxPages: row.maxPages,
    respectRobots: row.respectRobots,
    autoPublish: row.autoPublish,
    minConfidence: row.minConfidence,
    licenseNotes: row.licenseNotes,
    accessNotes: row.accessNotes,
    termsUrl: row.termsUrl,
    config,
  };
}

function jsonSafe(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function hashOf(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function firstError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

@Injectable()
export class CollectionProcessorService {
  private readonly logger = new Logger(CollectionProcessorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly normalization: NormalizationService,
    private readonly dedupe: DedupeService,
    private readonly documents: DocumentExtractorService,
    private readonly ai: AiClassifierService,
  ) {}

  private connectorLogger(runNotes: string[]): ConnectorLogger {
    return {
      info: (message) => runNotes.push(message),
      warn: (message) => runNotes.push(`Warning: ${message}`),
      error: (message) => runNotes.push(`Error: ${message}`),
    };
  }

  private async uniqueSlug(title: string, existing?: string | null): Promise<string> {
    if (existing) return existing;
    const base = slugify(title).slice(0, 70) || "tender";
    let slug = base;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const clash = await this.prisma.client.tender.findUnique({ where: { slug }, select: { id: true } });
      if (!clash) return slug;
      slug = `${base}-${attempt + 2}`;
    }
    return `${base}-${Date.now().toString(36)}`;
  }

  private async loadSource(sourceId: string): Promise<SourceRow | null> {
    return this.prisma.client.tenderSource.findUnique({
      where: { id: sourceId },
      include: { province: { select: { slug: true } } },
    });
  }

  /**
   * Runs one collection pass for a source: fetch, enrich, extract, deduplicate
   * and store. Each item is processed independently so one bad record cannot
   * abort the whole run.
   */
  async processSource(
    sourceId: string,
    trigger: SourceRunTrigger,
    existingRunId?: string,
  ): Promise<RunSummary> {
    const sourceRow = await this.loadSource(sourceId);
    if (!sourceRow) throw new Error(`Source ${sourceId} does not exist.`);
    const source = toSourceConfig(sourceRow);

    const run = existingRunId
      ? await this.prisma.client.sourceRun.update({
          where: { id: existingRunId },
          data: { status: "RUNNING", trigger, startedAt: new Date(), finishedAt: null, errorSummary: null },
        })
      : await this.prisma.client.sourceRun.create({
          data: { sourceId, status: "RUNNING", trigger },
        });

    const summary: RunSummary = {
      runId: run.id,
      sourceId,
      status: "SUCCEEDED",
      itemsFound: 0,
      itemsNew: 0,
      itemsUpdated: 0,
      itemsDuplicate: 0,
      itemsUnchanged: 0,
      itemsReview: 0,
      itemsFailed: 0,
      documentsFetched: 0,
      bytesDownloaded: 0,
      notes: [],
      error: null,
    };

    await this.prisma.client.tenderSource.update({
      where: { id: sourceId },
      data: { lastRunAt: new Date() },
    });

    if (!isAutomatedSource(source)) {
      summary.status = "SKIPPED";
      summary.notes.push("Manual-import source: the scheduler does not fetch it.");
      await this.finishRun(run.id, summary);
      await this.prisma.client.tenderSource.update({
        where: { id: sourceId },
        data: { nextRunAt: null },
      });
      return summary;
    }

    if (!sourceRow.isEnabled) {
      summary.status = "SKIPPED";
      summary.notes.push("Source is disabled in the admin dashboard.");
      await this.finishRun(run.id, summary);
      return summary;
    }

    const http = new CollectionHttpClient({
      sourceId,
      userAgent: env.COLLECTION_USER_AGENT,
      timeoutMs: env.COLLECTION_HTTP_TIMEOUT_MS,
      rateLimitPerMinute: source.rateLimitPerMinute,
      maxBytes: env.COLLECTION_MAX_DOCUMENT_MB * 1024 * 1024,
      respectRobots: source.respectRobots,
    });

    let connectorResult: ConnectorResult | null = null;
    try {
      const connector = getConnector(source.connectorKey);
      const known = await this.prisma.client.tenderImport.findMany({
        where: { sourceId, externalId: { not: null } },
        select: { externalId: true },
        take: 10_000,
      });
      connectorResult = await connector.collect({
        source,
        http,
        logger: this.connectorLogger(summary.notes),
        knownExternalIds: new Set(known.map((row) => row.externalId).filter((value): value is string => Boolean(value))),
        maxItems: env.COLLECTION_MAX_ITEMS_PER_RUN,
      });
      summary.notes.push(...connectorResult.notes);
    } catch (error) {
      summary.error = firstError(error);
      summary.status = "FAILED";
      this.logger.warn(`Collection failed for ${source.code}: ${summary.error}`);
      await this.finishRun(run.id, summary);
      await this.registerFailure(sourceRow, summary.error);
      return summary;
    }

    const items = connectorResult.items;
    summary.itemsFound = items.length;

    for (const item of items) {
      try {
        const outcome = await this.processItem(source, item, run.id, summary.notes);
        summary.documentsFetched += outcome.documentsFetched;
        summary.bytesDownloaded += outcome.bytesDownloaded;
        switch (outcome.status) {
          case "NEW":
          case "PUBLISHED":
            summary.itemsNew += 1;
            if (outcome.status === "NEW") summary.itemsReview += 1;
            break;
          case "UPDATED":
            summary.itemsUpdated += 1;
            break;
          case "DUPLICATE":
            summary.itemsDuplicate += 1;
            break;
          case "NEEDS_REVIEW":
            summary.itemsReview += 1;
            break;
          case "UNCHANGED":
            summary.itemsUnchanged += 1;
            break;
          case "REJECTED":
          case "FAILED":
            summary.itemsFailed += 1;
            break;
        }
      } catch (error) {
        summary.itemsFailed += 1;
        const message = firstError(error);
        summary.notes.push(`Item failed: ${item.title.slice(0, 120)} — ${message}`);
        this.logger.warn(`Item failed for ${source.code}: ${message}`);
      }
      // Long sources can take many minutes at the configured rate limit. Keep
      // the run counters live so the admin dashboard is not stuck at zero.
      await this.updateRunProgress(run.id, summary);
    }

    summary.status = summary.itemsFailed > 0 ? (summary.itemsNew + summary.itemsUpdated > 0 ? "PARTIAL" : "FAILED") : "SUCCEEDED";
    if (summary.status === "FAILED" && !summary.error) {
      summary.error = `${summary.itemsFailed} item(s) failed during collection.`;
    }
    await this.finishRun(run.id, summary);
    if (summary.status === "FAILED") {
      await this.registerFailure(sourceRow, summary.error ?? "Collection failed.");
    } else {
      await this.prisma.client.tenderSource.update({
        where: { id: sourceId },
        data: {
          lastSuccessAt: new Date(),
          lastError: summary.itemsFailed > 0 ? (summary.error ?? null) : null,
          consecutiveFailures: 0,
          nextRunAt: new Date(Date.now() + source.scheduleMinutes * 60_000),
        },
      });
    }
    return summary;
  }

  private async updateRunProgress(runId: string, summary: RunSummary): Promise<void> {
    try {
      await this.prisma.client.sourceRun.update({
        where: { id: runId },
        data: {
          itemsFound: summary.itemsFound,
          itemsNew: summary.itemsNew,
          itemsUpdated: summary.itemsUpdated,
          itemsDuplicate: summary.itemsDuplicate,
          itemsUnchanged: summary.itemsUnchanged,
          itemsReview: summary.itemsReview,
          itemsFailed: summary.itemsFailed,
          documentsFetched: summary.documentsFetched,
          bytesDownloaded: summary.bytesDownloaded,
        },
      });
    } catch (error) {
      this.logger.warn(`Could not update run progress: ${firstError(error)}`);
    }
  }

  private async finishRun(runId: string, summary: RunSummary): Promise<void> {
    const run = await this.prisma.client.sourceRun.findUnique({
      where: { id: runId },
      select: { startedAt: true },
    });
    const finishedAt = new Date();
    await this.prisma.client.sourceRun.update({
      where: { id: runId },
      data: {
        status: summary.status,
        finishedAt,
        durationMs: run ? Math.max(0, finishedAt.getTime() - run.startedAt.getTime()) : null,
        itemsFound: summary.itemsFound,
        itemsNew: summary.itemsNew,
        itemsUpdated: summary.itemsUpdated,
        itemsDuplicate: summary.itemsDuplicate,
        itemsUnchanged: summary.itemsUnchanged,
        itemsReview: summary.itemsReview,
        itemsFailed: summary.itemsFailed,
        documentsFetched: summary.documentsFetched,
        bytesDownloaded: summary.bytesDownloaded,
        errorSummary: summary.error,
        logJson: jsonSafe({ notes: summary.notes.slice(0, 200) }),
      },
    });
  }

  private async registerFailure(source: SourceRow, error: string): Promise<void> {
    const failures = await this.prisma.client.tenderSource.findUnique({
      where: { id: source.id },
      select: { consecutiveFailures: true, scheduleMinutes: true },
    });
    const consecutive = (failures?.consecutiveFailures ?? 0) + 1;
    const baseMinutes = failures?.scheduleMinutes ?? source.scheduleMinutes ?? 60;
    const backoffMinutes = Math.min(baseMinutes * 2 ** Math.min(consecutive - 1, 5), 24 * 60);
    await this.prisma.client.tenderSource.update({
      where: { id: source.id },
      data: {
        lastError: error.slice(0, 2000),
        consecutiveFailures: consecutive,
        nextRunAt: new Date(Date.now() + backoffMinutes * 60_000),
      },
    });
  }

  private async processItem(
    source: SourceConfig,
    rawItem: RawTenderItem,
    runId: string,
    runNotes: string[],
  ): Promise<IngestOutcome> {
    const connector = getConnector(source.connectorKey);
    let item = rawItem;
    if (connector.supportsEnrichment && /^https?:\/\//i.test(item.sourceUrl)) {
      try {
        item = await connector.enrich?.(
          {
            source,
            http: new CollectionHttpClient({
              sourceId: source.id,
              userAgent: env.COLLECTION_USER_AGENT,
              timeoutMs: env.COLLECTION_HTTP_TIMEOUT_MS,
              rateLimitPerMinute: source.rateLimitPerMinute,
              maxBytes: env.COLLECTION_MAX_DOCUMENT_MB * 1024 * 1024,
              respectRobots: source.respectRobots,
            }),
            logger: this.connectorLogger(runNotes),
            knownExternalIds: new Set(),
            maxItems: 1,
          },
          item,
        ) ?? item;
      } catch (error) {
        runNotes.push(`Detail page could not be read (${item.sourceUrl}): ${firstError(error)}`);
      }
    }

    const externalId =
      item.externalId ??
      createHash("sha1").update(`${source.id}|${item.sourceUrl}|${item.title}`).digest("hex").slice(0, 24);
    const sourceKey = `${source.code}:${externalId}`.slice(0, 200);
    const itemForJson = { ...item, attachments: undefined };
    const rawHash = hashOf({
      title: item.title,
      referenceNumber: item.referenceNumber,
      organization: item.organization,
      department: item.department,
      category: item.category,
      province: item.province,
      city: item.city,
      tenderType: item.tenderType,
      publishedAt: item.publishedAt,
      closingAt: item.closingAt,
      openingAt: item.openingAt,
      estimatedValue: item.estimatedValue,
      bidSecurity: item.bidSecurity,
      description: item.description,
      documentUrls: item.documentUrls,
      raw: item.raw,
    });

    const existingImport = await this.prisma.client.tenderImport.findUnique({
      where: { sourceKey },
      include: { tender: { select: { id: true, slug: true, status: true, closingAt: true, title: true } } },
    });

    if (existingImport?.tenderId && existingImport.rawHash === rawHash) {
      await this.prisma.client.tenderImport.update({
        where: { id: existingImport.id },
        data: { lastSeenAt: new Date(), runId },
      });
      await this.prisma.client.tender.update({
        where: { id: existingImport.tenderId },
        data: { lastCheckedAt: new Date() },
      });
      return {
        status: "UNCHANGED",
        tenderId: existingImport.tenderId,
        importId: existingImport.id,
        duplicateOfId: null,
        duplicateScore: null,
        confidence: existingImport.confidence,
        documentsFetched: 0,
        bytesDownloaded: 0,
      };
    }

    const storedDocuments: StoredDocument[] = [];
    const documentHashes: string[] = [];
    const documentIds: string[] = [];
    let bytesDownloaded = 0;

    const documentUrls = Array.from(
      new Set([...(item.documentUrls ?? []), ...(rawItem.documentUrls ?? [])].filter((url) => /^https?:\/\//i.test(url))),
    ).slice(0, MAX_DOCUMENTS_PER_ITEM);

    for (const url of documentUrls) {
      const fetched = await this.documents.fetchDocument({
        source,
        runId,
        http: new CollectionHttpClient({
          sourceId: source.id,
          userAgent: env.COLLECTION_USER_AGENT,
          timeoutMs: env.COLLECTION_HTTP_TIMEOUT_MS,
          rateLimitPerMinute: source.rateLimitPerMinute,
          maxBytes: env.COLLECTION_MAX_DOCUMENT_MB * 1024 * 1024,
          respectRobots: source.respectRobots,
        }),
        url,
        maxBytes: env.COLLECTION_MAX_DOCUMENT_MB * 1024 * 1024,
      });
      if (!fetched) continue;
      storedDocuments.push(fetched.stored);
      documentIds.push(fetched.document.id);
      if (fetched.stored.sha256) documentHashes.push(fetched.stored.sha256);
      bytesDownloaded += fetched.stored.contentLength;
      if (fetched.stored.error) {
        runNotes.push(`Document issue (${url}): ${fetched.stored.error}`);
      }
    }

    for (const attachment of (item.attachments ?? []).slice(0, 5)) {
      try {
        const stored = await this.documents.storeDocumentBuffer({
          source,
          runId,
          buffer: attachment.data,
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          url: item.sourceUrl,
          finalUrl: item.sourceUrl,
          httpStatus: 0,
        });
        storedDocuments.push(stored.stored);
        documentIds.push(stored.document.id);
        if (stored.stored.sha256) documentHashes.push(stored.stored.sha256);
        bytesDownloaded += stored.stored.contentLength;
      } catch (error) {
        runNotes.push(`Attachment could not be stored (${attachment.fileName}): ${firstError(error)}`);
      }
    }

    const documentText = cleanText(
      storedDocuments
        .map((document) => document.text || document.pages.map((page) => page.text).join("\n"))
        .filter(Boolean)
        .join("\n\n"),
    ).slice(0, 40_000);

    const extractionText = cleanText(
      [item.title, item.description ?? "", documentText].filter(Boolean).join("\n\n"),
    ).slice(0, 60_000);

    const locationContext = await this.normalization.locationContext(source);
    const extracted = extractFields(extractionText, locationContext);

    let aiResult = null;
    if (this.ai.enabled) {
      const aiContext = await this.normalization.aiContext();
      aiResult = await this.ai.enrich({
        title: item.title,
        organization: item.organization ?? item.department ?? null,
        text: documentText || item.description || item.title,
        sourceName: source.name,
        ...aiContext,
      });
    }

    const normalized = await this.normalization.normalize({
      source,
      item,
      extracted,
      ai: aiResult,
      documentText,
      documentHashes,
      documentIds,
    });

    const dedupe = await this.dedupe.findDuplicate({
      source,
      item,
      normalized,
      documentHashes,
    });

    const existingTenderId = existingImport?.tenderId ?? null;
    if (dedupe.exactTenderId && !existingTenderId) {
      const importRecord = await this.prisma.client.tenderImport.upsert({
        where: { sourceKey },
        create: {
          sourceKey,
          sourceId: source.id,
          runId,
          externalId,
          sourceUrl: item.sourceUrl,
          title: normalized.title,
          rawJson: jsonSafe(itemForJson),
          rawHash,
          normalizedJson: jsonSafe(normalized),
          status: "DUPLICATE",
          confidence: normalized.confidence,
          duplicateOfId: dedupe.exactTenderId,
          duplicateScore: dedupe.candidate?.score ?? 1,
          duplicateSignals: jsonSafe(dedupe.candidate?.signals ?? {}),
          lastSeenAt: new Date(),
        },
        update: {
          runId,
          sourceUrl: item.sourceUrl,
          title: normalized.title,
          rawJson: jsonSafe(itemForJson),
          rawHash,
          normalizedJson: jsonSafe(normalized),
          status: "DUPLICATE",
          confidence: normalized.confidence,
          duplicateOfId: dedupe.exactTenderId,
          duplicateScore: dedupe.candidate?.score ?? 1,
          duplicateSignals: jsonSafe(dedupe.candidate?.signals ?? {}),
          lastSeenAt: new Date(),
          changeCount: { increment: 1 },
        },
      });

      await this.prisma.client.tenderDuplicateReview.create({
        data: {
          tenderId: dedupe.exactTenderId,
          importId: importRecord.id,
          matchType: dedupe.candidate?.matchType ?? "EXACT_SOURCE_ID",
          score: dedupe.candidate?.score ?? 1,
          signalsJson: jsonSafe({ ...dedupe.candidate?.signals, automatic: true, source: source.code }),
          decision: "MERGED",
          mergedTenderId: dedupe.exactTenderId,
          reviewedAt: new Date(),
        },
      });
      await this.prisma.client.tender.update({
        where: { id: dedupe.exactTenderId },
        data: { lastCheckedAt: new Date() },
      });

      return {
        status: "DUPLICATE",
        tenderId: null,
        importId: importRecord.id,
        duplicateOfId: dedupe.exactTenderId,
        duplicateScore: dedupe.candidate?.score ?? 1,
        confidence: normalized.confidence,
        documentsFetched: storedDocuments.filter((document) => document.storagePath).length,
        bytesDownloaded,
      };
    }

    const now = new Date();
    const autoPublish =
      source.autoPublish &&
      normalized.confidence >= source.minConfidence &&
      Boolean(normalized.closingAt) &&
      Boolean(normalized.referenceNumber);
    const derivedStatus = normalized.closingAt && normalized.closingAt.getTime() < now.getTime()
      ? "CLOSED"
      : "PUBLISHED";

    let targetTenderId = existingTenderId;
    let changed = false;
    let status: "PUBLISHED" | "PENDING_VERIFICATION" | "CLOSED" | "CANCELLED" | "ARCHIVED" | "DRAFT" =
      "PENDING_VERIFICATION";

    if (targetTenderId) {
      const existing = await this.prisma.client.tender.findUnique({
        where: { id: targetTenderId },
        select: { status: true, closingAt: true, title: true, publishedAt: true },
      });
      if (!existing) targetTenderId = null;
      else {
        status =
          existing.status === "ARCHIVED" || existing.status === "CANCELLED"
            ? existing.status
            : existing.status === "PUBLISHED"
              ? derivedStatus === "CLOSED"
                ? "CLOSED"
                : "PUBLISHED"
              : existing.status === "CLOSED"
                ? "CLOSED"
                : autoPublish
                  ? derivedStatus
                  : "PENDING_VERIFICATION";
        changed =
          existing.title !== normalized.title ||
          (existing.closingAt?.getTime() ?? null) !== (normalized.closingAt?.getTime() ?? null) ||
          existing.status !== status;
      }
    }

    const tenderData = {
      title: normalized.title,
      referenceNumber: normalized.referenceNumber,
      description: normalized.description,
      summary: normalized.summary,
      categoryId: normalized.categoryId,
      departmentId: normalized.departmentId,
      provinceId: normalized.provinceId,
      cityId: normalized.cityId,
      sourceId: source.id,
      authorityId: source.authorityId,
      newspaperId: source.newspaperId,
      tenderType: normalized.tenderType,
      status,
      verificationStatus:
        autoPublish && source.autoPublish && normalized.confidence >= 0.85
          ? ("VERIFIED" as const)
          : ("PENDING" as const),
      closingAt: normalized.closingAt,
      openingAt: normalized.openingAt,
      estimatedValue: normalized.estimatedValue,
      bidSecurityAmount: normalized.bidSecurityAmount,
      bidSecurityDetails: normalized.bidSecurityDetails,
      eligibility: normalized.eligibility,
      requiredDocuments: normalized.requiredDocuments,
      contactName: normalized.contactName,
      contactEmail: normalized.contactEmail,
      contactPhone: normalized.contactPhone,
      contactAddress: normalized.contactAddress,
      originalUrl: /^https?:\/\//i.test(normalized.originalUrl) ? normalized.originalUrl : null,
      originalDocumentUrl: normalized.originalDocumentUrl,
      sourceAttribution: /^https?:\/\//i.test(item.sourceUrl)
        ? `${source.name} — ${item.sourceUrl}`
        : `${source.name} — administrator upload`,
      sourceExternalId: externalId,
      sourceContentHash: rawHash,
      sourceMetadata: jsonSafe({ connector: source.connectorKey, externalId, raw: item.raw ?? {} }),
      extractionConfidence: normalized.confidence,
      needsReview:
        !autoPublish ||
        normalized.confidence < 0.8 ||
        !normalized.closingAt ||
        !normalized.referenceNumber ||
        storedDocuments.some((document) => document.ocrStatus === "FAILED"),
      lastCheckedAt: now,
      lastChangedAt: changed ? now : undefined,
      deletedAt: null,
    };

    let tender;
    if (targetTenderId) {
      tender = await this.prisma.client.tender.update({
        where: { id: targetTenderId },
        data: {
          ...tenderData,
          ...(normalized.publishedAt ? { publishedAt: normalized.publishedAt } : {}),
        },
      });
      if (changed) {
        const changeType = normalized.closingAt &&
          (existingImport?.tender?.closingAt?.getTime() ?? 0) !== normalized.closingAt.getTime()
          ? "DEADLINE_EXTENSION"
          : "CORRIGENDUM";
        await this.prisma.client.tenderUpdate.create({
          data: {
            tenderId: tender.id,
            title: changeType === "DEADLINE_EXTENSION" ? "Closing date updated by the source" : "Notice updated by the source",
            body: `The source published an updated version of this notice. New closing date: ${
              normalized.closingAt?.toISOString() ?? "not published"
            }. Source: ${item.sourceUrl}`,
            updateType: changeType,
            publishedAt: now,
            sourceUrl: item.sourceUrl,
          },
        });
      }
    } else {
      const slug = await this.uniqueSlug(normalized.title, existingImport?.tender?.slug);
      tender = await this.prisma.client.tender.create({
        data: {
          ...tenderData,
          slug,
          publishedAt: normalized.publishedAt,
          isDemo: false,
          isFeatured: false,
        },
      });
      changed = true;
    }

    await this.prisma.client.tenderDocument.deleteMany({
      where: {
        tenderId: tender.id,
        sha256: { in: storedDocuments.map((document) => document.sha256).filter(Boolean) },
      },
    });

    for (const document of storedDocuments) {
      if (!document.storagePath) continue;
      // Administrator uploads have no public URL. They are stored for audit
      // and admin download but must not be exposed as a public document link.
      const publicUrl = /^https?:\/\//i.test(document.finalUrl || document.url)
        ? document.finalUrl || document.url
        : "";
      const alreadyLinked = await this.prisma.client.tenderDocument.findFirst({
        where: { tenderId: tender.id, sha256: document.sha256 },
        select: { id: true },
      });
      if (!alreadyLinked) {
        await this.prisma.client.tenderDocument.create({
          data: {
            tenderId: tender.id,
            title: document.fileName,
            type: /corrigendum|addendum|amendment/i.test(document.text) ? "CORRIGENDUM" : "TENDER_NOTICE",
            fileUrl: publicUrl,
            fileName: document.fileName,
            fileSize: document.contentLength,
            mimeType: document.mimeType,
            pageCount: document.pageCount,
            extractedText: document.text.slice(0, 200_000),
            originalUrl: /^https?:\/\//i.test(document.url) ? document.url : null,
            sha256: document.sha256,
            ocrUsed: document.ocrStatus === "COMPLETED",
            extractionConfidence: document.extractionConfidence,
            pageReferences: jsonSafe(
              document.pages.map((page) => ({ page: page.page, confidence: page.confidence })),
            ),
            isPublic: Boolean(publicUrl),
          },
        });
      }
      if (document.id) {
        await this.prisma.client.sourceDocument.update({
          where: { id: document.id },
          data: { tenderId: tender.id },
        });
      }
    }

    if (changed) {
      await this.prisma.client.tenderProvenance.deleteMany({ where: { tenderId: tender.id } });
      const provenance: Array<{
        field: string;
        value: string | null;
        source: "SOURCE" | "AI" | "RULE" | "MANUAL";
        confidence: number | null;
        documentId: string | null;
      }> = [];
      const add = (field: string, value: unknown, fallbackSource: "SOURCE" | "AI" | "RULE" = "SOURCE") => {
        if (value === null || value === undefined || value === "") return;
        const text = value instanceof Date ? value.toISOString() : String(value);
        provenance.push({
          field,
          value: text.slice(0, 5000),
          source: normalized.fieldSources[field] ?? fallbackSource,
          confidence: normalized.fieldConfidence[field] ?? null,
          documentId: storedDocuments[0]?.id || null,
        });
      };
      add("title", normalized.title);
      add("referenceNumber", normalized.referenceNumber);
      add("organization", normalized.organizationName);
      add("categorySlug", normalized.categoryId, "RULE");
      add("provinceSlug", normalized.provinceId, "RULE");
      add("citySlug", normalized.cityId, "RULE");
      add("tenderType", normalized.tenderType, "RULE");
      add("publishedAt", normalized.publishedAt);
      add("closingAt", normalized.closingAt);
      add("openingAt", normalized.openingAt);
      add("estimatedValue", normalized.estimatedValue);
      add("bidSecurityAmount", normalized.bidSecurityAmount);
      add("eligibility", normalized.eligibility);
      add("summary", normalized.summary, "AI");
      add("contactEmail", normalized.contactEmail);
      add("contactPhone", normalized.contactPhone);
      if (provenance.length > 0) {
        await this.prisma.client.tenderProvenance.createMany({
          data: provenance.map((entry) => ({ ...entry, tenderId: tender.id })),
        });
      }
    }

    const importStatus = targetTenderId
      ? "UPDATED"
      : autoPublish
        ? "PUBLISHED"
        : "NEEDS_REVIEW";
    const importRecord = await this.prisma.client.tenderImport.upsert({
      where: { sourceKey },
      create: {
        sourceKey,
        sourceId: source.id,
        runId,
        externalId,
        sourceUrl: item.sourceUrl,
        title: normalized.title,
        rawJson: jsonSafe(item),
        rawHash,
        normalizedJson: jsonSafe(normalized),
        status: importStatus,
        confidence: normalized.confidence,
        tenderId: tender.id,
        reviewNotes: normalized.warnings.length > 0 ? normalized.warnings.join("\n").slice(0, 4000) : null,
        lastSeenAt: now,
      },
      update: {
        runId,
        externalId,
        sourceUrl: item.sourceUrl,
        title: normalized.title,
        rawJson: jsonSafe(item),
        rawHash,
        normalizedJson: jsonSafe(normalized),
        status: importStatus,
        confidence: normalized.confidence,
        tenderId: tender.id,
        reviewNotes: normalized.warnings.length > 0 ? normalized.warnings.join("\n").slice(0, 4000) : null,
        lastSeenAt: now,
        changeCount: existingImport ? { increment: 1 } : undefined,
      },
    });

    if (dedupe.candidate && dedupe.candidate.matchType === "FUZZY") {
      await this.prisma.client.tenderDuplicateReview.create({
        data: {
          tenderId: dedupe.candidate.tenderId,
          candidateId: tender.id,
          importId: importRecord.id,
          matchType: "FUZZY",
          score: dedupe.candidate.score,
          signalsJson: jsonSafe({ ...dedupe.candidate.signals, source: source.code }),
          decision: "PENDING",
        },
      });
      await this.prisma.client.tender.update({
        where: { id: tender.id },
        data: { needsReview: true },
      });
    }

    return {
      status: targetTenderId ? "UPDATED" : autoPublish ? "PUBLISHED" : "NEEDS_REVIEW",
      tenderId: tender.id,
      importId: importRecord.id,
      duplicateOfId: dedupe.candidate?.tenderId ?? null,
      duplicateScore: dedupe.candidate?.score ?? null,
      confidence: normalized.confidence,
      documentsFetched: storedDocuments.filter((document) => document.storagePath).length,
      bytesDownloaded,
      message: normalized.warnings.join(" ") || undefined,
    };
  }

  /** Convenience wrapper used by the queue worker. */
  async processJob(data: CollectSourceJobData): Promise<RunSummary> {
    const summary = await this.processSource(data.sourceId, data.trigger, data.runId);
    // A failed run is recorded in SourceRun before this point. Throwing lets
    // BullMQ apply its exponential retry policy and, after the final attempt,
    // route the job to the dead-letter queue.
    if (summary.status === "FAILED") {
      throw new Error(summary.error ?? `Collection run for source ${data.sourceId} failed.`);
    }
    return summary;
  }

  /**
   * Manual administrator import. The record goes through exactly the same
   * extraction, deduplication and review pipeline as an automated item.
   */
  async importManual(
    sourceId: string,
    item: RawTenderItem,
  ): Promise<{ runId: string; outcome: IngestOutcome }> {
    const sourceRow = await this.loadSource(sourceId);
    if (!sourceRow) throw new Error(`Source ${sourceId} does not exist.`);
    const source = toSourceConfig(sourceRow);
    const run = await this.prisma.client.sourceRun.create({
      data: { sourceId, status: "RUNNING", trigger: "MANUAL" },
    });
    const notes: string[] = ["Manual administrator import."];

    const summary: RunSummary = {
      runId: run.id,
      sourceId,
      status: "SUCCEEDED",
      itemsFound: 1,
      itemsNew: 0,
      itemsUpdated: 0,
      itemsDuplicate: 0,
      itemsUnchanged: 0,
      itemsReview: 0,
      itemsFailed: 0,
      documentsFetched: 0,
      bytesDownloaded: 0,
      notes,
      error: null,
    };

    try {
      const outcome = await this.processItem(source, item, run.id, notes);
      summary.documentsFetched = outcome.documentsFetched;
      summary.bytesDownloaded = outcome.bytesDownloaded;
      if (outcome.status === "PUBLISHED") summary.itemsNew = 1;
      else if (outcome.status === "UPDATED") summary.itemsUpdated = 1;
      else if (outcome.status === "DUPLICATE") summary.itemsDuplicate = 1;
      else if (outcome.status === "UNCHANGED") summary.itemsUnchanged = 1;
      else summary.itemsReview = 1;
      await this.finishRun(run.id, summary);
      await this.prisma.client.tenderSource.update({
        where: { id: sourceId },
        data: {
          lastRunAt: new Date(),
          lastSuccessAt: new Date(),
          lastError: null,
          consecutiveFailures: 0,
        },
      });
      return { runId: run.id, outcome };
    } catch (error) {
      summary.status = "FAILED";
      summary.itemsFailed = 1;
      summary.error = firstError(error);
      await this.finishRun(run.id, summary);
      throw error;
    }
  }

  /** Called when a queued job exhausts its retries. */
  async recordDeadLetter(sourceId: string, error: string): Promise<void> {
    await this.prisma.client.tenderSource.update({
      where: { id: sourceId },
      data: { lastError: `Dead letter: ${error}`.slice(0, 2000) },
    });
  }
}
