/**
 * Resolves the API origin used by server components, route handlers and the
 * auth proxy. Managed hosts inject empty variables as often as missing ones, so
 * blank values, stray whitespace and malformed URLs fall back to localhost
 * instead of producing requests to `undefined/v1/...`.
 */
export function resolveApiBaseUrl(source: NodeJS.ProcessEnv = process.env): string {
  const raw = (source.API_INTERNAL_URL || source.NEXT_PUBLIC_API_URL || "").trim();
  const candidate = raw || "http://localhost:4000";
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "http://localhost:4000";
    }
    return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
  } catch {
    return "http://localhost:4000";
  }
}

export const API_BASE_URL = resolveApiBaseUrl();
