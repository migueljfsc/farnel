import type { ReactNode } from "react";
import { useI18n } from "../i18n/context";
import { cx } from "./styles";
import { Button } from "./ui";

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
    <div className="animate-toast sticky bottom-20 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-linha bg-raised/95 px-4 py-3 shadow-tin backdrop-blur sm:bottom-4">
      <span role="status" className={cx("mr-auto text-sm font-semibold", warning ? "text-tomate" : "text-tinta")}>
        {message}
      </span>
      {onDiscard && (
        <Button variant="secondary" disabled={busy} onClick={onDiscard}>
          {t("common.discard")}
        </Button>
      )}
      <Button disabled={busy || !canSave} onClick={onSave}>
        {saveLabel ?? t("common.save")}
      </Button>
    </div>
  );
}
