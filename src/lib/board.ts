/** Where cookings sit on the week board: a row per meal slot, a column per day. */

import { addDays, daysBetween } from "../../shared/time";
import type { CookingView, Meal, Slot } from "../../shared/types";

const DAYS = 7;
export const SLOTS: Slot[] = ["lunch", "dinner"];

/** The meals of the week after `meal`, in order, that no cooking feeds yet: where its leftovers can go. */
export function freeMealsAfter(cookings: CookingView[], weekStart: string, meal: Meal): Meal[] {
  const taken = new Set(cookings.flatMap((c) => c.meals.map((m) => `${m.date}:${m.slot}`)));
  const week = Array.from({ length: DAYS }, (_, i) => addDays(weekStart, i)).flatMap((date) => SLOTS.map((slot) => ({ date, slot })));
  const from = week.findIndex((m) => m.date === meal.date && m.slot === meal.slot);
  return week.slice(from + 1).filter((m) => !taken.has(`${m.date}:${m.slot}`));
}

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
