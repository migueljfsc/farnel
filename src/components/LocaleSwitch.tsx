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
      className="rounded px-2 py-0.5 font-mono text-xs font-medium text-stone-600 hover:bg-stone-100"
    >
      {LABEL[locale]}
    </button>
  );
}
