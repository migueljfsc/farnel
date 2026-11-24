import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ToastContext, type Toast } from "../lib/toast";
import { cx } from "./styles";

const VISIBLE_MS = 4000;
/** Long enough to reach for Undo. */
const WITH_ACTION_MS = 8000;

/**
 * One toast at a time, announced politely to screen readers; a new one replaces the last.
 * Hovering or focusing it pauses the countdown.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(Toast & { id: number }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hideLater = useCallback((ms: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), ms);
  }, []);
  const show = useCallback(
    (next: Toast) => {
      setToast({ ...next, id: Date.now() });
      hideLater(next.action ? WITH_ACTION_MS : VISIBLE_MS);
    },
    [hideLater],
  );
  const pause = () => clearTimeout(timer.current);
  const resume = () => toast && hideLater(toast.action ? WITH_ACTION_MS : VISIBLE_MS);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-30 flex justify-center px-4 sm:bottom-6">
        {toast && (
          <div
            key={toast.id}
            role={toast.tone === "error" ? "alert" : "status"}
            onMouseEnter={pause}
            onMouseLeave={resume}
            onFocus={pause}
            onBlur={resume}
            className={cx(
              "animate-toast pointer-events-auto flex max-w-md items-center gap-3 rounded-full py-2 pl-4 pr-2 text-sm font-medium shadow-tin",
              toast.tone === "error" ? "bg-tomate text-on-mar" : "bg-tinta text-papel",
            )}
          >
            <span>{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                onClick={async () => {
                  setToast(null);
                  await toast.action!.run();
                }}
                className="rounded-full bg-tomate px-3 py-1 text-xs font-bold text-tinta transition hover:brightness-105"
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
