/** Formatting shared by the web UI and the MCP tool summaries; English unless a locale is given. */

import type { Locale } from "./locale";

export function formatMoney(cents: number, locale: Locale = "en"): string {
  const amount = (cents / 100).toFixed(2);
  return locale === "pt" ? `${amount.replace(".", ",")} €` : `€${amount}`;
}

const WEEKDAYS: Record<Locale, string[]> = {
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  pt: ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"],
};

/** `2026-11-17` → `Tue 17/11` / `ter 17/11`. */
export function formatDay(date: string, locale: Locale = "en"): string {
  const [, month, day] = date.split("-");
  return `${WEEKDAYS[locale][new Date(`${date}T12:00:00Z`).getUTCDay()]} ${day}/${month}`;
}
/** Euros as typed (`12.34`, `12,5`) to cents; null when empty, negative or not a number. */
export function parseMoney(text: string): number | null {
  const value = Number(text.trim().replace(",", "."));
  return text.trim() === "" || !Number.isFinite(value) || value < 0 ? null : Math.round(value * 100);
}

const PRICE_UNITS = { g: "€/kg", ml: "€/L", un: "€/un" } as const;

/** What an ingredient's price refers to: 1000 g, 1000 ml or 1 un. */
export const priceUnit = (unit: keyof typeof PRICE_UNITS): string => PRICE_UNITS[unit];
