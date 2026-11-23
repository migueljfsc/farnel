/** Light, dark or system, as one small button that cycles; the icon shows the current choice. */

import { useState } from "react";
import type { MessageKey } from "../i18n/core";
import { useI18n } from "../i18n/context";
import { applyTheme, nextTheme, storedTheme, type ThemeChoice } from "../lib/theme";

const LABEL: Record<ThemeChoice, MessageKey> = { system: "theme.system", light: "theme.light", dark: "theme.dark" };

const ICON: Record<ThemeChoice, React.ReactNode> = {
  system: <path d="M12 3a9 9 0 1 0 0 18Z M12 3a9 9 0 0 1 0 18" />,
  light: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  dark: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />,
};

export function ThemeSwitch() {
  const { t } = useI18n();
  const [theme, setTheme] = useState<ThemeChoice>(storedTheme);
  const next = nextTheme(theme);
  return (
    <button
      type="button"
      onClick={() => {
        applyTheme(next);
        setTheme(next);
      }}
      aria-label={`${t("theme.label")}: ${t(LABEL[theme])}. ${t(LABEL[next])}`}
      title={t(LABEL[next])}
      className="grid size-8 shrink-0 place-items-center rounded-full text-cafe-soft ring-1 ring-linha transition hover:text-salva hover:ring-salva/50"
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {ICON[theme]}
      </svg>
    </button>
  );
}
