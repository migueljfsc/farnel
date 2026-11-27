/**
 * Farnel Worker: the JSON API for the web UI (`/api/*`), the MCP server (`/mcp`) and the daily
 * store price refresh (Cron Trigger). The SPA is served by the static-asset layer ahead of this
 * script (`run_worker_first` in wrangler.jsonc).
 *
 * `Env` is generated from wrangler.jsonc by `pnpm types`, extended in env.d.ts.
 */

import { secured } from "./lib/http";
import { refreshStorePrices } from "./lib/service/stores";
import { route } from "./router";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return secured(await route(request, env, ctx));
  },

  /** The daily Cron Trigger: refreshes the store prices that are due. */
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(refreshStorePrices(env.DB, fetch, new Date().toISOString()).then((counts) => console.log("store prices", counts)));
  },
} satisfies ExportedHandler<Env>;
