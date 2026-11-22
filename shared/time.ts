/** Calendar dates as `YYYY-MM-DD` in Europe/Lisbon. Arithmetic runs on UTC noon to stay clear of DST. */

const LISBON = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit" });
const DAY_MS = 86_400_000;

export const todayLisbon = (now: Date): string => LISBON.format(now);

const toUtcNoon = (date: string): number => Date.parse(`${date}T12:00:00Z`);
const fromUtc = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** True for a real date such as `2026-02-28`; false for `2026-02-30` or `2026-13-01`. */
export function isCalendarDate(date: string): boolean {
  const ms = toUtcNoon(date);
  return Number.isFinite(ms) && fromUtc(ms) === date;
}

export const addDays = (date: string, days: number): string => fromUtc(toUtcNoon(date) + days * DAY_MS);

/** `b - a` in days. */
export const daysBetween = (a: string, b: string): number => Math.round((toUtcNoon(b) - toUtcNoon(a)) / DAY_MS);

const weekday = (date: string): number => new Date(toUtcNoon(date)).getUTCDay();

export const isMonday = (date: string): boolean => weekday(date) === 1;

export const weekStartOf = (date: string): string => addDays(date, -((weekday(date) + 6) % 7));

export interface Clock {
  today: string;
  now: string;
}

/** Days of history shown when no range is given. */
export const HISTORY_DAYS = 60;

/** One clock reading per request: today's date in Lisbon and the ISO timestamp. */
export function clockAt(now: Date = new Date()): Clock {
  return { today: todayLisbon(now), now: now.toISOString() };
}
