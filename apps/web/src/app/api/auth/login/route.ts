import type { NextRequest } from "next/server";
import { forwardAuthRequest } from "@/lib/auth-response";

export async function POST(request: NextRequest) {
  const { response } = await forwardAuthRequest(request, "/v1/auth/login", {
    requireTokens: true,
  });
  return response;
}
