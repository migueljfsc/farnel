/** The translation context and its hook, apart from the provider so fast refresh keeps working. */

import { createContext, useContext } from "react";
import type { Locale, PluralKey, Translate, Vars } from "./core";

export interface I18n {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** Translate a key, filling any `{placeholders}`. */
  t: Translate;
  /** The `.one` or `.other` form, by count. */
  tn: (key: PluralKey, count: number, vars?: Vars) => string;
  /** A date as the reader's language writes it. */
  day: (date: string) => string;
  /** Cents as the reader's language writes money. */
  money: (cents: number) => string;
  /** A quantity in the unit people would say, e.g. `1,2 kg`. */
  quantity: (quantity: number, unit: "g" | "ml" | "un") => string;
  /** The month a date falls in. */
  month: (date: string) => string;
}

export const I18nContext = createContext<I18n | null>(null);

export function useI18n(): I18n {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n outside an I18nProvider");
  return value;
}
