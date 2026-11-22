/** Hand-off to Claude: the prompt that plans a week, and the links that open it in Claude. */

import { APP_NAME } from "../../shared/app";
import { formatDay } from "../../shared/format";

const names = (list: string[]): string => (list.length > 1 ? `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}` : list[0]);

/** `eaters` null means everyone in the household. */
export function planPrompt({ weekStart, notes, eaters }: { weekStart: string; notes: string; eaters: string[] | null }): string {
  const who = eaters ? `only for ${names(eaters)}` : "for everyone";
  return [
    `Use the ${APP_NAME} tools to plan lunches for the week starting ${formatDay(weekStart)} (${weekStart}), ${who}.`,
    notes.trim() && `Notes for this week: ${notes.trim()}`,
    "Start with get_context and list_candidates, then save the plan with save_plan. If a good dish is missing from the catalogue, propose it with add_dish.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** `app` is the documented deep link for the Claude desktop and mobile apps; `web` is best effort. */
export function claudeLinks(prompt: string): { app: string; web: string } {
  const q = encodeURIComponent(prompt);
  return { app: `claude://claude.ai/new?q=${q}`, web: `https://claude.ai/new?q=${q}` };
}
