import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_COOKIE } from "@/lib/auth-cookies";
import { clearAuthCookies, setAuthCookies } from "@/lib/auth-response";
import { API_BASE_URL } from "@/lib/api-base";

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    const response = NextResponse.json({ message: "Not signed in" }, { status: 401 });
    clearAuthCookies(response);
    return response;
  }

  try {
    const upstream = await fetch(`${API_BASE_URL}/v1/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });
    const data = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      const response = NextResponse.json(
        data ?? { message: "Session expired" },
        { status: upstream.status },
      );
      clearAuthCookies(response);
      return response;
    }
    const response = NextResponse.json({ user: data?.user ?? null });
    if (data?.tokens?.accessToken && data?.tokens?.refreshToken) {
      setAuthCookies(response, data.tokens);
    }
    return response;
  } catch {
    const response = NextResponse.json(
      { message: "Authentication service is temporarily unavailable" },
      { status: 503 },
    );
    clearAuthCookies(response);
    return response;
  }
}
