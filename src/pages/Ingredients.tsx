import { useState } from "react";
import { parseMoney, priceUnit } from "../../shared/format";
import type { IngredientView, Restriction } from "../../shared/types";
import { IngredientStatuses } from "../components/IngredientStatuses";
import { Button, CatalogueTabs, Loaded, Page, List, Row, SaveStatus } from "../components/ui";
import { inputBase } from "../components/styles";
import { api, useApi } from "../lib/api";
import { useAutosave } from "../lib/autosave";
import { useApp } from "../lib/app-context";
import { useI18n } from "../i18n/context";
import { isUndecided } from "../lib/catalogue";

export function Ingredients({ filter }: { filter?: "to-decide" }) {
  const { navigate, me } = useApp();
  const { t } = useI18n();
  const ingredients = useApi<{ ingredients: IngredientView[] }>("/api/ingredients");
  const restrictions = useApi<{ restrictions: Restriction[] }>("/api/restrictions");
  const toDecide = filter === "to-decide";

  return (
    <Page
      title={t("nav.ingredients")}
      actions={
        <>
          <Button variant={toDecide ? "secondary" : "primary"} onClick={() => navigate({ page: "ingredients" })}>{t("ingredients.all")}</Button>
          <Button variant={toDecide ? "primary" : "secondary"} onClick={() => navigate({ page: "ingredients", filter: "to-decide" })}>
            {t("nav.toDecide")}
            {me.undecided > 0 && ` (${me.undecided})`}
          </Button>
        </>
      }
    >
      <CatalogueTabs current="ingredients" />
      <Loaded data={ingredients.data && restrictions.data ? { ...ingredients.data, ...restrictions.data } : undefined} error={ingredients.error ?? restrictions.error}>
        {(data) => {
          const shown = toDecide ? data.ingredients.filter((i) => isUndecided(i, data.restrictions)) : data.ingredients;
          return shown.length === 0 ? (
            <p className="text-sm text-terra-soft">{t(toDecide ? "ingredients.nothingToDecide" : "ingredients.empty")}</p>
          ) : (
            <List>
              {shown.map((i) => (
                <Row key={i.id} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{i.name}</span>
                    <PriceEditor ingredient={i} />
                  </div>
                  <IngredientStatuses ingredientId={i.id} statuses={i.statuses} restrictions={data.restrictions} onChange={ingredients.reload} />
                </Row>
              ))}
            </List>
          );
        }}
      </Loaded>
    </Page>
  );
}

function PriceEditor({ ingredient }: { ingredient: IngredientView }) {
  const [text, setText] = useState(ingredient.priceCents === null ? "" : (ingredient.priceCents / 100).toFixed(2));
  const priceCents = text.trim() === "" ? null : parseMoney(text);
  const state = useAutosave(priceCents, (cents) => api.put(`/api/ingredients/${ingredient.id}`, { priceCents: cents }), text.trim() === "" || priceCents !== null);
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <input className={`${inputBase} w-20`} inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} />
      <span className="text-terra-soft">{priceUnit(ingredient.unit)}</span>
      <SaveStatus state={state} />
    </span>
  );
}
