import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_COOKIE,
  ACCESS_MAX_AGE,
  REFRESH_COOKIE,
  REFRESH_MAX_AGE,
  authCookieOptions,
} from "./auth-cookies";
import { API_BASE_URL } from "./api-base";

export function setAuthCookies(
  response: NextResponse,
  tokens: { accessToken: string; refreshToken: string },
): void {
  response.cookies.set(ACCESS_COOKIE, tokens.accessToken, authCookieOptions(ACCESS_MAX_AGE));
  response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, authCookieOptions(REFRESH_MAX_AGE));
}

export function clearAuthCookies(response: NextResponse): void {
  response.cookies.delete(ACCESS_COOKIE);
  response.cookies.delete(REFRESH_COOKIE);
}

export async function forwardAuthRequest(
  request: NextRequest,
  path: string,
  options: { requireTokens?: boolean } = {},
): Promise<{ response: NextResponse; tokens?: { accessToken: string; refreshToken: string } }> {
  let body: unknown = undefined;
  try {
    body = await request.json();
  } catch {
    body = undefined;
  }

  try {
    const upstream = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    const text = await upstream.text();
    const data = text ? JSON.parse(text) : null;

    if (!upstream.ok) {
      return {
        response: NextResponse.json(
          data ?? { message: `Request failed with status ${upstream.status}` },
          { status: upstream.status },
        ),
      };
    }

    const tokens = data?.tokens as { accessToken?: string; refreshToken?: string } | undefined;
    const response = NextResponse.json(data);
    if (tokens?.accessToken && tokens.refreshToken) {
      setAuthCookies(response, {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
      return {
        response,
        tokens: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken },
      };
    }
    if (options.requireTokens) {
      return {
        response: NextResponse.json(
          { message: "Authentication service returned no tokens" },
          { status: 502 },
        ),
      };
    }
    return { response };
  } catch {
    return {
      response: NextResponse.json(
        { message: "Authentication service is temporarily unavailable. Try again shortly." },
        { status: 503 },
      ),
    };
  }
}
