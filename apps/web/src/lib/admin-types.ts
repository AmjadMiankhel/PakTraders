import type { Paginated, TenderDetail, TenderSummary } from "@paktenders/shared-types";

export interface AdminOverview {
  tenders: {
    total: number;
    active: number;
    closingSoon: number;
    closed: number;
    pendingVerification: number;
    demoRecords: number;
  };
  users: { total: number; active: number; companies: number; paidSubscribers: number };
  finance: {
    revenuePkr: string;
    pendingPayments: number;
    failedPayments: number;
    refundRequests: number;
  };
  engagement: { chatbotConversations: number };
  system: {
    notificationsSent24h: number;
    notificationsFailed24h: number;
    errors24h: number;
  };
  recentActivity: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    actorEmail: string | null;
    createdAt: string;
  }>;
  generatedAt: string;
}

export interface AdminUserRow {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  status: string;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  roles: string[];
  plan: string | null;
}

export type AdminUsersResponse = Paginated<AdminUserRow>;

export interface AdminSetting {
  key: string;
  value: unknown;
  description: string | null;
  isPublic: boolean;
  updatedAt: string;
}

export interface AdminIntegration {
  key: string;
  name: string;
  category: string;
  status: string;
  hasConfiguration: boolean;
  lastCheckedAt: string | null;
  lastError: string | null;
  updatedAt: string;
}

export interface AdminAuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorEmail: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
}

export type AdminAuditResponse = Paginated<AdminAuditLog>;

export interface AdminHealth {
  api: { status: string; uptimeSeconds: number };
  database: { status: string };
  redis: { status: string };
  email: { status: string };
  ai: { status: string };
  storage: { status: string };
  push: { status: string };
  payments: { jazzcash: string; easypaisa: string; card: string };
  integrations: Array<{ key: string; status: string }>;
  timestamp: string;
}

export interface TenderSourceDto {
  id: string;
  name: string;
  slug: string;
  url: string | null;
  type: string;
  isVerified: boolean;
  _count?: { tenders: number };
}

export type AdminTendersResponse = Paginated<TenderSummary>;
export type AdminTenderDetail = TenderDetail;
