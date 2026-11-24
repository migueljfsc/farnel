import { McpServer } from "@modelcontextprotocol/server";
import { APP_NAME } from "../../shared/app";
import { BASE_TAGS, PROTEIN_TAGS } from "../../shared/tags";
import { clockAt } from "../../shared/time";
import { runTool, TOOLS } from "./tools";

export const INSTRUCTIONS = `Farnel plans a household's lunches (and occasional dinners) by cooking: one cooking yields several portions; each meal eats one portion per person eating. Prefer fewer cookings with more portions.
Start with get_context. A plan is for the people the person asks for (everyone unless they say otherwise): pass their ids as peopleIds to list_candidates and save_plan, so only their restrictions apply.
Then list_candidates for the week. Only dishes returned by list_candidates can be saved; save_plan re-checks every rule and rejects the whole plan with reasons. Fix and retry.
Stay within the weekly budget. Use ratings and comments: avoid low-rated dishes, apply comments as adjustments. Every dish has a protein tag (${PROTEIN_TAGS.join(", ")}) and a base tag (${BASE_TAGS.join(", ")}): vary both across the week.
The household strongly prefers low-carb dishes: favour them when planning and suggesting, and keep rice, pasta, potato and bread to small amounts. Every portion needs at least the household's minimum raw protein (settings.minProteinGrams in get_context: the uncooked weight of its meat, fish, seafood, eggs or other protein). list_candidates only returns dishes that meet it and save_plan rejects the rest as low_protein; size new recipes to meet it, and give each new protein ingredient its proteinGrams.
Never suggest a dish with an ingredient someone eating never eats (people[].never in get_context); list_candidates leaves those out and save_plan rejects them as never_eaten.
To suggest something new, call add_dish; it waits for a person to validate it in the web app and cannot be planned until then.
Dates are YYYY-MM-DD (Europe/Lisbon), weeks start on Monday, money is integer cents. Reply in the language the person writes in.`;

/** `origin` is where the app is served, so the icon points at its public copy. */
export function createServer(env: Env, origin: string): McpServer {
  const server = new McpServer(
    { name: APP_NAME, version: "1.0.0", icons: [{ src: `${origin}/icons/icon-192.png`, mimeType: "image/png", sizes: ["192x192"] }] },
    { instructions: INSTRUCTIONS },
  );
  for (const t of TOOLS) {
    server.registerTool(t.name, { description: t.description, inputSchema: t.input }, async (args: unknown) => {
      const result = await runTool(t.name, env.DB, args, clockAt());
      return { content: [{ type: "text", text: `${result.summary}\n${JSON.stringify(result.data)}` }], isError: result.isError };
    });
  }
  return server;
}
