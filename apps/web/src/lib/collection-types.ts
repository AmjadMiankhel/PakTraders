/**
 * Response shapes for the collection admin API (`/v1/admin/collection/*`).
 * These mirror the service return values in
 * `apps/api/src/modules/collection/collection-admin.service.ts`.
 */

export interface CollectionMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface CollectionQueueStatus {
  enabled: boolean;
  workerEnabled: boolean;
  ready: boolean;
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  completed: number;
  deadLetters: number;
}

export interface CollectionConnector {
  key: string;
  label: string;
  supportsEnrichment: boolean;
  automated: boolean;
}

export interface CollectionOverview {
  sources: {
    total: number;
    enabled: number;
    verified: number;
    failing: number;
    byStatus: Record<string, number>;
  };
  runs24h: Record<string, number>;
  imports: { byStatus: Record<string, number>; pendingReview: number };
  duplicates: { pending: number };
  documents: { total: number; bytes: number; ocrFailures: number };
  tendersNeedingReview: number;
  lastSuccessfulRun: {
    id: string;
    sourceId: string;
    finishedAt: string | null;
    itemsNew: number;
    itemsUpdated: number;
  } | null;
  upcoming: Array<{
    id: string;
    name: string;
    code: string;
    nextRunAt: string | null;
    scheduleMinutes: number;
    priority: number;
  }>;
  queue: CollectionQueueStatus;
  connectors: CollectionConnector[];
  settings: {
    collectionEnabled: boolean;
    workerEnabled: boolean;
    redisConfigured: boolean;
    ocrEnabled: boolean;
    ocrLanguages: string;
    aiCollectionEnabled: boolean;
    aiConfigured: boolean;
  };
  generatedAt: string;
}

export interface CollectionSourceRunSummary {
  id: string;
  status: string;
  trigger: string;
  startedAt: string;
  finishedAt: string | null;
  itemsFound: number;
  itemsNew: number;
  itemsFailed: number;
  errorSummary: string | null;
}

export interface CollectionSource {
  id: string;
  code: string;
  name: string;
  slug: string;
  type: string;
  category: string;
  collectionMethod: string;
  connectorKey: string;
  connectorAvailable: boolean;
  url: string | null;
  baseUrl: string | null;
  isVerified: boolean;
  isEnabled: boolean;
  status: string;
  priority: number;
  scheduleMinutes: number;
  rateLimitPerMinute: number;
  maxPages: number;
  respectRobots: boolean;
  requiresAuth: boolean;
  autoPublish: boolean;
  minConfidence: number;
  accessNotes: string | null;
  licenseNotes: string | null;
  termsUrl: string | null;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  nextRunAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  province: { id: string; name: string; slug: string } | null;
  authority: { id: string; name: string; slug: string } | null;
  newspaper: { id: string; name: string; slug: string } | null;
  counts: { tenders: number; imports: number; runs: number; documents?: number };
  lastRun: CollectionSourceRunSummary | null;
}

export type CollectionSourcesResponse = { items: CollectionSource[]; meta: CollectionMeta };

export interface CollectionSourceDetail extends CollectionSource {
  provinceId: string | null;
  authorityId: string | null;
  newspaperId: string | null;
  config: Record<string, unknown> | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
  recentRuns: Array<{
    id: string;
    status: string;
    trigger: string;
    startedAt: string;
    finishedAt: string | null;
    durationMs: number | null;
    itemsFound: number;
    itemsNew: number;
    itemsUpdated: number;
    itemsDuplicate: number;
    itemsReview: number;
    itemsFailed: number;
    documentsFetched: number;
    bytesDownloaded: number;
    errorSummary: string | null;
  }>;
}

export interface CollectionRunRow {
  id: string;
  source: { id: string; name: string; code: string; category: string };
  jobId: string | null;
  status: string;
  trigger: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  itemsFound: number;
  itemsNew: number;
  itemsUpdated: number;
  itemsDuplicate: number;
  itemsUnchanged: number;
  itemsReview: number;
  itemsFailed: number;
  documentsFetched: number;
  bytesDownloaded: number;
  errorSummary: string | null;
}

export type CollectionRunsResponse = { items: CollectionRunRow[]; meta: CollectionMeta };

export interface CollectionRunDetail extends CollectionRunRow {
  source: CollectionRunRow["source"] & { connectorKey: string };
  log: unknown;
  imports: Array<{
    id: string;
    title: string;
    status: string;
    confidence: number | null;
    sourceUrl: string;
    createdAt: string;
    tenderId: string | null;
    duplicateOfId: string | null;
    duplicateScore: number | null;
  }>;
  documents: Array<{
    id: string;
    url: string;
    fileName: string | null;
    mimeType: string | null;
    contentLength: number | null;
    sha256: string;
    ocrStatus: string;
    ocrConfidence: number | null;
    extractionConfidence: number | null;
    error: string | null;
  }>;
}

export interface CollectionImportRow {
  id: string;
  title: string;
  status: string;
  confidence: number | null;
  sourceUrl: string;
  externalId: string | null;
  changeCount: number;
  lastSeenAt: string;
  createdAt: string;
  source: { id: string; name: string; code: string; category: string };
  tender: {
    id: string;
    slug: string;
    title: string;
    status: string;
    verificationStatus: string;
    needsReview: boolean;
    closingAt: string | null;
  } | null;
  duplicateOfId: string | null;
  duplicateScore: number | null;
}

export type CollectionImportsResponse = { items: CollectionImportRow[]; meta: CollectionMeta };

export interface CollectionProvenance {
  id: string;
  field: string;
  source: string;
  value: string | null;
  confidence: number | null;
  createdAt: string;
}

export interface CollectionImportDetail {
  id: string;
  sourceKey: string | null;
  source: {
    id: string;
    name: string;
    code: string;
    category: string;
    connectorKey: string;
    url: string | null;
  };
  run: { id: string; status: string; startedAt: string; finishedAt: string | null; trigger: string } | null;
  externalId: string | null;
  sourceUrl: string;
  title: string;
  status: string;
  confidence: number | null;
  changeCount: number;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
  reviewNotes: string | null;
  duplicateOfId: string | null;
  duplicateScore: number | null;
  duplicateSignals: unknown;
  raw: unknown;
  normalized: unknown;
  document: {
    id: string;
    url: string;
    fileName: string | null;
    mimeType: string | null;
    contentLength: number | null;
    sha256: string;
    ocrStatus: string;
    ocrConfidence: number | null;
    extractionConfidence: number | null;
    pageCount: number | null;
    textContent: string | null;
    textTruncated: boolean;
    error: string | null;
    fetchedAt: string;
  } | null;
  tender: {
    id: string;
    slug: string;
    title: string;
    referenceNumber: string | null;
    description: string | null;
    summary: string | null;
    status: string;
    verificationStatus: string;
    needsReview: boolean;
    tenderType: string;
    publishedAt: string | null;
    closingAt: string | null;
    openingAt: string | null;
    estimatedValue: string | null;
    bidSecurityAmount: string | null;
    bidSecurityDetails: string | null;
    eligibility: string | null;
    requiredDocuments: string[];
    contactName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    contactAddress: string | null;
    originalUrl: string | null;
    originalDocumentUrl: string | null;
    sourceAttribution: string | null;
    extractionConfidence: number | null;
    category: { id: string; name: string; slug: string };
    province: { id: string; name: string; slug: string };
    city: { id: string; name: string; slug: string } | null;
    department: { id: string; name: string; slug: string };
    provenance: CollectionProvenance[];
    documents: Array<{
      id: string;
      fileName: string;
      fileUrl: string;
      mimeType: string | null;
      sizeBytes: number | null;
      createdAt: string;
      extractedText: string | null;
    }>;
  } | null;
  reviews: Array<{
    id: string;
    matchType: string;
    score: number;
    decision: string;
    signals: unknown;
    candidate: { id: string; slug: string; title: string; status: string } | null;
    mergedTenderId: string | null;
    reviewedAt: string | null;
    createdAt: string;
  }>;
}

export interface CollectionDuplicateRow {
  id: string;
  matchType: string;
  score: number;
  decision: string;
  signals: unknown;
  mergedTenderId: string | null;
  reviewedAt: string | null;
  createdAt: string;
  tender: {
    id: string;
    slug: string;
    title: string;
    status: string;
    referenceNumber: string | null;
    closingAt: string | null;
    department: { name: string } | null;
  };
  candidate: {
    id: string;
    slug: string;
    title: string;
    status: string;
    referenceNumber: string | null;
    closingAt: string | null;
    deletedAt: string | null;
    department: { name: string } | null;
  } | null;
  import: { id: string; sourceUrl: string; confidence: number | null; status: string } | null;
}

export type CollectionDuplicatesResponse = { items: CollectionDuplicateRow[]; meta: CollectionMeta };

export interface CollectionDeadLetter {
  id: string | null;
  name: string;
  sourceId: string | null;
  error: string;
  failedAt: string | null;
  payload: unknown;
}

export interface CollectionJobs {
  queue: CollectionQueueStatus;
  deadLetters: CollectionDeadLetter[];
}

export interface CollectionManualImportResponse {
  runId: string;
  outcome: {
    status: string;
    tenderId: string | null;
    importId: string | null;
    duplicateOfId: string | null;
    duplicateScore: number | null;
    confidence: number | null;
    documentsFetched: number;
    bytesDownloaded: number;
    message?: string;
  };
  import: CollectionImportDetail | null;
}
