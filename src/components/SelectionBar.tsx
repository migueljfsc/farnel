import { useState, type ReactNode } from "react";
import { useI18n } from "../i18n/context";
import type { PluralKey } from "../i18n/core";
import type { Selection } from "../lib/selection";
import { cx } from "./styles";
import { Button } from "./ui";

/** A round tick for selecting a row; the native checkbox stays for keyboards and screen readers. */
export function Check({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className="relative grid size-6 shrink-0 cursor-pointer place-items-center">
      <input type="checkbox" checked={checked} onChange={onChange} aria-label={label} className="peer sr-only" />
      <span
        aria-hidden
        className={cx(
          "grid size-5 place-items-center rounded-[3px] border-2 text-[11px] font-bold transition peer-focus-visible:ring-2 peer-focus-visible:ring-mar",
          checked ? "border-mar bg-mar text-on-mar" : "border-linha bg-raised hover:border-mar/60",
        )}
      >
        {checked && "✓"}
      </span>
    </label>
  );
}

/**
 * Sticks above a list while rows are selected: the count, select all, the bulk actions, and a
 * delete that asks once, in place, before acting.
 */
export function SelectionBar({
  selection,
  visible,
  actions,
  onDelete,
  confirmKey,
}: {
  selection: Selection;
  visible: number[];
  actions?: ReactNode;
  onDelete: () => Promise<void>;
  confirmKey: PluralKey;
}) {
  const { t, tn } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const count = selection.selected.size;
  const all = visible.length > 0 && visible.every((id) => selection.selected.has(id));
  return (
    <div className="sticky top-16 z-10 flex min-h-12 flex-wrap items-center gap-2 rounded-[3px] border-2 border-tinta bg-raised px-3 py-2 shadow-tin">
      <Check checked={all} onChange={() => selection.toggleAll(visible)} label={t("selection.all")} />
      {count === 0 ? (
        <span className="text-sm text-tinta-soft">{t("selection.all")}</span>
      ) : confirming ? (
        <span className="animate-expand flex flex-1 flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-tomate">{tn(confirmKey, count)}</span>
          <Button
            variant="danger"
            onClick={async () => {
              await onDelete();
              setConfirming(false);
            }}
          >
            {t("selection.delete")}
          </Button>
          <Button variant="secondary" onClick={() => setConfirming(false)}>
            {t("selection.cancel")}
          </Button>
        </span>
      ) : (
        <span className="flex flex-1 flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{t("selection.count", { count })}</span>
          {actions}
          <Button variant="danger" onClick={() => setConfirming(true)}>
            {t("selection.delete")}
          </Button>
          <button type="button" onClick={selection.clear} className="ml-auto text-sm font-semibold text-tinta-soft hover:text-tinta">
            {t("selection.clear")}
          </button>
        </span>
      )}
    </div>
  );
}
