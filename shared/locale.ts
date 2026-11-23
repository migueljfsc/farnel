/** The languages the app speaks. */
export const LOCALES = ["en", "pt"] as const;

export type Locale = (typeof LOCALES)[number];

export const isLocale = (value: unknown): value is Locale => typeof value === "string" && (LOCALES as readonly string[]).includes(value);
