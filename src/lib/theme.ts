/**
 * Light, dark, or following the system. The choice is a `data-theme` attribute on <html>, absent
 * for "system"; index.css keys the palette on it. `public/theme.js` applies the stored choice
 * before the first paint, so there is no flash.
 */

export const THEMES = ["system", "light", "dark"] as const;
export type ThemeChoice = (typeof THEMES)[number];

const KEY = "theme";

export const isThemeChoice = (value: unknown): value is ThemeChoice => typeof value === "string" && (THEMES as readonly string[]).includes(value);

export const nextTheme = (choice: ThemeChoice): ThemeChoice => THEMES[(THEMES.indexOf(choice) + 1) % THEMES.length];

export function storedTheme(): ThemeChoice {
  try {
    const raw = localStorage.getItem(KEY);
    return isThemeChoice(raw) ? raw : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(choice: ThemeChoice): void {
  if (choice === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = choice;
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    // Storage blocked: the choice lasts until the page closes.
  }
}
