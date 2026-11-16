import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_COOKIE,
  ACCESS_MAX_AGE,
  REFRESH_COOKIE,
  REFRESH_MAX_AGE,
  authCookieOptions,
  isJwtExpired,
} from "./lib/auth-cookies";
import { API_BASE_URL } from "./lib/api-base";

const PROTECTED_PREFIXES = ["/dashboard", "/admin"];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Public origin used to build redirect targets.
 *
 * Behind Hostinger's LiteSpeed + CDN front, a redirect whose `Location` is a
 * relative path and whose body is empty is swallowed: the visitor receives
 * `200` with no body and never reaches the login page. Emitting an absolute
 * `Location` together with a tiny HTML fallback keeps the redirect intact on
 * that stack while behaving identically everywhere else.
 */
const PUBLIC_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "";

function loginRedirect(request: NextRequest, next?: string): NextResponse {
  let url: URL;
  try {
    url = new URL("/login", PUBLIC_ORIGIN || request.url);
  } catch {
    url = new URL("/login", request.url);
  }
  if (next) url.searchParams.set("next", next);

  const href = url.toString();
  const escaped = href.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

  return new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
      `<meta http-equiv="refresh" content="0;url=${escaped}"><title>Redirecting…</title></head>` +
      `<body><p>Redirecting to <a href="${escaped}">${escaped}</a>.</p></body></html>`,
    {
      status: 307,
      headers: {
        location: href,
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
}

function withCookie(cookieHeader: string, name: string, value: string): string {
  const parts = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !part.startsWith(`${name}=`));
  parts.push(`${name}=${value}`);
  return parts.join("; ");
}

/**
 * Refreshes the short-lived access token before protected pages render, and
 * redirects unauthenticated visitors to the login page. Refresh rotation is
 * persisted in httpOnly cookies; the API remains the source of truth for
 * authorisation decisions.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  const accessValid = Boolean(accessToken && !isJwtExpired(accessToken));

  if (accessValid) return NextResponse.next();

  if (!refreshToken) {
    if (isProtected(pathname)) return loginRedirect(request, pathname);
    return NextResponse.next();
  }

  let rotated: { accessToken: string; refreshToken: string } | null = null;
  try {
    const response = await fetch(`${API_BASE_URL}/v1/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });
    if (response.ok) {
      const data = (await response.json()) as {
        tokens?: { accessToken?: string; refreshToken?: string };
      };
      if (data.tokens?.accessToken && data.tokens.refreshToken) {
        rotated = {
          accessToken: data.tokens.accessToken,
          refreshToken: data.tokens.refreshToken,
        };
      }
    }
  } catch {
    rotated = null;
  }

  if (!rotated) {
    const response = isProtected(pathname) ? loginRedirect(request, pathname) : NextResponse.next();
    response.cookies.delete(ACCESS_COOKIE);
    response.cookies.delete(REFRESH_COOKIE);
    return response;
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(
    "cookie",
    withCookie(request.headers.get("cookie") ?? "", ACCESS_COOKIE, rotated.accessToken),
  );

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.cookies.set(ACCESS_COOKIE, rotated.accessToken, authCookieOptions(ACCESS_MAX_AGE));
  response.cookies.set(REFRESH_COOKIE, rotated.refreshToken, authCookieOptions(REFRESH_MAX_AGE));
  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
