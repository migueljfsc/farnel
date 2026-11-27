import { useState, type FormEvent } from "react";
import { amountFor } from "../../shared/packs";
import { SOURCE_NAME, type Store } from "../../shared/stores";
import type { StoreLinkInput, StoreProduct, Unit } from "../../shared/types";
import { useI18n } from "../i18n/context";
import { useApi } from "../lib/api";
import { errorMessage } from "../lib/errors";
import { Button } from "./ui";
import { cx, inputBase } from "./styles";

const parse = (text: string): number => Number(text.trim().replace(",", "."));

/**
 * Searches one store for a product to link to an ingredient. Picking one proposes how much of the
 * ingredient it gives from its pack; an ingredient counted in units asks for grams per unit when
 * the product is sold by weight.
 */
export function StoreSearch({ store, name, unit, onPick, onClose }: { store: Store; name: string; unit: Unit; onPick: (link: StoreLinkInput) => void; onClose: () => void }) {
  const { t, money } = useI18n();
  const [query, setQuery] = useState(name);
  const [searched, setSearched] = useState(name.trim());
  const results = useApi<{ products: StoreProduct[] }>(searched ? `/api/store-search?${new URLSearchParams({ q: searched, store })}` : null);
  const products = results.data?.products ?? null;
  const [picked, setPicked] = useState<StoreProduct | null>(null);
  const [amount, setAmount] = useState("");
  const [gramsPerUnit, setGramsPerUnit] = useState("");

  const search = (e: FormEvent) => {
    e.preventDefault();
    setPicked(null);
    if (query.trim() === searched) results.reload();
    else setSearched(query.trim());
  };

  const pick = (product: StoreProduct) => {
    setPicked(product);
    setGramsPerUnit("");
    const proposed = product.pack && amountFor(product.pack, unit);
    setAmount(proposed ? String(proposed) : "");
  };

  const byWeight = picked?.pack?.unit === "g" && unit === "un";
  const chosen = byWeight && picked?.pack ? amountFor(picked.pack, unit, parse(gramsPerUnit)) : parse(amount);
  const valid = chosen !== null && Number.isFinite(chosen) && chosen > 0;

  const link = () => {
    if (!picked || !valid) return;
    const { sourceId, name: productName, url, ean, packText, priceCents, checkedAt } = picked;
    onPick({ sourceId, name: productName, url, ean, packText, amount: chosen, priceCents, checkedAt });
  };

  return (
    <div className="space-y-2 border-l-2 border-mar py-1 pl-3">
      <form onSubmit={search} className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          aria-label={t("ingredients.storeSearch", { store: SOURCE_NAME[store] })}
          placeholder={t("ingredients.storeSearch", { store: SOURCE_NAME[store] })}
          className={cx(inputBase, "min-w-48 flex-1 py-1")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <Button type="submit" variant="secondary">
          {t("ingredients.search")}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          {t("common.close")}
        </Button>
      </form>
      {results.error && <p className="text-sm text-tomate">{errorMessage(t, results.error)}</p>}
      {products?.length === 0 && <p className="text-sm text-tinta-soft">{t("ingredients.storeNone", { store: SOURCE_NAME[store] })}</p>}
      {products && products.length > 0 && (
        <ul aria-label={t("ingredients.storeResults", { store: SOURCE_NAME[store] })} className="max-h-64 overflow-y-auto">
          {products.map((p) => (
            <li key={p.sourceId}>
              <button
                type="button"
                aria-pressed={picked?.sourceId === p.sourceId}
                onClick={() => pick(p)}
                className={cx(
                  "flex w-full items-baseline gap-3 border-b border-linha px-1 py-1.5 text-left text-sm hover:bg-mar-soft/40",
                  picked?.sourceId === p.sourceId && "bg-mar-soft font-semibold shadow-[inset_3px_0_0_var(--mar)]",
                )}
              >
                <span className="flex-1">
                  {p.name}
                  {p.packText && <span className="ml-1.5 text-xs text-tinta-soft">{p.packText}</span>}
                </span>
                <span className="tabular-nums">
                  {money(p.priceCents)}
                  {p.priceUnit && p.priceUnit !== "embalagem" && <span className="text-tinta-soft">/{p.priceUnit}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {picked && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {byWeight ? (
            <label className="inline-flex items-center gap-1.5">
              <input
                aria-label={t("ingredients.storeGramsPerUnit")}
                className={cx(inputBase, "w-20 py-1")}
                inputMode="decimal"
                value={gramsPerUnit}
                onChange={(e) => setGramsPerUnit(e.target.value)}
              />
              <span className="text-tinta-soft">{t("ingredients.storeGramsPerUnit")}</span>
            </label>
          ) : (
            <label className="inline-flex items-center gap-1.5">
              <span className="text-tinta-soft">{t("ingredients.storeAmount")}</span>
              <input aria-label={t("ingredients.storeAmount")} className={cx(inputBase, "w-20 py-1")} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <span className="text-tinta-soft">{t(`unit.${unit}`)}</span>
            </label>
          )}
          <Button onClick={link} disabled={!valid}>
            {t("ingredients.storeLink")}
          </Button>
        </div>
      )}
    </div>
  );
}
