/** Calendar dates as `YYYY-MM-DD` in Europe/Lisbon. Arithmetic runs on UTC noon to stay clear of DST. */

const LISBON = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit" });
const DAY_MS = 86_400_000;

export const todayLisbon = (now: Date): string => LISBON.format(now);

const toUtcNoon = (date: string): number => Date.parse(`${date}T12:00:00Z`);
const fromUtc = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

export const addDays = (date: string, days: number): string => fromUtc(toUtcNoon(date) + days * DAY_MS);

/** `b - a` in days. */
export const daysBetween = (a: string, b: string): number => Math.round((toUtcNoon(b) - toUtcNoon(a)) / DAY_MS);

const weekday = (date: string): number => new Date(toUtcNoon(date)).getUTCDay();

export const isMonday = (date: string): boolean => weekday(date) === 1;

export const weekStartOf = (date: string): string => addDays(date, -((weekday(date) + 6) % 7));
