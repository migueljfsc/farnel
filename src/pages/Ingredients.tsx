import { useState } from "react";
import { formatMoney, parseMoney, priceUnit } from "../../shared/format";
import type { IngredientView, Restriction } from "../../shared/types";
import { IngredientStatuses } from "../components/IngredientStatuses";
import { Button, Card, ErrorText, inputClass, Loaded, Page } from "../components/ui";
import { api, useApi } from "../lib/api";
import { useApp } from "../lib/app-context";

export function Ingredients({ filter }: { filter?: "to-decide" }) {
  const { navigate, me } = useApp();
  const ingredients = useApi<{ ingredients: IngredientView[] }>("/api/ingredients");
  const restrictions = useApi<{ restrictions: Restriction[] }>("/api/restrictions");
  const toDecide = filter === "to-decide";

  return (
    <Page
      title="Ingredients"
      actions={
        <>
          <Button variant={toDecide ? "secondary" : "primary"} onClick={() => navigate({ page: "ingredients" })}>All</Button>
          <Button variant={toDecide ? "primary" : "secondary"} onClick={() => navigate({ page: "ingredients", filter: "to-decide" })}>
            To decide{me.undecided > 0 && ` (${me.undecided})`}
          </Button>
        </>
      }
    >
      <Loaded data={ingredients.data && restrictions.data ? { ...ingredients.data, ...restrictions.data } : undefined} error={ingredients.error ?? restrictions.error}>
        {(data) => {
          const shown = toDecide ? data.ingredients.filter((i) => Object.values(i.statuses).includes("unknown")) : data.ingredients;
          return shown.length === 0 ? (
            <p className="text-sm text-stone-500">{toDecide ? "Nothing to decide." : "No ingredients yet."}</p>
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
      {ingredient.priceCents !== null && <span className="text-xs text-stone-400">({formatMoney(ingredient.priceCents)})</span>}
      {failure !== undefined && <ErrorText error={failure} />}
    </span>
  );
}
