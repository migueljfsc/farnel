import { McpServer } from "@modelcontextprotocol/server";
import { APP_NAME } from "../../shared/app";
import { clockAt } from "../lib/time";
import { TOOLS } from "./tools";

export const INSTRUCTIONS = `Farnel plans a two-person household's lunches (and occasional dinners) by cooking: one cooking yields several portions; each meal eats 2 portions. Prefer fewer cookings with more portions.
Start with get_context, then list_candidates for the week. Only dishes returned by list_candidates can be saved; save_plan re-checks every rule and rejects the whole plan with reasons. Fix and retry.
Stay within the weekly budget. Use ratings and comments: avoid low-rated dishes, apply comments as adjustments, vary tags across the week.
To suggest something new, call add_dish; it waits for a person to validate it in the web app and cannot be planned until then.
Dates are YYYY-MM-DD (Europe/Lisbon), weeks start on Monday, money is integer cents. Reply in the language the person writes in.`;

export function createServer(env: Env): McpServer {
  const server = new McpServer({ name: APP_NAME, version: "1.0.0" }, { instructions: INSTRUCTIONS });
  for (const t of TOOLS) {
    server.registerTool(t.name, { description: t.description, inputSchema: t.input }, async (args: unknown) => {
      const result = await t.run(env.DB, args as never, clockAt());
      return { content: [{ type: "text", text: `${result.summary}\n${JSON.stringify(result.data)}` }], isError: result.isError };
    });
  }
  return server;
}
