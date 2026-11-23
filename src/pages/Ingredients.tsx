import { useState } from "react";
import { AISLES, type Aisle } from "../../shared/aisles";
import { parseMoney, priceUnit } from "../../shared/format";
import type { IngredientView, Restriction } from "../../shared/types";
import { ContainsPicker } from "../components/ContainsPicker";
import { NewIngredientForm } from "../components/NewIngredientForm";
import { Check, SelectionBar } from "../components/SelectionBar";
import { Button, CatalogueTabs, Loaded, Page, List, Row, SaveStatus } from "../components/ui";
import { cx, inputBase } from "../components/styles";
import { api, useApi } from "../lib/api";
import { useAutosave } from "../lib/autosave";
import { useBulk } from "../lib/bulk";
import { useSelection } from "../lib/selection";
import { useApp } from "../lib/app-context";
import { useI18n } from "../i18n/context";
import { isUndecided } from "../lib/catalogue";
import { errorMessage } from "../lib/errors";
import { useToast } from "../lib/toast";

/** Shared by the header and every row, so the columns line up whatever the name or save state. */
const COLUMNS = "grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 sm:grid-cols-[1.5rem_minmax(0,1fr)_10rem_13rem]";

export function Ingredients({ filter }: { filter?: "to-decide" }) {
  const { navigate, me } = useApp();
  const { t } = useI18n();
  const ingredients = useApi<{ ingredients: IngredientView[] }>("/api/ingredients");
  const restrictions = useApi<{ restrictions: Restriction[] }>("/api/restrictions");
  const toDecide = filter === "to-decide";
  const [adding, setAdding] = useState(false);
  const selection = useSelection(filter ?? "all");
  const bulk = useBulk(selection, ingredients.reload);

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
      <CatalogueTabs current="ingredients" />
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
            <p className="text-sm text-cafe-soft">{t(toDecide ? "ingredients.nothingToDecide" : "ingredients.empty")}</p>
          ) : (
            <div className="space-y-2">
              <SelectionBar
                selection={selection}
                visible={shown.map((i) => i.id)}
                confirmKey="delete.confirmIngredients"
                onDelete={() => bulk.remove("/api/ingredients/delete", "delete.keptIngredients")}
              />
              <List>
                <li aria-hidden className={cx(COLUMNS, "hidden bg-aveia/60 px-4 py-2 text-xs font-semibold text-cafe-soft sm:grid")}>
                  <span />
                  <span>{t("ingredients.column.name")}</span>
                  <span>{t("ingredients.aisle")}</span>
                  <span>{t("ingredients.price")}</span>
                </li>
                {shown.map((i) => (
                  <Row key={i.id} className={cx(COLUMNS, selection.selected.has(i.id) && "bg-salva-soft/60")}>
                    <Check checked={selection.selected.has(i.id)} onChange={() => selection.toggle(i.id)} label={t("selection.select", { name: i.name })} />
                    <span className="truncate font-medium" title={i.name}>
                      {i.name}
                    </span>
                    <div className="col-start-2 flex flex-wrap items-center gap-2 sm:contents">
                      <AisleSelect ingredient={i} />
                      <PriceEditor ingredient={i} />
                    </div>
                    <div className="col-start-2 sm:col-span-3">
                      <ContainsPicker ingredientId={i.id} statuses={i.statuses} restrictions={data.restrictions} onChange={ingredients.reload} />
                    </div>
                  </Row>
                ))}
              </List>
            </div>
          );
        }}
      </Loaded>
    </Page>
  );
}

/** The ingredient's aisle; a change saves at once. */
function AisleSelect({ ingredient }: { ingredient: IngredientView }) {
  const { t } = useI18n();
  const toast = useToast();
  const [aisle, setAisle] = useState<Aisle>(ingredient.aisle);
  return (
    <select
      aria-label={t("ingredients.aisle")}
      className={`${inputBase} py-1.5 sm:w-full`}
      value={aisle}
      onChange={async (e) => {
        const next = e.target.value as Aisle;
        setAisle(next);
        try {
          await api.put(`/api/ingredients/${ingredient.id}`, { aisle: next });
        } catch (error) {
          toast({ message: errorMessage(t, error), tone: "error" });
        }
      }}
    >
      {AISLES.map((a) => (
        <option key={a} value={a}>
          {t(`aisle.${a}`)}
        </option>
      ))}
    </select>
  );
}

function PriceEditor({ ingredient }: { ingredient: IngredientView }) {
  const { t } = useI18n();
  const [text, setText] = useState(ingredient.priceCents === null ? "" : (ingredient.priceCents / 100).toFixed(2));
  const priceCents = text.trim() === "" ? null : parseMoney(text);
  const state = useAutosave(priceCents, (cents) => api.put(`/api/ingredients/${ingredient.id}`, { priceCents: cents }), text.trim() === "" || priceCents !== null);
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <input aria-label={t("ingredients.price")} className={`${inputBase} w-20 py-1.5`} inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} />
      <span className="w-8 text-cafe-soft">{priceUnit(ingredient.unit)}</span>
      <span className="w-20 truncate">
        <SaveStatus state={state} />
      </span>
    </span>
  );
}
