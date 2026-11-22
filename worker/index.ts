/**
 * Farnel Worker: the JSON API for the web UI (`/api/*`) and the MCP server (`/mcp`). The SPA is
 * served by the static-asset layer ahead of this script (`run_worker_first` in wrangler.jsonc).
 *
 * `Env` is generated from wrangler.jsonc by `pnpm types`, extended in env.d.ts.
 */

import { secured } from "./lib/http";
import { route } from "./router";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return secured(await route(request, env));
  },
} satisfies ExportedHandler<Env>;
