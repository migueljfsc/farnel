/** Light, automatic (the system's) or dark, as three side-by-side choices. */

import { useState } from "react";
import { useI18n } from "../i18n/context";
import { applyTheme, storedTheme, type ThemeChoice } from "../lib/theme";
import { Segmented } from "./Segmented";

export function ThemeSwitch({ onMar = false }: { onMar?: boolean }) {
  const { t } = useI18n();
  const [theme, setTheme] = useState<ThemeChoice>(storedTheme);
  return (
    <Segmented
      label={t("theme.label")}
      onMar={onMar}
      value={theme}
      options={[
        { value: "light", label: t("theme.light") },
        { value: "system", label: t("theme.auto") },
        { value: "dark", label: t("theme.dark") },
      ]}
      onChange={(choice) => {
        applyTheme(choice);
        setTheme(choice);
      }}
    />
  );
}
