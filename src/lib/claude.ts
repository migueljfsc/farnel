/** Hand-off to Claude: the prompt that plans a week, in the reader's language, and the links that open it. */

import { APP_NAME } from "../../shared/app";
import { formatDay } from "../../shared/format";
import type { Locale, Translate } from "../i18n/core";

/** `eaters` null means everyone in the household. */
export function planPrompt(
  { weekStart, notes, eaters }: { weekStart: string; notes: string; eaters: string[] | null },
  { t, locale }: { t: Translate; locale: Locale },
): string {
  const names = (list: string[]) => (list.length > 1 ? t("prompt.and", { first: list.slice(0, -1).join(", "), last: list[list.length - 1] }) : list[0]);
  const who = eaters ? t("prompt.only", { names: names(eaters) }) : t("prompt.everyone");
  return [
    t("prompt.plan", { app: APP_NAME, day: formatDay(weekStart, locale), date: weekStart, who }),
    notes.trim() && t("prompt.notes", { notes: notes.trim() }),
    t("prompt.steps"),
  ]
    .filter(Boolean)
    .join("\n");
}

/** `app` is the documented deep link for the Claude desktop and mobile apps; `web` is best effort. */
export function claudeLinks(prompt: string): { app: string; web: string } {
  const q = encodeURIComponent(prompt);
  return { app: `claude://claude.ai/new?q=${q}`, web: `https://claude.ai/new?q=${q}` };
}
