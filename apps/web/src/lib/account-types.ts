import type { Paginated, TenderSummary } from "@paktenders/shared-types";

export interface MyProfile {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  status: string;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  roles: string[];
  profile: {
    avatarUrl: string | null;
    jobTitle: string | null;
    bio: string | null;
    provinceId: string | null;
    cityId: string | null;
    provinceName: string | null;
    cityName: string | null;
    preferredKeywords: string[];
    businessCategories: string[];
    marketingOptIn: boolean;
  } | null;
  preference: {
    theme: string;
    language: string;
    pushEnabled: boolean;
    emailEnabled: boolean;
  } | null;
  notificationPreferences: {
    emailEnabled: boolean;
    pushEnabled: boolean;
    inAppEnabled: boolean;
    whatsappEnabled: boolean;
    smsEnabled: boolean;
    digestFrequency: "INSTANT" | "DAILY" | "WEEKLY";
    quietHoursStart: number | null;
    quietHoursEnd: number | null;
  } | null;
  subscription: {
    id: string;
    planCode: string;
    planName: string;
    status: string;
    endsAt: string | null;
  } | null;
}

export interface SavedSearchDto {
  id: string;
  name: string;
  queryJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AlertRuleDto {
  id: string;
  name: string;
  queryJson: Record<string, unknown>;
  categoryId: string | null;
  frequency: "INSTANT" | "DAILY" | "WEEKLY";
  channels: string[];
  isActive: boolean;
  lastRunAt: string | null;
  createdAt: string;
  category: { id: string; name: string; slug: string } | null;
}

export interface NotificationDto {
  id: string;
  title: string;
  body: string;
  type: string;
  data: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  items: NotificationDto[];
  unread: number;
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface MySubscription {
  id: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  autoRenew: boolean;
  plan: {
    code: string;
    name: string;
    pricePkr: string;
    interval: "MONTH" | "YEAR";
    features: Record<string, unknown>;
  };
}

export interface InvoiceDto {
  id: string;
  number: string;
  total: string;
  issuedAt: string;
  pdfUrl: string | null;
}

export type SavedTendersResponse = Paginated<TenderSummary>;
