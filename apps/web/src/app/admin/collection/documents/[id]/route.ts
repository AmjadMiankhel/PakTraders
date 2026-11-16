import { API_BASE_URL, getAccessToken } from "@/lib/server-api";

/**
 * Authenticated proxy for stored collection documents. The browser cannot send
 * the API bearer token, so this route reads the access-token cookie and streams
 * the file from the API.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return new Response("Invalid document id", { status: 400 });
  }

  const token = await getAccessToken();
  if (!token) {
    return new Response("Sign in to download this document.", { status: 401 });
  }

  const upstream = await fetch(
    `${API_BASE_URL}/v1/admin/collection/documents/${encodeURIComponent(id)}/file`,
    {
      headers: { authorization: `Bearer ${token}`, accept: "*/*" },
      cache: "no-store",
    },
  );

  if (!upstream.ok || !upstream.body) {
    return new Response("The document could not be downloaded.", { status: upstream.status || 502 });
  }

  const headers = new Headers();
  for (const header of ["content-type", "content-length", "content-disposition"]) {
    const value = upstream.headers.get(header);
    if (value) headers.set(header, value);
  }
  headers.set("cache-control", "private, no-store");

  return new Response(upstream.body, { status: 200, headers });
}
