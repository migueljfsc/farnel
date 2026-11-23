import { useEffect, useRef, useState } from "react";

export type SaveState = "idle" | "saving" | "saved" | "error";

const QUIET_MS = 700;

/**
 * Saves `value` once it has stopped changing for a moment (each change cancels the pending save),
 * never on the first render, and reports how the last save went. `valid` holds back values that
 * would be refused.
 */
export function useAutosave<T>(value: T, save: (value: T) => Promise<unknown>, valid = true): SaveState {
  const [state, setState] = useState<SaveState>("idle");
  const latest = useRef(save);
  useEffect(() => {
    latest.current = save;
  });
  const key = JSON.stringify(value);
  const first = useRef(key);
  useEffect(() => {
    if (key === first.current || !valid) return;
    const timer = setTimeout(async () => {
      setState("saving");
      try {
        await latest.current(JSON.parse(key) as T);
        setState("saved");
      } catch {
        setState("error");
      }
    }, QUIET_MS);
    return () => clearTimeout(timer);
  }, [key, valid]);
  return state;
}
