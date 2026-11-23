import { useState } from "react";
import { AISLES, type Aisle } from "../../shared/aisles";
import { parseMoney, priceUnit } from "../../shared/format";
import type { IngredientView, Restriction } from "../../shared/types";
import { ContainsPicker } from "../components/ContainsPicker";
import { NewIngredientForm } from "../components/NewIngredientForm";
import { Button, CatalogueTabs, Loaded, Page, List, Row, SaveStatus } from "../components/ui";
import { inputBase } from "../components/styles";
import { api, useApi } from "../lib/api";
import { useAutosave } from "../lib/autosave";
import { useApp } from "../lib/app-context";
import { useI18n } from "../i18n/context";
import { isUndecided } from "../lib/catalogue";
import { errorMessage } from "../lib/errors";
import { useToast } from "../lib/toast";

export function Ingredients({ filter }: { filter?: "to-decide" }) {
  const { navigate, me } = useApp();
  const { t } = useI18n();
  const ingredients = useApi<{ ingredients: IngredientView[] }>("/api/ingredients");
  const restrictions = useApi<{ restrictions: Restriction[] }>("/api/restrictions");
  const toDecide = filter === "to-decide";
  const [adding, setAdding] = useState(false);

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
            <List>
              {shown.map((i) => (
                <Row key={i.id} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{i.name}</span>
                    <span className="flex flex-wrap items-center gap-2">
                      <AisleSelect ingredient={i} />
                      <PriceEditor ingredient={i} />
                    </span>
                  </div>
                  <ContainsPicker ingredientId={i.id} statuses={i.statuses} restrictions={data.restrictions} onChange={ingredients.reload} />
                </Row>
              ))}
            </List>
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
      className={`${inputBase} py-1.5`}
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
  const [text, setText] = useState(ingredient.priceCents === null ? "" : (ingredient.priceCents / 100).toFixed(2));
  const priceCents = text.trim() === "" ? null : parseMoney(text);
  const state = useAutosave(priceCents, (cents) => api.put(`/api/ingredients/${ingredient.id}`, { priceCents: cents }), text.trim() === "" || priceCents !== null);
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <input className={`${inputBase} w-20`} inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} />
      <span className="text-cafe-soft">{priceUnit(ingredient.unit)}</span>
      <SaveStatus state={state} />
    </span>
  );
}
