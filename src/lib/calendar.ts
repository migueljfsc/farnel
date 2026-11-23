import { addDays, weekStartOf } from "../../shared/time";

const firstOfMonth = (date: string): string => `${date.slice(0, 7)}-01`;

/** The first day of the month `months` away from the month `date` is in. */
export function addMonths(date: string, months: number): string {
  const [year, month] = date.split("-").map(Number);
  const index = year * 12 + (month - 1) + months;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}-01`;
}

/** The Monday of every week that has at least one day in the month of `date`. */
export function monthWeeks(date: string): string[] {
  const first = firstOfMonth(date);
  const next = addMonths(first, 1);
  const weeks: string[] = [];
  for (let week = weekStartOf(first); week < next; week = addDays(week, 7)) weeks.push(week);
  return weeks;
}
