/** Where cookings sit on the week board: a row per meal slot, a column per day. */

import { daysBetween } from "../../shared/time";
import type { CookingView, Slot } from "../../shared/types";

const DAYS = 7;
const SLOTS: Slot[] = ["lunch", "dinner"];

/** Lunch always; dinner only when some meal is a dinner. */
export const slotsInUse = (cookings: CookingView[]): Slot[] =>
  SLOTS.filter((slot) => slot === "lunch" || cookings.some((c) => c.meals.some((m) => m.slot === slot)));

export interface Segment {
  /** Index of the cooking in the plan. */
  cooking: number;
  /** Day columns, 1-based, end exclusive. */
  start: number;
  end: number;
  /** The first segment of the cooking in this slot carries its name. */
  first: boolean;
}

/** Runs of consecutive days each cooking feeds in `slot`, inside the week. */
export function segments(cookings: CookingView[], weekStart: string, slot: Slot): Segment[] {
  return cookings.flatMap((cooking, index) => {
    const columns = cooking.meals
      .filter((m) => m.slot === slot)
      .map((m) => daysBetween(weekStart, m.date) + 1)
      .filter((c) => c >= 1 && c <= DAYS)
      .sort((a, b) => a - b);
    const runs: Segment[] = [];
    for (const column of columns) {
      const last = runs[runs.length - 1];
      if (last && last.end === column) last.end = column + 1;
      else runs.push({ cooking: index, start: column, end: column + 1, first: runs.length === 0 });
    }
    return runs;
  });
}
