import type {
  AuthSession,
  AuthUser,
  CategoryDto,
  DepartmentDto,
  Paginated,
  PlatformStats,
  ProvinceDto,
  SubscriptionPlanDto,
  TenderDetail,
  TenderSearchParams,
  TenderSummary,
} from "@paktenders/shared-types";
import { buildQuery } from "@paktenders/shared-utils";

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  /** Return a bearer token for authenticated requests. */
  getAccessToken?: () => string | undefined | null | Promise<string | undefined | null>;
  /** Default request timeout in ms. */
  timeoutMs?: number;
  /** Extra headers (e.g. x-forwarded-for). */
  headers?: Record<string, string>;
}

type Query = Record<string, string | number | boolean | undefined | null>;

function toQueryString(params: Query): string {
  return buildQuery(params);
}

export function createApiClient(options: ApiClientOptions) {
  const base = options.baseUrl.replace(/\/+$/, "");

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await options.getAccessToken?.();
    const headers = new Headers(init.headers);
    headers.set("accept", "application/json");
    if (init.body && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
    if (token) headers.set("authorization", `Bearer ${token}`);
    for (const [k, v] of Object.entries(options.headers ?? {})) headers.set(k, v);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);
    try {
      const res = await fetch(`${base}${path}`, {
        ...init,
        headers,
        signal: init.signal ?? controller.signal,
        cache: "no-store",
      });
      const text = await res.text();
      const data = text ? (JSON.parse(text) as unknown) : null;
      if (!res.ok) {
        const message =
          data && typeof data === "object" && "message" in data
            ? String((data as { message: unknown }).message)
            : `Request failed with status ${res.status}`;
        throw new ApiError(res.status, message, data);
      }
      return data as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    request,

    /* ------------------------------- public ------------------------------- */
    stats: () => request<PlatformStats>("/v1/stats"),

    tenders: {
      list: (params: TenderSearchParams = {}) =>
        request<Paginated<TenderSummary>>(`/v1/tenders${toQueryString(params as Query)}`),
      bySlug: (slug: string) => request<TenderDetail>(`/v1/tenders/${encodeURIComponent(slug)}`),
      similar: (slug: string, limit = 4) =>
        request<TenderSummary[]>(
          `/v1/tenders/${encodeURIComponent(slug)}/similar${toQueryString({ limit })}`,
        ),
    },

    categories: {
      list: () => request<CategoryDto[]>("/v1/categories"),
      bySlug: (slug: string) => request<CategoryDto>(`/v1/categories/${encodeURIComponent(slug)}`),
    },

    locations: {
      provinces: () => request<ProvinceDto[]>("/v1/locations/provinces"),
    },

    departments: {
      list: (params: { province?: string; limit?: number } = {}) =>
        request<DepartmentDto[]>(`/v1/departments${toQueryString(params as Query)}`),
      bySlug: (slug: string) => request<DepartmentDto>(`/v1/departments/${encodeURIComponent(slug)}`),
    },

    plans: () => request<SubscriptionPlanDto[]>("/v1/plans"),

    /* -------------------------------- auth -------------------------------- */
    auth: {
      login: (body: { email: string; password: string }) =>
        request<AuthSession>("/v1/auth/login", { method: "POST", body: JSON.stringify(body) }),
      register: (body: {
        fullName: string;
        email: string;
        password: string;
        phone?: string;
        acceptTerms: boolean;
      }) => request<AuthSession>("/v1/auth/register", { method: "POST", body: JSON.stringify(body) }),
      me: () => request<AuthUser>("/v1/auth/me"),
      refresh: (refreshToken: string) =>
        request<AuthSession>("/v1/auth/refresh", {
          method: "POST",
          body: JSON.stringify({ refreshToken }),
        }),
      logout: (refreshToken: string) =>
        request<{ success: boolean }>("/v1/auth/logout", {
          method: "POST",
          body: JSON.stringify({ refreshToken }),
        }),
    },

    /* ------------------------------- account ------------------------------ */
    account: {
      savedTenders: () => request<Paginated<TenderSummary>>("/v1/me/saved-tenders"),
      saveTender: (tenderId: string) =>
        request<{ saved: boolean }>(`/v1/me/saved-tenders/${tenderId}`, { method: "POST" }),
      unsaveTender: (tenderId: string) =>
        request<{ saved: boolean }>(`/v1/me/saved-tenders/${tenderId}`, { method: "DELETE" }),
      notifications: () => request<unknown[]>("/v1/me/notifications"),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
