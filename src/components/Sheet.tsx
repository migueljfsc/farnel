import { useEffect, type ReactNode } from "react";
import { useI18n } from "../i18n/context";

/** A bottom sheet over a dimmed page on phones; a panel in the flow from `sm` up. Escape closes it. */
export function Sheet({ labelledBy, onClose, children }: { labelledBy: string; onClose: () => void; children: ReactNode }) {
  const { t } = useI18n();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <>
      <button type="button" aria-label={t("common.close")} onClick={onClose} className="fixed inset-0 z-30 bg-cafe/40 sm:hidden" />
      <div
        role="dialog"
        aria-labelledby={labelledBy}
        className="animate-sheet fixed inset-x-0 bottom-0 z-40 max-h-[80dvh] space-y-3 overflow-y-auto rounded-t-3xl border-t border-linha bg-louca p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-tin sm:animate-expand sm:static sm:z-auto sm:rounded-2xl sm:border sm:p-4 sm:shadow-none"
      >
        <span className="mx-auto block h-1 w-10 rounded-full bg-linha sm:hidden" aria-hidden />
        {children}
      </div>
    </>
  );
}

export function CloseButton({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  return (
    <button type="button" onClick={onClose} aria-label={t("common.close")} className="grid size-7 place-items-center rounded-full hover:bg-aveia">
      ✕
    </button>
  );
}
