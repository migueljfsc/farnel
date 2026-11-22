import { catalogueRoutes } from "./api/catalogue";
import { peopleRoutes } from "./api/people";
import { planningRoutes } from "./api/planning";
import { dispatch } from "./api/routing";
import { authenticate } from "./lib/access";
import { fail } from "./lib/http";
import { clockAt } from "./lib/time";

const API_ROUTES = [...peopleRoutes, ...catalogueRoutes, ...planningRoutes];

export async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/mcp") return fail("unauthorized", 401);
  if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);

  const caller = await authenticate(request, env, "web");
  if (caller?.kind !== "person") return fail("unauthorized", 401);
  return dispatch(API_ROUTES, { env, db: env.DB, request, url, caller, ...clockAt() });
}
