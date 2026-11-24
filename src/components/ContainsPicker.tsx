import { useState } from "react";
import type { DecidedStatus, Restriction, RestrictionStatus } from "../../shared/types";
import { useI18n } from "../i18n/context";
import { api } from "../lib/api";
import { useApp } from "../lib/app-context";
import { isUndecided } from "../lib/catalogue";
import { errorMessage } from "../lib/errors";
import { useToast } from "../lib/toast";
import { cx } from "./styles";

/**
 * "Contains:" and one chip per restriction in use. While the ingredient is undecided, chips are
 * picked and confirmed together (nothing picked means it contains none of them); once decided,
 * each chip saves as it is tapped.
 */
export function ContainsPicker({
  ingredientId,
  statuses,
  restrictions,
  onChange,
}: {
  ingredientId: number;
  statuses: Record<number, RestrictionStatus>;
  restrictions: Restriction[];
  onChange: () => void;
}) {
  const { t } = useI18n();
  const { refreshMe } = useApp();
  const toast = useToast();
  const [contains, setContains] = useState(() => new Set(restrictions.filter((r) => statuses[r.id] === "forbidden").map((r) => r.id)));
  const [pending, setPending] = useState(() => isUndecided({ statuses }, restrictions));
  const [busy, setBusy] = useState(false);

  const save = async (next: Set<number>) => {
    const decided: Record<number, DecidedStatus> = Object.fromEntries(restrictions.map((r) => [r.id, next.has(r.id) ? "forbidden" : "safe"]));
    setBusy(true);
    try {
      await api.put(`/api/ingredients/${ingredientId}`, { statuses: decided });
      setPending(false);
      onChange();
      refreshMe();
    } catch (error) {
      toast({ message: errorMessage(t, error), tone: "error" });
    } finally {
      setBusy(false);
    }
  };
  const toggle = (id: number) => {
    const next = new Set(contains);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setContains(next);
    if (!pending) void save(next);
  };

  if (restrictions.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-xs">
      <span className="font-medium text-tinta-soft">{t("contains.label")}</span>
      {restrictions.map((r) => (
        <button
          key={r.id}
          type="button"
          aria-pressed={contains.has(r.id)}
          disabled={busy}
          onClick={() => toggle(r.id)}
          className={cx(
            "rounded-[3px] px-2.5 py-0.5 font-semibold transition",
            contains.has(r.id) ? "bg-tomate text-on-mar" : "text-tinta-soft ring-1 ring-linha hover:text-tinta",
          )}
        >
          {r.name}
        </button>
      ))}
      {pending ? (
        <button type="button" disabled={busy} onClick={() => save(contains)} className="rounded-[3px] bg-mar px-3 py-0.5 font-semibold text-on-mar transition hover:brightness-110">
          {t(contains.size === 0 ? "contains.none" : "contains.confirm")}
        </button>
      ) : (
        <span className="font-semibold text-mar" aria-label={t("contains.decided")}>
          ✓
        </span>
      )}
    </span>
  );
}
