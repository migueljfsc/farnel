import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { formatDay, formatMoney } from "../../shared/format";
import { plural, translator, type Dictionary, type Locale } from "./core";
import { I18nContext, type I18n } from "./context";
import { en } from "./en";
import { detectLocale, storedLocale, storeLocale } from "./locale";
import { pt } from "./pt";

const DICTIONARIES: Record<Locale, Dictionary> = { en, pt };

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setChosen] = useState<Locale>(() => storedLocale() ?? detectLocale());

  // The document language tells screen readers how to pronounce the page.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setChosen(next);
    storeLocale(next);
  }, []);

  const value = useMemo<I18n>(() => {
    const dict = DICTIONARIES[locale];
    return {
      locale,
      setLocale,
      t: translator(dict),
      tn: (key, count, vars) => plural(dict, key, count, vars),
      day: (date) => formatDay(date, locale),
      money: (cents) => formatMoney(cents, locale),
    };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
