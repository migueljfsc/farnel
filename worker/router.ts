import { createMcpHandler } from "agents/mcp/server";
import { catalogueRoutes } from "./api/catalogue";
import { peopleRoutes } from "./api/people";
import { planningRoutes } from "./api/planning";
import { dispatch } from "./api/routing";
import { authenticate } from "./lib/access";
import { fail } from "./lib/http";
import { clockAt } from "./lib/time";
import { createServer } from "./mcp/server";

const API_ROUTES = [...peopleRoutes, ...catalogueRoutes, ...planningRoutes];
const MCP_PATH = "/mcp";

export async function route(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const surface = url.pathname === MCP_PATH ? "mcp" : url.pathname.startsWith("/api/") ? "web" : null;
  if (!surface) return env.ASSETS.fetch(request);

  const caller = await authenticate(request, env, surface);
  if (!caller) return fail("unauthorized", 401);
  if (caller.kind === "mcp") return createMcpHandler(() => createServer(env), { route: MCP_PATH, corsOptions: false })(request, env, ctx);
  return dispatch(API_ROUTES, { env, db: env.DB, request, url, caller, ...clockAt() });
}
