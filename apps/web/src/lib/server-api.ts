import { cookies } from "next/headers";
import { ACCESS_COOKIE } from "./auth-cookies";
import { API_BASE_URL } from "./api-base";

export { API_BASE_URL };

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

export async function getAccessToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(ACCESS_COOKIE)?.value ?? null;
}

/**
 * Server-side render budget for one API call.
 *
 * A page renders in one request, so a slow or unreachable API holds the whole
 * response open. Front proxies (Hostinger's LiteSpeed/CDN among them) close a
 * long-running stream and the visitor keeps the flushed shell with an empty
 * <main>. Six seconds is far beyond a healthy API (tens of milliseconds) and
 * well inside every proxy timeout we deploy behind. The circuit breaker below
 * keeps a sustained outage from costing the budget on every request.
 */
const FETCH_TIMEOUT_MS = (() => {
  const configured = Number(process.env.API_FETCH_TIMEOUT_MS);
  return Number.isFinite(configured) && configured >= 500 ? configured : 6_000;
})();

/**
 * Short-lived circuit breaker for the API.
 *
 * When the API is unreachable, every render would spend the whole fetch budget
 * waiting for it. A page that fans out to four endpoints then holds a Node
 * worker — and the visitor — for seconds, and the front proxy can drop the
 * stream before the content is flushed, leaving a permanent loading skeleton.
 * After one connectivity or 5xx failure, later calls fail fast for a short
 * window so pages render their fallbacks immediately and the API gets room to
 * recover.
 */
const API_DOWN_COOLDOWN_MS = 10_000;
let apiDownUntil = 0;

function isApiUnavailable(error: unknown, callerSignal?: AbortSignal | null): boolean {
  // The caller cancelled the request (client navigation); that says nothing
  // about the API's health. Our own timeout is a genuine unavailability signal.
  if (callerSignal?.aborted) return false;
  if (error instanceof ApiError) return error.status >= 500;
  // Timeouts (AbortError), DNS failures and refused connections all land here.
  return true;
}

type ApiFetchOptions = Omit<RequestInit, "cache"> & {
  token?: string | null;
  /** Skip reading the access-token cookie (public requests). */
  anonymous?: boolean;
};

function messageFromBody(data: unknown, status: number): string {
  if (data && typeof data === "object" && "message" in data) {
    const message = (data as { message: unknown }).message;
    if (Array.isArray(message)) return message.join(", ");
    if (typeof message === "string") return message;
  }
  return `Request failed with status ${status}`;
}

/** Server-side fetch against the NestJS API. Never caches user data. */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  if (Date.now() < apiDownUntil) {
    throw new ApiError(503, "The API is temporarily unavailable");
  }

  const { token, anonymous, headers: extraHeaders, ...init } = options;
  const resolvedToken = anonymous ? null : token !== undefined ? token : await getAccessToken();

  const headers = new Headers(extraHeaders);
  headers.set("accept", "application/json");
  // Identify server-side renders so the API can exclude them from the public
  // per-IP rate limit. This header is never exposed to the browser.
  const internalKey = process.env.INTERNAL_API_KEY;
  if (internalKey) headers.set("x-internal-key", internalKey);
  if (typeof init.body === "string" && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  if (resolvedToken) headers.set("authorization", `Bearer ${resolvedToken}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      cache: "no-store",
      signal: init.signal ?? controller.signal,
    });
    const text = await response.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    if (!response.ok) {
      throw new ApiError(response.status, messageFromBody(data, response.status), data);
    }
    apiDownUntil = 0;
    return data as T;
  } catch (error) {
    if (isApiUnavailable(error, init.signal)) {
      apiDownUntil = Date.now() + API_DOWN_COOLDOWN_MS;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/** Public API call that returns a fallback instead of throwing. */
export async function apiFetchSafe<T>(path: string, fallback: T): Promise<T> {
  const { data } = await apiFetchSafeResult(path, fallback);
  return data;
}

/**
 * Like `apiFetchSafe`, but tells the caller whether the fallback is being used
 * because the API is unavailable. Pages that would otherwise claim "no results"
 * can say so honestly instead.
 */
export async function apiFetchSafeResult<T>(
  path: string,
  fallback: T,
): Promise<{ data: T; unavailable: boolean }> {
  try {
    return { data: await apiFetch<T>(path, { anonymous: true }), unavailable: false };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[api] ${path} failed:`, error instanceof Error ? error.message : error);
    }
    return { data: fallback, unavailable: true };
  }
}

/** Authenticated API call (uses the access-token cookie) with a fallback. */
export async function apiFetchAuthed<T>(path: string, fallback: T): Promise<T> {
  try {
    return await apiFetch<T>(path);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[api] ${path} failed:`, error instanceof Error ? error.message : error);
    }
    return fallback;
  }
}
