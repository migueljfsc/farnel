import { useState } from "react";
import { parseMoney, priceUnit } from "../../shared/format";
import type { IngredientView, Restriction } from "../../shared/types";
import { IngredientStatuses } from "../components/IngredientStatuses";
import { Button, Card, ErrorText, Loaded, Page } from "../components/ui";
import { inputClass } from "../components/styles";
import { api, useApi } from "../lib/api";
import { useApp } from "../lib/app-context";
import { useI18n } from "../i18n/context";

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
      <Loaded data={ingredients.data && restrictions.data ? { ...ingredients.data, ...restrictions.data } : undefined} error={ingredients.error ?? restrictions.error}>
        {(data) => {
          const undecided = (i: IngredientView) => data.restrictions.some((r) => (i.statuses[r.id] ?? "unknown") === "unknown");
          const shown = toDecide ? data.ingredients.filter(undecided) : data.ingredients;
          return shown.length === 0 ? (
            <p className="text-sm text-stone-500">{t(toDecide ? "ingredients.nothingToDecide" : "ingredients.empty")}</p>
          ) : (
            <div className="space-y-2">
              {shown.map((i) => (
                <Card key={i.id} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{i.name}</span>
                    <PriceEditor ingredient={i} onChange={ingredients.reload} />
                  </div>
                  <IngredientStatuses ingredientId={i.id} statuses={i.statuses} restrictions={data.restrictions} onChange={ingredients.reload} />
                </Card>
              ))}
            </div>
          );
        }}
      </Loaded>
    </Page>
  );
}

function PriceEditor({ ingredient, onChange }: { ingredient: IngredientView; onChange: () => void }) {
  const { money } = useI18n();
  const [text, setText] = useState(ingredient.priceCents === null ? "" : (ingredient.priceCents / 100).toFixed(2));
  const [failure, setFailure] = useState<unknown>();
  const save = async () => {
    const priceCents = parseMoney(text);
    if (priceCents === ingredient.priceCents) return;
    try {
      await api.put(`/api/ingredients/${ingredient.id}`, { priceCents });
      onChange();
    } catch (e) {
      setFailure(e);
    }
  };
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <input className={`${inputClass} w-20`} inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} onBlur={save} />
      <span className="text-stone-500">{priceUnit(ingredient.unit)}</span>
      {ingredient.priceCents !== null && <span className="text-xs text-stone-400">({money(ingredient.priceCents)})</span>}
      {failure !== undefined && <ErrorText error={failure} />}
    </span>
  );
}
