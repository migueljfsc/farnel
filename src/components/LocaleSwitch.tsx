/** The language, as side-by-side choices each named in its own language. */

import { LOCALES, type Locale } from "../i18n/core";
import { useI18n } from "../i18n/context";
import { Segmented } from "./Segmented";

/** What each locale calls itself; never translated. */
const LABEL: Record<Locale, string> = { en: "EN", pt: "PT" };

export function LocaleSwitch({ onMar = false }: { onMar?: boolean }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <Segmented
      label={t("app.locale")}
      onMar={onMar}
      value={locale}
      options={LOCALES.map((l) => ({ value: l, label: LABEL[l], lang: l }))}
      onChange={setLocale}
    />
  );
}
