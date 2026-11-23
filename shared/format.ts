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

const decimal = (value: number, locale: Locale, places = 1): string => {
  const text = String(Math.round(value * 10 ** places) / 10 ** places);
  return locale === "pt" ? text.replace(".", ",") : text;
};

/** A quantity in the unit people would say: 1200 g → `1,2 kg`, 1500 ml → `1,5 L`. */
export function formatQuantity(quantity: number, unit: "g" | "ml" | "un", locale: Locale = "en"): string {
  if (unit === "un") return `${decimal(quantity, locale)} un`;
  if (quantity >= 1000) return `${decimal(quantity / 1000, locale, 2)} ${unit === "g" ? "kg" : "L"}`;
  return `${Math.round(quantity)} ${unit}`;
}

const MONTHS: Record<Locale, string[]> = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  pt: ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"],
};

/** The month a date falls in: `November 2026` / `novembro de 2026`. */
export function formatMonth(date: string, locale: Locale = "en"): string {
  const [year, month] = date.split("-");
  const name = MONTHS[locale][Number(month) - 1];
  return locale === "pt" ? `${name} de ${year}` : `${name} ${year}`;
}

/** The short weekday names, Monday first. */
export const weekdayNames = (locale: Locale): string[] => [...WEEKDAYS[locale].slice(1), WEEKDAYS[locale][0]];

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
