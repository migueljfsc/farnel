import { useState } from "react";

export const toggledKey = (keys: string[], key: string): string[] => (keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]);

/**
 * Which groups of a list are folded, remembered in this browser under `storageKey`; a convenience
 * per viewer, so it starts all open when storage is unavailable.
 */
export function useCollapsed(storageKey: string): [Set<string>, (key: string) => void] {
  const [keys, setKeys] = useState<string[]>(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
      return Array.isArray(stored) ? stored.filter((k): k is string => typeof k === "string") : [];
    } catch {
      return [];
    }
  });
  const toggle = (key: string) => {
    const next = toggledKey(keys, key);
    setKeys(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Storage blocked: the folds last until the page closes.
    }
  };
  return [new Set(keys), toggle];
}
