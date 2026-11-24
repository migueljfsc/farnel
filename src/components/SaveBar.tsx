import type { ReactNode } from "react";
import { useI18n } from "../i18n/context";
import { cx } from "./styles";

const BUTTON = "inline-flex items-center rounded-[3px] px-3.5 py-1.5 text-sm font-semibold transition active:translate-y-px disabled:pointer-events-none disabled:opacity-40";

/** Floats at the bottom of the page while there are unsaved changes: what is pending, Discard and Save. */
export function SaveBar({
  message,
  warning = false,
  busy,
  canSave,
  saveLabel,
  onDiscard,
  onSave,
}: {
  message: ReactNode;
  /** The message says why saving is held back. */
  warning?: boolean;
  busy: boolean;
  canSave: boolean;
  saveLabel?: string;
  onDiscard?: () => void;
  onSave: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="animate-toast sticky bottom-20 z-20 flex flex-wrap items-center gap-2 rounded-[3px] bg-tinta px-4 py-3 text-papel sm:bottom-4">
      <span role="status" className={cx("mr-auto text-sm font-semibold", warning && "text-mostarda")}>
        {message}
      </span>
      {onDiscard && (
        <button type="button" className={cx(BUTTON, "text-papel shadow-[inset_0_0_0_1.5px_color-mix(in_srgb,var(--papel)_45%,transparent)] hover:bg-papel/10")} disabled={busy} onClick={onDiscard}>
          {t("common.discard")}
        </button>
      )}
      <button type="button" className={cx(BUTTON, "bg-mostarda text-[#17201e] hover:brightness-105")} disabled={busy || !canSave} onClick={onSave}>
        {saveLabel ?? t("common.save")}
      </button>
    </div>
  );
}
