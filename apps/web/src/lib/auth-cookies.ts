/**
 * Auth cookie names and helpers shared by the proxy, route handlers and server
 * components. Tokens are stored in httpOnly cookies so browser JavaScript can
 * never read them.
 */
export const ACCESS_COOKIE = "pt_access";
export const REFRESH_COOKIE = "pt_refresh";

export const ACCESS_MAX_AGE = 60 * 15; // 15 minutes
export const REFRESH_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function authCookieOptions(maxAge: number) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  // Keep Secure on in production unless the configured site URL is a local
  // http address (local production smoke tests). Missing config stays secure.
  const isLocalHttp = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(siteUrl);
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && !isLocalHttp,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

/** Decode a JWT payload without verifying it (verification happens in the API). */
function decodePayload(token: string): { exp?: number } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const segment = parts[1];
  if (!segment) return null;
  try {
    const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const json =
      typeof atob === "function"
        ? atob(padded)
        : Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(json) as { exp?: number };
  } catch {
    return null;
  }
}

/** Treat tokens as expired slightly early so a refresh happens before render. */
export function isJwtExpired(token: string, skewSeconds = 30): boolean {
  const payload = decodePayload(token);
  if (!payload?.exp) return true;
  return payload.exp * 1000 <= Date.now() + skewSeconds * 1000;
}
