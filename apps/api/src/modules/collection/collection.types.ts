import type {
  CollectionMethod,
  SourceCategory,
  TenderType,
} from "@paktenders/database";

/** Plain, serializable view of a source used by connectors. */
export interface SourceConfig {
  id: string;
  code: string;
  name: string;
  slug: string;
  category: SourceCategory;
  collectionMethod: CollectionMethod;
  connectorKey: string;
  url: string | null;
  baseUrl: string | null;
  provinceId: string | null;
  provinceSlug: string | null;
  authorityId: string | null;
  newspaperId: string | null;
  priority: number;
  scheduleMinutes: number;
  rateLimitPerMinute: number;
  maxPages: number;
  respectRobots: boolean;
  autoPublish: boolean;
  minConfidence: number;
  licenseNotes: string | null;
  accessNotes: string | null;
  termsUrl: string | null;
  config: Record<string, unknown>;
}

/**
 * A listing record exactly as a connector found it. Fields are optional
 * because sources publish different amounts of information; nothing is ever
 * filled in with guessed values at this stage.
 */
export interface RawTenderItem {
  externalId?: string;
  sourceUrl: string;
  title: string;
  referenceNumber?: string;
  organization?: string;
  department?: string;
  category?: string;
  province?: string;
  city?: string;
  tenderType?: string;
  publishedAt?: string;
  closingAt?: string;
  openingAt?: string;
  estimatedValue?: string;
  bidSecurity?: string;
  eligibility?: string;
  requiredDocuments?: string[];
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactAddress?: string;
  description?: string;
  documentUrls?: string[];
  /** In-memory documents (email attachments) handed to the document store. */
  attachments?: Array<{ fileName: string; mimeType: string; data: Buffer }>;
  /** Base confidence per field, 0..1. Listing data is normally 0.9. */
  fieldConfidence?: Record<string, number | undefined>;
  raw?: Record<string, unknown>;
}

export interface ConnectorResult {
  items: RawTenderItem[];
  pagesFetched: number;
  notes: string[];
}

/** A document that was downloaded and stored for a source. */
export interface StoredDocument {
  id: string;
  url: string;
  finalUrl: string;
  fileName: string;
  mimeType: string;
  httpStatus: number;
  contentLength: number;
  sha256: string;
  storagePath: string;
  text: string;
  textLanguage: string | null;
  pageCount: number;
  pages: Array<{ page: number; text: string; confidence: number | null }>;
  ocrStatus: "NOT_REQUIRED" | "PENDING" | "COMPLETED" | "FAILED" | "UNSUPPORTED";
  ocrConfidence: number | null;
  extractionConfidence: number | null;
  error: string | null;
}

export interface NormalizedTender {
  title: string;
  referenceNumber: string | null;
  description: string;
  summary: string | null;
  organizationName: string | null;
  departmentId: string;
  categoryId: string;
  provinceId: string;
  cityId: string | null;
  tenderType: TenderType;
  publishedAt: Date | null;
  closingAt: Date | null;
  openingAt: Date | null;
  estimatedValue: string | null;
  bidSecurityAmount: string | null;
  bidSecurityDetails: string | null;
  eligibility: string | null;
  requiredDocuments: string[];
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactAddress: string | null;
  originalUrl: string;
  originalDocumentUrl: string | null;
  confidence: number;
  fieldSources: Record<string, "SOURCE" | "AI" | "RULE" | "MANUAL">;
  fieldConfidence: Record<string, number>;
  warnings: string[];
  /** Normalized values used for duplicate detection. */
  signals: {
    normalizedTitle: string;
    normalizedReference: string | null;
    normalizedOrganization: string | null;
    documentHashes: string[];
  };
}

export interface DuplicateCandidate {
  tenderId: string;
  matchType:
    | "EXACT_SOURCE_ID"
    | "EXACT_REFERENCE"
    | "EXACT_DOCUMENT"
    | "EXACT_URL"
    | "FUZZY";
  score: number;
  signals: Record<string, unknown>;
}

export interface IngestOutcome {
  status: "NEW" | "UPDATED" | "DUPLICATE" | "NEEDS_REVIEW" | "PUBLISHED" | "REJECTED" | "FAILED" | "UNCHANGED";
  tenderId: string | null;
  importId: string | null;
  duplicateOfId: string | null;
  duplicateScore: number | null;
  confidence: number | null;
  documentsFetched: number;
  bytesDownloaded: number;
  message?: string;
}

export const COLLECTION_QUEUE = "collection";
export const COLLECTION_DLQ = "collection-dlq";

export const COLLECTION_JOB = {
  collectSource: "collect-source",
  monitorDocuments: "monitor-documents",
  reconcileDeadlines: "reconcile-deadlines",
  reconcileSources: "reconcile-sources",
} as const;

export type CollectionJobName = (typeof COLLECTION_JOB)[keyof typeof COLLECTION_JOB];

export interface CollectSourceJobData {
  sourceId: string;
  trigger: "SCHEDULE" | "MANUAL" | "RETRY" | "WEBHOOK";
  runId?: string;
}

export interface DailyJobData {
  requestedAt?: string;
}
