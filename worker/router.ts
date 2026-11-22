import { fail } from "./lib/http";

export async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/") && url.pathname !== "/mcp") return env.ASSETS.fetch(request);
  return fail("not_found", 404);
}
