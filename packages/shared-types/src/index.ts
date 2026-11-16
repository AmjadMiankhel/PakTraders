/**
 * Types shared by the API, website and mobile applications.
 * These mirror the JSON shape returned by the REST API (not the DB schema).
 */

export type TenderStatus =
  | "DRAFT"
  | "PENDING_VERIFICATION"
  | "PUBLISHED"
  | "CLOSED"
  | "CANCELLED"
  | "ARCHIVED";

export type VerificationStatus = "UNVERIFIED" | "PENDING" | "VERIFIED" | "DEMO";

export type TenderType =
  | "GOVERNMENT"
  | "PRIVATE"
  | "NGO"
  | "AUCTION"
  | "CONSULTANCY"
  | "NEWSPAPER";

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  items: T[];
  meta: PaginationMeta;
}

export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error?: string;
  requestId?: string;
}

export interface CategoryRef {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
}

export interface ProvinceRef {
  id: string;
  name: string;
  slug: string;
  code: string;
}

export interface CityRef {
  id: string;
  name: string;
  slug: string;
}

export interface DepartmentRef {
  id: string;
  name: string;
  slug: string;
  shortName?: string | null;
  type: string;
}

export interface SourceRef {
  id: string;
  name: string;
  slug: string;
  url?: string | null;
  isVerified: boolean;
}

export interface TenderSummary {
  id: string;
  slug: string;
  title: string;
  referenceNumber: string | null;
  tenderType: TenderType;
  status: TenderStatus;
  verificationStatus: VerificationStatus;
  publishedAt: string | null;
  closingAt: string | null;
  estimatedValue: string | null;
  currency: string;
  isFeatured: boolean;
  isDemo: boolean;
  category: CategoryRef;
  province: ProvinceRef;
  city: CityRef | null;
  department: DepartmentRef;
  source: SourceRef | null;
  daysRemaining: number | null;
}

export interface TenderDocumentDto {
  id: string;
  title: string;
  type: string;
  fileUrl: string;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  pageCount: number | null;
  isPublic: boolean;
  createdAt: string;
}

export interface TenderUpdateDto {
  id: string;
  title: string;
  body: string;
  updateType: string;
  publishedAt: string;
  sourceUrl: string | null;
}

export interface TenderDetail extends TenderSummary {
  description: string;
  summary: string | null;
  eligibility: string | null;
  bidSecurityAmount: string | null;
  bidSecurityDetails: string | null;
  requiredDocuments: string[];
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactAddress: string | null;
  originalUrl: string | null;
  sourceAttribution: string | null;
  openingAt: string | null;
  viewCount: number;
  updatedAt: string;
  documents: TenderDocumentDto[];
  updates: TenderUpdateDto[];
  isSaved?: boolean;
}

export interface CategoryDto extends CategoryRef {
  description: string | null;
  parentId: string | null;
  seoTitle: string | null;
  metaDescription: string | null;
  tenderCount: number;
}

export interface ProvinceDto extends ProvinceRef {
  tenderCount: number;
  cities: Array<CityRef & { tenderCount: number }>;
}

export interface DepartmentDto extends DepartmentRef {
  website: string | null;
  province: ProvinceRef | null;
  tenderCount: number;
}

export interface PlatformStats {
  publishedTenders: number;
  activeTenders: number;
  closingSoon: number;
  categories: number;
  departments: number;
  sources: number;
  demoRecords: number;
  generatedAt: string;
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  status: string;
  roles: string[];
  permissions: string[];
  emailVerified: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthSession {
  user: AuthUser;
  tokens: AuthTokens;
}

export interface SubscriptionPlanDto {
  id: string;
  code: string;
  name: string;
  description: string | null;
  pricePkr: string;
  interval: "MONTH" | "YEAR";
  features: Record<string, unknown>;
  chatbotQuota: number;
  savedTenderLimit: number | null;
  isPopular: boolean;
  sortOrder: number;
}

export interface TenderSearchParams {
  q?: string;
  category?: string;
  province?: string;
  city?: string;
  department?: string;
  type?: TenderType;
  status?: TenderStatus;
  closingWithinDays?: number;
  publishedFrom?: string;
  page?: number;
  pageSize?: number;
  sort?: "newest" | "closing" | "relevance";
}

export interface SiteSettings {
  siteName: string;
  tagline: string;
  supportEmail: string;
  supportPhone: string;
  announcement: string | null;
  maintenanceMode: boolean;
}
