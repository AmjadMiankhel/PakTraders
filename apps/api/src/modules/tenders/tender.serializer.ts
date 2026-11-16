import type { Prisma } from "@paktenders/database";
import type {
  TenderDetail,
  TenderDocumentDto,
  TenderSummary,
  TenderUpdateDto,
} from "@paktenders/shared-types";

/** Relations required to build a TenderSummary. */
export const tenderSummaryInclude = {
  category: { select: { id: true, name: true, slug: true, icon: true } },
  province: { select: { id: true, name: true, slug: true, code: true } },
  city: { select: { id: true, name: true, slug: true } },
  department: { select: { id: true, name: true, slug: true, shortName: true, type: true } },
  source: { select: { id: true, name: true, slug: true, url: true, isVerified: true } },
} satisfies Prisma.TenderInclude;

export const tenderDetailInclude = {
  ...tenderSummaryInclude,
  documents: {
    where: { isPublic: true },
    orderBy: { createdAt: "asc" },
  },
  updates: { orderBy: { publishedAt: "desc" }, take: 20 },
} satisfies Prisma.TenderInclude;

type SummaryRow = Prisma.TenderGetPayload<{ include: typeof tenderSummaryInclude }>;
type DetailRow = Prisma.TenderGetPayload<{ include: typeof tenderDetailInclude }>;

export function daysUntil(date: Date | null): number | null {
  if (!date) return null;
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000);
}

export function toTenderSummary(row: SummaryRow): TenderSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    referenceNumber: row.referenceNumber,
    tenderType: row.tenderType,
    status: row.status,
    verificationStatus: row.verificationStatus,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    closingAt: row.closingAt?.toISOString() ?? null,
    estimatedValue: row.estimatedValue?.toString() ?? null,
    currency: row.currency,
    isFeatured: row.isFeatured,
    isDemo: row.isDemo,
    daysRemaining: daysUntil(row.closingAt),
    category: row.category,
    province: row.province,
    city: row.city,
    department: row.department,
    source: row.source,
  };
}

export function toTenderDetail(row: DetailRow, isSaved = false): TenderDetail {
  return {
    ...toTenderSummary(row),
    description: row.description,
    summary: row.summary,
    eligibility: row.eligibility,
    bidSecurityAmount: row.bidSecurityAmount?.toString() ?? null,
    bidSecurityDetails: row.bidSecurityDetails,
    requiredDocuments: row.requiredDocuments,
    contactName: row.contactName,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    contactAddress: row.contactAddress,
    originalUrl: row.originalUrl,
    sourceAttribution: row.sourceAttribution,
    openingAt: row.openingAt?.toISOString() ?? null,
    viewCount: row.viewCount,
    updatedAt: row.updatedAt.toISOString(),
    isSaved,
    documents: row.documents.map(
      (doc): TenderDocumentDto => ({
        id: doc.id,
        title: doc.title,
        type: doc.type,
        fileUrl: doc.fileUrl,
        fileName: doc.fileName,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        pageCount: doc.pageCount,
        isPublic: doc.isPublic,
        createdAt: doc.createdAt.toISOString(),
      }),
    ),
    updates: row.updates.map(
      (u): TenderUpdateDto => ({
        id: u.id,
        title: u.title,
        body: u.body,
        updateType: u.updateType,
        publishedAt: u.publishedAt.toISOString(),
        sourceUrl: u.sourceUrl,
      }),
    ),
  };
}
