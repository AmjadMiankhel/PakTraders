import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_COOKIE } from "@/lib/auth-cookies";
import { clearAuthCookies } from "@/lib/auth-response";
import { API_BASE_URL } from "@/lib/api-base";

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    try {
      await fetch(`${API_BASE_URL}/v1/auth/logout`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken }),
        cache: "no-store",
      });
    } catch {
      // Clearing local cookies still signs the user out of this browser.
    }
  }
  const response = NextResponse.json({ success: true });
  clearAuthCookies(response);
  return response;
}
