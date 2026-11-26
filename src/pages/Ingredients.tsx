import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { AISLES, type Aisle } from "../../shared/aisles";
import { priceUnit } from "../../shared/format";
import type { IngredientView, Restriction, RestrictionStatus, Unit } from "../../shared/types";
import { NewIngredientForm } from "../components/NewIngredientForm";
import { SaveBar } from "../components/SaveBar";
import { Check, SelectionBar } from "../components/SelectionBar";
import { Button, Loaded, Page } from "../components/ui";
import { cx, inputBase } from "../components/styles";
import { api, useApi } from "../lib/api";
import { useBulk } from "../lib/bulk";
import { useSelection } from "../lib/selection";
import { useApp } from "../lib/app-context";
import { useI18n } from "../i18n/context";
import type { MessageKey } from "../i18n/core";
import { errorMessage } from "../lib/errors";
import { draftView, patchFor, type Draft, type DraftView } from "../lib/ingredient-drafts";
import { groupByAisle, matches, nextStatus, type TableFilter } from "../lib/ingredient-table";
import { useCollapsed } from "../lib/collapsed";
import { useToast } from "../lib/toast";

const UNITS: Unit[] = ["g", "ml", "un"];

const INVALID = "border-tomate! ring-2 ring-tomate/25";

const FILTERS: { value: TableFilter; label: MessageKey }[] = [
  { value: "all", label: "ingredients.all" },
  { value: "undecided", label: "nav.toDecide" },
  { value: "protein", label: "ingredients.filter.protein" },
  { value: "noPrice", label: "ingredients.filter.noPrice" },
];

/**
 * The catalogue's ingredients as a table grouped by aisle. Rows read as text; clicking one turns
 * its cells into fields. Edits to any number of rows wait in the save bar until saved together.
 */
export function Ingredients({ filter: routeFilter }: { filter?: "to-decide" }) {
  const { refreshMe } = useApp();
  const { t, tn } = useI18n();
  const toast = useToast();
  const ingredients = useApi<{ ingredients: IngredientView[] }>("/api/ingredients");
  const restrictions = useApi<{ restrictions: Restriction[] }>("/api/restrictions");
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<TableFilter>(routeFilter === "to-decide" ? "undecided" : "all");
  const [editing, setEditing] = useState<number | null>(null);
  const selection = useSelection(`${filter}:${query}`);
  const bulk = useBulk(selection, ingredients.reload);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [busy, setBusy] = useState(false);
  const [collapsed, toggleCollapsed] = useCollapsed("ingredients:collapsed");

  const edit = (id: number, change: Draft) => setDrafts((all) => ({ ...all, [id]: { ...all[id], ...change } }));
  const pending = (ingredients.data?.ingredients ?? []).map((i) => ({ id: i.id, ...patchFor(i, drafts[i.id]) }));
  const changed = pending.filter((p) => !p.valid || Object.keys(p.patch).length > 0);
  const changedIds = new Set(changed.map((p) => p.id));
  const invalid = changed.some((p) => !p.valid);

  const save = async () => {
    setBusy(true);
    const results = await Promise.allSettled(changed.map((p) => api.put(`/api/ingredients/${p.id}`, p.patch)));
    const failed = new Set(changed.filter((_, index) => results[index].status === "rejected").map((p) => p.id));
    const failure = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
    setDrafts((all) => Object.fromEntries(Object.entries(all).filter(([id]) => failed.has(Number(id)))));
    setEditing(null);
    setBusy(false);
    ingredients.reload();
    refreshMe();
    if (failure) toast({ message: errorMessage(t, failure.reason), tone: "error" });
    else toast({ message: tn("ingredients.saved", changed.length) });
  };

  return (
    <Page
      title={t("nav.ingredients")}
      actions={
        <Button variant="secondary" onClick={() => setAdding(!adding)} aria-expanded={adding}>
          {t("ingredients.new")}
        </Button>
      }
    >
      {adding && (
        <NewIngredientForm
          onCancel={() => setAdding(false)}
          onCreated={() => {
            setAdding(false);
            ingredients.reload();
          }}
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          aria-label={t("ingredients.search")}
          placeholder={t("ingredients.search")}
          className={cx(inputBase, "min-w-48 flex-1 py-1.5")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div role="group" aria-label={t("ingredients.filter.label")} className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={cx(
                "rounded-[3px] px-2.5 py-1 text-xs font-semibold transition",
                filter === f.value ? "bg-tinta text-papel" : "text-tinta-soft shadow-[inset_0_0_0_1.5px_var(--linha)] hover:text-tinta",
              )}
            >
              {t(f.label)}
            </button>
          ))}
        </div>
      </div>
      <Loaded data={ingredients.data && restrictions.data ? { ...ingredients.data, ...restrictions.data } : undefined} error={ingredients.error ?? restrictions.error}>
        {(data) => {
          const shown = data.ingredients.filter((i) => changedIds.has(i.id) || matches(i, draftView(i, drafts[i.id]), { query, filter }, data.restrictions));
          if (data.ingredients.length === 0) return <p className="text-sm text-tinta-soft">{t("ingredients.empty")}</p>;
          if (shown.length === 0) return <p className="text-sm text-tinta-soft">{t(filter === "undecided" && !query ? "ingredients.nothingToDecide" : "ingredients.noMatch")}</p>;
          const columns = 5 + data.restrictions.length;
          return (
            <div className="space-y-2">
              <SelectionBar
                selection={selection}
                visible={shown.filter((i) => !collapsed.has(i.aisle)).map((i) => i.id)}
                confirmKey="delete.confirmIngredients"
                onDelete={() => bulk.remove("/api/ingredients/delete", "delete.keptIngredients")}
              />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[34rem] border-collapse text-sm">
                  <thead>
                    <tr className="border-b-2 border-tinta text-left text-[11px] font-bold uppercase tracking-wide text-tinta-soft">
                      <th className="w-9 py-2 pl-1" aria-label={t("selection.label")} />
                      <th className="py-2 pr-3">{t("ingredients.column.name")}</th>
                      <th className="w-36 py-2 pr-3">{t("ingredients.price")}</th>
                      <th className="w-32 py-2 pr-3" title={t("ingredients.proteinHint")}>
                        {t("ingredients.protein")}
                      </th>
                      <th className="w-32 py-2 pr-3" title={t("ingredients.stockHint")}>
                        {t("ingredients.stock")}
                      </th>
                      {data.restrictions.map((r) => (
                        <th key={r.id} className="w-20 px-1 py-2 text-center">
                          {r.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  {groupByAisle(shown).map((group) => {
                    const open = !collapsed.has(group.aisle);
                    const unsaved = group.items.some((i) => changedIds.has(i.id));
                    return (
                      <tbody key={group.aisle}>
                        <tr>
                          <th colSpan={columns} scope="colgroup" className="border-b border-tinta p-0 text-left">
                            <button
                              type="button"
                              aria-expanded={open}
                              onClick={() => toggleCollapsed(group.aisle)}
                              className="display flex w-full items-center gap-2 pb-1 pl-1 pt-4 text-left text-base text-mar hover:text-tinta"
                            >
                              <svg viewBox="0 0 24 24" aria-hidden className={cx("size-4 transition", !open && "-rotate-90")} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m6 9 6 6 6-6" />
                              </svg>
                              {t(`aisle.${group.aisle}`)}
                              <span className="font-sans text-xs font-medium normal-case tracking-normal text-tinta-soft">{group.items.length}</span>
                              {!open && unsaved && <span className="size-2 rounded-[2px] bg-mar" title={t("common.unsaved")} />}
                            </button>
                          </th>
                        </tr>
                        {open && group.items.map((i) => (
                          <IngredientRow
                            key={i.id}
                            ingredient={i}
                            view={draftView(i, drafts[i.id])}
                            restrictions={data.restrictions}
                            editing={editing === i.id}
                            changed={changedIds.has(i.id)}
                            selected={selection.selected.has(i.id)}
                            onToggle={() => selection.toggle(i.id)}
                            onEdit={() => setEditing(i.id)}
                            onChange={(change) => edit(i.id, change)}
                          />
                        ))}
                      </tbody>
                    );
                  })}
                </table>
              </div>
            </div>
          );
        }}
      </Loaded>
      {changed.length > 0 && (
        <SaveBar
          message={invalid ? t("error.invalid") : tn("ingredients.unsaved", changed.length)}
          warning={invalid}
          busy={busy}
          canSave={!invalid}
          onDiscard={() => {
            setDrafts({});
            setEditing(null);
          }}
          onSave={save}
        />
      )}
    </Page>
  );
}

/** Clicks on the row's own controls do not also open the row for editing. */
const fromControl = (e: MouseEvent | KeyboardEvent) => (e.target as HTMLElement).closest("input, select, button, label, a") !== null;

function IngredientRow({
  ingredient,
  view,
  restrictions,
  editing,
  changed,
  selected,
  onToggle,
  onEdit,
  onChange,
}: {
  ingredient: IngredientView;
  view: DraftView;
  restrictions: Restriction[];
  editing: boolean;
  changed: boolean;
  selected: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onChange: (change: Draft) => void;
}) {
  const { t, quantity } = useI18n();
  const priceValid = patchFor(ingredient, { price: view.price }).valid;
  const proteinValid = patchFor(ingredient, { protein: view.protein }).valid;
  const stockValid = patchFor(ingredient, { stock: view.stock }).valid;
  const setStatus = (restrictionId: number, status: "safe" | "forbidden") => {
    const decided = Object.fromEntries(Object.entries(view.statuses).filter(([, s]) => s !== "unknown")) as Record<number, "safe" | "forbidden">;
    onChange({ statuses: { ...decided, [restrictionId]: status } });
  };

  return (
    <tr
      aria-label={editing ? undefined : t("ingredients.edit", { name: ingredient.name })}
      tabIndex={editing ? undefined : 0}
      onClick={(e) => !editing && !fromControl(e) && onEdit()}
      onKeyDown={(e) => !editing && e.key === "Enter" && !fromControl(e) && onEdit()}
      className={cx(
        "border-b border-linha align-middle transition-colors",
        editing ? "bg-mar-soft/50" : "cursor-pointer hover:bg-mar-soft/30",
        selected && "bg-mar-soft/60",
        changed && "shadow-[inset_3px_0_0_var(--mar)]",
      )}
    >
      <td className="py-2 pl-1">
        <Check checked={selected} onChange={onToggle} label={t("selection.select", { name: ingredient.name })} />
      </td>
      <td className="py-2 pr-3">
        <span className="font-semibold">{ingredient.name}</span>
        {editing && (
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            <select
              aria-label={t("ingredients.aisle")}
              className={cx(inputBase, "w-full max-w-48 py-1")}
              value={view.aisle}
              onChange={(e) => onChange({ aisle: e.target.value as Aisle })}
            >
              {AISLES.map((a) => (
                <option key={a} value={a}>
                  {t(`aisle.${a}`)}
                </option>
              ))}
            </select>
            <select
              aria-label={t("ingredients.unit")}
              title={ingredient.inUse ? t("ingredients.unitLocked") : undefined}
              disabled={ingredient.inUse}
              className={cx(inputBase, "w-24 py-1")}
              value={view.unit}
              onChange={(e) => onChange({ unit: e.target.value as Unit })}
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {t(`unit.${u}`)}
                </option>
              ))}
            </select>
          </span>
        )}
      </td>
      <td className="py-2 pr-3 tabular-nums">
        {editing ? (
          <span className="inline-flex items-center gap-1.5">
            <input
              aria-label={t("ingredients.price")}
              aria-invalid={!priceValid}
              className={cx(inputBase, "w-20 py-1", !priceValid && INVALID)}
              inputMode="decimal"
              value={view.price}
              onChange={(e) => onChange({ price: e.target.value })}
            />
            <span className="text-tinta-soft">{priceUnit(view.unit)}</span>
          </span>
        ) : view.price.trim() ? (
          <>
            {view.price} <span className="text-tinta-soft">{priceUnit(view.unit)}</span>
          </>
        ) : (
          <span className="text-tinta-soft">—</span>
        )}
      </td>
      <td className="py-2 pr-3">
        {editing ? (
          view.unit === "un" ? (
            <span className="inline-flex items-center gap-1.5">
              <input
                aria-label={t("ingredients.protein")}
                aria-invalid={!proteinValid}
                className={cx(inputBase, "w-16 py-1", !proteinValid && INVALID)}
                inputMode="decimal"
                placeholder="—"
                value={view.protein}
                onChange={(e) => onChange({ protein: e.target.value })}
              />
              <span className="whitespace-nowrap text-tinta-soft">{t("ingredients.proteinEach")}</span>
            </span>
          ) : (
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" className="size-4 accent-mar" checked={view.protein !== ""} onChange={(e) => onChange({ protein: e.target.checked ? "1" : "" })} />
              {t("ingredients.protein")}
            </label>
          )
        ) : (
          view.protein.trim() !== "" && (
            <span className="rounded-[2px] bg-mar-soft px-1.5 py-0.5 text-[11px] font-bold text-mar">
              {view.unit === "un" ? `${view.protein} ${t("ingredients.proteinEach")}` : t("ingredients.isProtein")}
            </span>
          )
        )}
      </td>
      <td className="py-2 pr-3 tabular-nums">
        {editing ? (
          <span className="inline-flex items-center gap-1.5">
            <input
              aria-label={t("ingredients.stock")}
              aria-invalid={!stockValid}
              className={cx(inputBase, "w-20 py-1", !stockValid && INVALID)}
              inputMode="decimal"
              placeholder="—"
              value={view.stock}
              onChange={(e) => onChange({ stock: e.target.value })}
            />
            <span className="text-tinta-soft">{t(`unit.${view.unit}`)}</span>
          </span>
        ) : view.stock.trim() !== "" && Number(view.stock.replace(",", ".")) > 0 ? (
          quantity(Number(view.stock.replace(",", ".")), view.unit)
        ) : (
          view.stock.trim() !== "" && <span className="text-tinta-soft">{t("ingredients.stockNone")}</span>
        )}
      </td>
      {restrictions.map((r) => (
        <td key={r.id} className="px-1 py-2 text-center">
          <StatusCell
            status={view.statuses[r.id] ?? "unknown"}
            label={`${r.name}, ${ingredient.name}`}
            editable={editing}
            onClick={() => setStatus(r.id, nextStatus(view.statuses[r.id] ?? "unknown"))}
          />
        </td>
      ))}
    </tr>
  );
}

const MARK: Record<RestrictionStatus, string> = { safe: "–", forbidden: "✕", unknown: "?" };
const MARK_CLASS: Record<RestrictionStatus, string> = {
  safe: "text-tinta-soft/60",
  forbidden: "bg-tomate text-white",
  unknown: "bg-mostarda text-[#17201e]",
};
const STATUS_LABEL: Record<RestrictionStatus, MessageKey> = { safe: "restriction.safe", forbidden: "restriction.forbidden", unknown: "restriction.unknown" };

/** Whether the ingredient contains a restriction: – no, ✕ yes, ? not decided. A button while editing. */
function StatusCell({ status, label, editable, onClick }: { status: RestrictionStatus; label: string; editable: boolean; onClick: () => void }) {
  const { t } = useI18n();
  const className = cx("inline-grid size-6 place-items-center rounded-[2px] text-xs font-bold", MARK_CLASS[status]);
  const name = `${label}: ${t(STATUS_LABEL[status])}`;
  if (!editable)
    return (
      <span className={className} title={name} aria-label={name} role="img">
        {MARK[status]}
      </span>
    );
  return (
    <button type="button" onClick={onClick} aria-label={name} title={name} className={cx(className, "shadow-[inset_0_0_0_1.5px_var(--tinta)] transition hover:scale-110")}>
      {MARK[status]}
    </button>
  );
}
