/**
 * The language, as one small button: it shows the one in use and switches to the other. The
 * tooltip names the language it goes to in that language's own words.
 */

import { LOCALES, type Locale } from "../i18n/core";
import { useI18n } from "../i18n/context";

/** What each locale calls itself; never translated. */
const LABEL: Record<Locale, string> = { en: "EN", pt: "PT" };
const NAME: Record<Locale, string> = { en: "English", pt: "Português" };

export function LocaleSwitch() {
  const { locale, setLocale, t } = useI18n();
  const next = LOCALES[(LOCALES.indexOf(locale) + 1) % LOCALES.length];
  return (
    <button
      type="button"
      lang={next}
      onClick={() => setLocale(next)}
      aria-label={`${t("app.locale")}: ${NAME[locale]}. ${NAME[next]}`}
      title={NAME[next]}
      className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold text-cafe-soft ring-1 ring-linha transition hover:text-salva hover:ring-salva/50"
    >
      {LABEL[locale]}
    </button>
  );
}
