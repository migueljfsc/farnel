import { useState } from "react";
import { AISLES, type Aisle } from "../../shared/aisles";
import { priceUnit } from "../../shared/format";
import type { IngredientView, Restriction } from "../../shared/types";
import { ContainsPicker } from "../components/ContainsPicker";
import { NewIngredientForm } from "../components/NewIngredientForm";
import { SaveBar } from "../components/SaveBar";
import { Check, SelectionBar } from "../components/SelectionBar";
import { Button, Loaded, Page, List, Row } from "../components/ui";
import { cx, inputBase } from "../components/styles";
import { api, useApi } from "../lib/api";
import { useBulk } from "../lib/bulk";
import { useSelection } from "../lib/selection";
import { useApp } from "../lib/app-context";
import { useI18n } from "../i18n/context";
import { isUndecided } from "../lib/catalogue";
import { errorMessage } from "../lib/errors";
import { draftView, patchFor, type Draft, type DraftView } from "../lib/ingredient-drafts";
import { useToast } from "../lib/toast";

/** Shared by the header and every row, so the columns line up whatever the name. */
const COLUMNS = "grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 sm:grid-cols-[1.5rem_minmax(0,1fr)_10rem_9rem_8rem]";

const INVALID = "border-tomate ring-2 ring-tomate/25";

export function Ingredients({ filter }: { filter?: "to-decide" }) {
  const { navigate, me, refreshMe } = useApp();
  const { t, tn } = useI18n();
  const toast = useToast();
  const ingredients = useApi<{ ingredients: IngredientView[] }>("/api/ingredients");
  const restrictions = useApi<{ restrictions: Restriction[] }>("/api/restrictions");
  const toDecide = filter === "to-decide";
  const [adding, setAdding] = useState(false);
  const selection = useSelection(filter ?? "all");
  const bulk = useBulk(selection, ingredients.reload);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  /** Bumped on discard, so the restriction pickers start over from what is saved. */
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);

  const edit = (id: number, change: Draft) => setDrafts((all) => ({ ...all, [id]: { ...all[id], ...change } }));
  const pending = (ingredients.data?.ingredients ?? []).map((i) => ({ id: i.id, ...patchFor(i, drafts[i.id]) }));
  const changed = pending.filter((p) => !p.valid || Object.keys(p.patch).length > 0);
  const invalid = changed.some((p) => !p.valid);

  const save = async () => {
    setBusy(true);
    const results = await Promise.allSettled(changed.map((p) => api.put(`/api/ingredients/${p.id}`, p.patch)));
    const failed = new Set(changed.filter((_, index) => results[index].status === "rejected").map((p) => p.id));
    const failure = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
    setDrafts((all) => Object.fromEntries(Object.entries(all).filter(([id]) => failed.has(Number(id)))));
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
        <>
          <Button onClick={() => setAdding(!adding)} aria-expanded={adding}>
            {t("ingredients.new")}
          </Button>
          <Button variant={toDecide ? "secondary" : "primary"} onClick={() => navigate({ page: "ingredients" })}>{t("ingredients.all")}</Button>
          <Button variant={toDecide ? "primary" : "secondary"} onClick={() => navigate({ page: "ingredients", filter: "to-decide" })}>
            {t("nav.toDecide")}
            {me.undecided > 0 && ` (${me.undecided})`}
          </Button>
        </>
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
      <Loaded data={ingredients.data && restrictions.data ? { ...ingredients.data, ...restrictions.data } : undefined} error={ingredients.error ?? restrictions.error}>
        {(data) => {
          const shown = toDecide ? data.ingredients.filter((i) => isUndecided(i, data.restrictions)) : data.ingredients;
          return shown.length === 0 ? (
            <p className="text-sm text-tinta-soft">{t(toDecide ? "ingredients.nothingToDecide" : "ingredients.empty")}</p>
          ) : (
            <div className="space-y-2">
              <SelectionBar
                selection={selection}
                visible={shown.map((i) => i.id)}
                confirmKey="delete.confirmIngredients"
                onDelete={() => bulk.remove("/api/ingredients/delete", "delete.keptIngredients")}
              />
              <List>
                <li aria-hidden className={cx(COLUMNS, "hidden bg-papel/60 px-4 py-2 text-xs font-semibold text-tinta-soft sm:grid")}>
                  <span />
                  <span>{t("ingredients.column.name")}</span>
                  <span>{t("ingredients.aisle")}</span>
                  <span>{t("ingredients.price")}</span>
                  <span title={t("ingredients.proteinHint")}>{t("ingredients.protein")}</span>
                </li>
                {shown.map((i) => {
                  const view = draftView(i, drafts[i.id]);
                  const isChanged = changed.some((p) => p.id === i.id);
                  return (
                    <Row
                      key={i.id}
                      className={cx(COLUMNS, selection.selected.has(i.id) && "bg-mar-soft/60", isChanged && "shadow-[inset_3px_0_0_var(--mar)]")}
                    >
                      <Check checked={selection.selected.has(i.id)} onChange={() => selection.toggle(i.id)} label={t("selection.select", { name: i.name })} />
                      <span className="truncate font-medium" title={i.name}>
                        {i.name}
                      </span>
                      <div className="col-start-2 flex flex-wrap items-center gap-2 sm:contents">
                        <AisleSelect value={view.aisle} onChange={(aisle) => edit(i.id, { aisle })} />
                        <PriceInput ingredient={i} view={view} onChange={(price) => edit(i.id, { price })} />
                        <ProteinInput ingredient={i} view={view} onChange={(protein) => edit(i.id, { protein })} />
                      </div>
                      <div className="col-start-2 sm:col-span-4">
                        <ContainsPicker
                          key={revision}
                          ingredientId={i.id}
                          statuses={view.statuses}
                          restrictions={data.restrictions}
                          onEdit={(statuses) => edit(i.id, { statuses })}
                        />
                      </div>
                    </Row>
                  );
                })}
              </List>
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
            setRevision((r) => r + 1);
          }}
          onSave={save}
        />
      )}
    </Page>
  );
}

function AisleSelect({ value, onChange }: { value: Aisle; onChange: (aisle: Aisle) => void }) {
  const { t } = useI18n();
  return (
    <select aria-label={t("ingredients.aisle")} className={`${inputBase} py-1.5 sm:w-full`} value={value} onChange={(e) => onChange(e.target.value as Aisle)}>
      {AISLES.map((a) => (
        <option key={a} value={a}>
          {t(`aisle.${a}`)}
        </option>
      ))}
    </select>
  );
}

function PriceInput({ ingredient, view, onChange }: { ingredient: IngredientView; view: DraftView; onChange: (price: string) => void }) {
  const { t } = useI18n();
  const valid = patchFor(ingredient, { price: view.price }).valid;
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <input
        aria-label={t("ingredients.price")}
        aria-invalid={!valid}
        className={cx(inputBase, "w-20 py-1.5", !valid && INVALID)}
        inputMode="decimal"
        value={view.price}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="w-8 text-tinta-soft">{priceUnit(ingredient.unit)}</span>
    </span>
  );
}

/**
 * Whether the ingredient counts as protein. Weighed ones are all-or-nothing; counted ones (eggs)
 * take the raw weight of one unit.
 */
function ProteinInput({ ingredient, view, onChange }: { ingredient: IngredientView; view: DraftView; onChange: (protein: string) => void }) {
  const { t } = useI18n();
  if (ingredient.unit === "un") {
    const valid = patchFor(ingredient, { protein: view.protein }).valid;
    return (
      <span className="inline-flex items-center gap-2 text-sm" title={t("ingredients.proteinHint")}>
        <input
          aria-label={t("ingredients.protein")}
          aria-invalid={!valid}
          className={cx(inputBase, "w-16 py-1.5", !valid && INVALID)}
          inputMode="decimal"
          placeholder="—"
          value={view.protein}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="whitespace-nowrap text-tinta-soft">{t("ingredients.proteinEach")}</span>
      </span>
    );
  }
  return (
    <label className="inline-flex items-center gap-2 text-sm" title={t("ingredients.proteinHint")}>
      <input type="checkbox" className="size-4 accent-mar" checked={view.protein !== ""} onChange={(e) => onChange(e.target.checked ? "1" : "")} />
      <span className="sm:sr-only">{t("ingredients.protein")}</span>
    </label>
  );
}
