/**
 * JSON responses for the API surface. Every response is `no-store`: Cloudflare's cache sits in
 * front of the Worker and these are per-household answers.
 */

import { SECURITY_HEADERS } from "./headers";

const NO_STORE = { "cache-control": "no-store" } as const;

export function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return Response.json(body, { status, headers: { ...NO_STORE, ...headers } });
}

/** A machine-readable code, never a sentence. */
export function fail(code: string, status: number, extra: Record<string, unknown> = {}): Response {
  return json({ error: code, ...extra }, status);
}

export const noContent = (): Response => new Response(null, { status: 204, headers: NO_STORE });

/** A response with the security headers set, whatever produced it. */
export function secured(response: Response): Response {
  const out = new Response(response.body, response);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) out.headers.set(name, value);
  return out;
}

/**
 * A request's JSON body, or undefined when it is not JSON. JSON by content type, not only by
 * parse: a cross-site form can POST a JSON-shaped `text/plain` body without a preflight.
 */
export async function readJson(request: Request, maxBytes = 64 * 1024): Promise<unknown> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) return undefined;
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > maxBytes) return undefined;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).length > maxBytes) return undefined;
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
