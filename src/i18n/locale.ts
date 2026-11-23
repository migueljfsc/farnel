/** Where the chosen language lives: this browser's storage, never throwing, validated on read. */

import { isLocale, type Locale } from "./core";

const KEY = "locale";

export function storedLocale(): Locale | null {
  try {
    const raw = localStorage.getItem(KEY);
    return isLocale(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function storeLocale(locale: Locale): void {
  try {
    localStorage.setItem(KEY, locale);
  } catch {
    // Storage blocked: the choice lasts until the page closes.
  }
}

/** The browser's preference, matched on the base tag: pt-PT, pt-BR and pt all get Portuguese. */
export function detectLocale(tags?: readonly string[]): Locale {
  const languages = tags ?? (typeof navigator === "undefined" ? [] : (navigator.languages ?? [navigator.language]));
  for (const tag of languages) {
    const base = tag.toLowerCase().split("-")[0];
    if (isLocale(base)) return base;
  }
  return "en";
}
