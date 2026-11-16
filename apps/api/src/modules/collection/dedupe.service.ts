import { Injectable } from "@nestjs/common";
import type { Prisma } from "@paktenders/database";
import { PrismaService } from "../../common/prisma/prisma.service";
import type { DuplicateCandidate, NormalizedTender, RawTenderItem, SourceConfig } from "./collection.types";
import { normalizeOrganization, normalizeReference, normalizeTitle } from "./extraction/field-extractor";
import { titleSimilarity } from "./extraction/parse-helpers";

const DAY_MS = 86_400_000;

const candidateSelect = {
  id: true,
  title: true,
  referenceNumber: true,
  departmentId: true,
  provinceId: true,
  categoryId: true,
  publishedAt: true,
  closingAt: true,
  sourceId: true,
  sourceExternalId: true,
  originalUrl: true,
  department: { select: { name: true } },
} satisfies Prisma.TenderSelect;

type CandidateRow = Prisma.TenderGetPayload<{ select: typeof candidateSelect }>;

function dayDistance(a: Date | null, b: Date | null): number | null {
  if (!a || !b) return null;
  return Math.abs(a.getTime() - b.getTime()) / DAY_MS;
}

function dateScore(distance: number | null): number {
  if (distance === null) return 0;
  if (distance <= 3) return 1;
  if (distance <= 7) return 0.8;
  if (distance <= 21) return 0.5;
  if (distance <= 60) return 0.2;
  return 0;
}

/**
 * A source URL is only an exact duplicate signal when it identifies one notice.
 * Listing pages and site roots are shared by many tenders, so they must never
 * merge unrelated records. Deep links, documents and query URLs are accepted.
 */
function isNoticeUrl(url: string, source: SourceConfig): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.pathname === "/" || parsed.pathname === "") return false;
  const listingUrls = [source.url, source.baseUrl]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.replace(/\/+$/, ""));
  const normalized = url.replace(/\/+$/, "");
  return !listingUrls.includes(normalized);
}

export interface DedupeResult {
  candidate: DuplicateCandidate | null;
  /** Populated for exact matches so the caller can merge immediately. */
  exactTenderId: string | null;
}

@Injectable()
export class DedupeService {
  constructor(private readonly prisma: PrismaService) {}

  private scoreCandidate(
    normalized: NormalizedTender,
    row: CandidateRow,
  ): { score: number; matchType: DuplicateCandidate["matchType"] | null; signals: Record<string, unknown> } {
    const titleScore = titleSimilarity(
      normalized.signals.normalizedTitle,
      normalizeTitle(row.title),
    );
    const candidateReference = normalizeReference(row.referenceNumber);
    const referenceEqual = Boolean(
      normalized.signals.normalizedReference &&
        candidateReference &&
        normalized.signals.normalizedReference === candidateReference,
    );
    const candidateOrganization = normalizeOrganization(row.department.name);
    const organizationEqual = Boolean(
      normalized.signals.normalizedOrganization &&
        candidateOrganization &&
        normalized.signals.normalizedOrganization === candidateOrganization,
    );
    // Two published reference numbers that disagree identify different
    // procurements, even when the title template is nearly identical.
    const referenceConflict = Boolean(
      normalized.signals.normalizedReference &&
        candidateReference &&
        !referenceEqual,
    );
    const publishedDistance = dayDistance(normalized.publishedAt, row.publishedAt);
    const closingDistance = dayDistance(normalized.closingAt, row.closingAt);
    const signals = {
      titleScore: Number(titleScore.toFixed(3)),
      referenceEqual,
      organizationEqual,
      publishedDistanceDays: publishedDistance === null ? null : Number(publishedDistance.toFixed(1)),
      closingDistanceDays: closingDistance === null ? null : Number(closingDistance.toFixed(1)),
    };

    if (normalized.originalUrl && row.originalUrl === normalized.originalUrl) {
      return { score: 1, matchType: "EXACT_URL", signals };
    }

    if (referenceEqual && (organizationEqual || titleScore >= 0.5)) {
      return { score: 0.97, matchType: "EXACT_REFERENCE", signals };
    }

    // Fuzzy matching requires at least two independent agreements. A similar
    // title alone is never enough to merge two different tenders.
    const compatibleDates = (closingDistance !== null && closingDistance <= 21) ||
      (publishedDistance !== null && publishedDistance <= 21);
    const anchor = organizationEqual || referenceEqual;
    if (titleScore >= 0.55 && anchor && compatibleDates && !referenceConflict) {
      const score =
        0.5 * titleScore +
        0.25 * (organizationEqual ? 1 : 0) +
        0.15 * (referenceEqual ? 1 : 0) +
        0.1 * Math.max(dateScore(publishedDistance), dateScore(closingDistance));
      return { score, matchType: score >= 0.7 ? "FUZZY" : null, signals };
    }

    return { score: 0, matchType: null, signals };
  }

  /**
   * Finds a possible duplicate for an incoming record. Exact identifiers are
   * checked first; fuzzy matching only runs when no exact match exists and
   * always requires a second independent signal (organization or reference).
   */
  async findDuplicate(input: {
    source: SourceConfig;
    item: RawTenderItem;
    normalized: NormalizedTender;
    documentHashes: string[];
  }): Promise<DedupeResult> {
    const { source, item, normalized, documentHashes } = input;
    const externalId = item.externalId ?? null;

    if (externalId) {
      const sameExternal = await this.prisma.client.tender.findFirst({
        where: { sourceId: source.id, sourceExternalId: externalId, deletedAt: null },
        select: candidateSelect,
      });
      if (sameExternal) {
        return {
          candidate: {
            tenderId: sameExternal.id,
            matchType: "EXACT_SOURCE_ID",
            score: 1,
            signals: { externalId },
          },
          exactTenderId: sameExternal.id,
        };
      }
    }

    if (item.sourceUrl && isNoticeUrl(item.sourceUrl, source)) {
      const sameUrl = await this.prisma.client.tender.findFirst({
        where: { originalUrl: item.sourceUrl, deletedAt: null },
        select: candidateSelect,
      });
      if (sameUrl && sameUrl.id) {
        return {
          candidate: {
            tenderId: sameUrl.id,
            matchType: "EXACT_URL",
            score: 1,
            signals: { sourceUrl: item.sourceUrl },
          },
          exactTenderId: sameUrl.id,
        };
      }
    }

    if (documentHashes.length > 0) {
      const sameDocument = await this.prisma.client.sourceDocument.findFirst({
        where: { sha256: { in: documentHashes }, tenderId: { not: null } },
        select: { tenderId: true, sha256: true },
      });
      if (sameDocument?.tenderId) {
        const documentTender = await this.prisma.client.tender.findFirst({
          where: { id: sameDocument.tenderId, deletedAt: null },
          select: candidateSelect,
        });
        if (documentTender) {
          // A shared document is a strong signal but not proof: one advertisement
          // PDF can contain several unrelated tenders. Only merge when the title
          // or reference also agrees; otherwise keep looking and let the review
          // screen decide.
          const scored = this.scoreCandidate(normalized, documentTender);
          const titleScore = Number(scored.signals.titleScore ?? 0);
          const referenceEqual = Boolean(scored.signals.referenceEqual);
          if (referenceEqual || titleScore >= 0.8) {
            return {
              candidate: {
                tenderId: documentTender.id,
                matchType: "EXACT_DOCUMENT",
                score: 1,
                signals: { sha256: sameDocument.sha256, titleScore, referenceEqual },
              },
              exactTenderId: documentTender.id,
            };
          }
        }
      }
    }

    const reference = normalized.signals.normalizedReference;
    if (reference) {
      const sameDepartment = await this.prisma.client.tender.findMany({
        where: {
          departmentId: normalized.departmentId,
          referenceNumber: { not: null },
          deletedAt: null,
        },
        select: candidateSelect,
        take: 100,
      });
      const exact = sameDepartment.find(
        (row) => normalizeReference(row.referenceNumber) === reference,
      );
      if (exact) {
        return {
          candidate: {
            tenderId: exact.id,
            matchType: "EXACT_REFERENCE",
            score: 0.97,
            signals: { referenceNumber: normalized.referenceNumber, organization: normalized.organizationName },
          },
          exactTenderId: exact.id,
        };
      }
    }

    const windowStart = new Date(
      (normalized.closingAt?.getTime() ?? normalized.publishedAt?.getTime() ?? Date.now()) - 45 * DAY_MS,
    );
    const windowEnd = new Date(
      (normalized.closingAt?.getTime() ?? normalized.publishedAt?.getTime() ?? Date.now()) + 45 * DAY_MS,
    );
    const candidates = await this.prisma.client.tender.findMany({
      where: {
        deletedAt: null,
        OR: [
          { departmentId: normalized.departmentId },
          { provinceId: normalized.provinceId, categoryId: normalized.categoryId },
        ],
        AND: [
          {
            OR: [
              { closingAt: { gte: windowStart, lte: windowEnd } },
              { publishedAt: { gte: windowStart, lte: windowEnd } },
            ],
          },
        ],
      },
      select: candidateSelect,
      take: 250,
    });

    let best: { row: CandidateRow; score: number; matchType: DuplicateCandidate["matchType"]; signals: Record<string, unknown> } | null = null;
    for (const row of candidates) {
      const scored = this.scoreCandidate(normalized, row);
      if (!scored.matchType) continue;
      if (!best || scored.score > best.score) {
        best = { row, score: scored.score, matchType: scored.matchType, signals: scored.signals };
      }
    }
    if (!best) return { candidate: null, exactTenderId: null };

    return {
      candidate: {
        tenderId: best.row.id,
        matchType: best.matchType,
        score: Number(best.score.toFixed(3)),
        signals: best.signals,
      },
      exactTenderId: best.matchType === "FUZZY" ? null : best.row.id,
    };
  }
}
