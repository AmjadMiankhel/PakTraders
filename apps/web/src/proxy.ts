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
    if (isProtected(pathname)) {
      const url = new URL("/login", request.url);
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
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
    const destination = isProtected(pathname)
      ? (() => {
          const url = new URL("/login", request.url);
          url.searchParams.set("next", pathname);
          return url;
        })()
      : null;
    const response = destination ? NextResponse.redirect(destination) : NextResponse.next();
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
