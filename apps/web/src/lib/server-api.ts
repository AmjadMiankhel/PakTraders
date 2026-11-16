import { cookies } from "next/headers";
import { ACCESS_COOKIE } from "./auth-cookies";

export const API_BASE_URL = (
  process.env.API_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:4000"
).replace(/\/+$/, "");

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
  const timeout = setTimeout(() => controller.abort(), 15_000);
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
    return data as T;
  } finally {
    clearTimeout(timeout);
  }
}

/** Public API call that returns a fallback instead of throwing. */
export async function apiFetchSafe<T>(path: string, fallback: T): Promise<T> {
  try {
    return await apiFetch<T>(path, { anonymous: true });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[api] ${path} failed:`, error instanceof Error ? error.message : error);
    }
    return fallback;
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
