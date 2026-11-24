import { useState } from "react";
import { AISLES, type Aisle } from "../../shared/aisles";
import { parseMoney, priceUnit } from "../../shared/format";
import type { IngredientView, Unit } from "../../shared/types";
import { useI18n } from "../i18n/context";
import { api } from "../lib/api";
import { useApp } from "../lib/app-context";
import { inputBase, inputClass } from "./styles";
import { Button, ErrorText, Field } from "./ui";

const UNITS: Unit[] = ["g", "ml", "un"];

/** Name, unit, price, aisle and protein; restrictions are decided afterwards, like any new ingredient. */
export function NewIngredientForm({ initialName = "", onCreated, onCancel }: { initialName?: string; onCreated: (ingredient: IngredientView) => void; onCancel?: () => void }) {
  const { t } = useI18n();
  const { refreshMe } = useApp();
  const [name, setName] = useState(initialName);
  const [unit, setUnit] = useState<Unit>("g");
  const [price, setPrice] = useState("");
  const [aisle, setAisle] = useState<Aisle>("misc");
  const [protein, setProtein] = useState(false);
  const [each, setEach] = useState("");
  const [failure, setFailure] = useState<unknown>();
  const [busy, setBusy] = useState(false);

  const proteinGrams = !protein ? null : unit === "un" ? Number(each) : 1;
  const proteinValid = proteinGrams === null || (Number.isFinite(proteinGrams) && proteinGrams > 0);

  const create = async () => {
    setBusy(true);
    try {
      const priceCents = parseMoney(price);
      const { id } = await api.post<{ id: number }>("/api/ingredients", { name, unit, aisle, priceCents, proteinGrams, statuses: {} });
      refreshMe();
      onCreated({ id, name: name.trim(), unit, aisle, priceCents, priceSource: "estimated", priceUpdatedAt: null, proteinGrams, statuses: {} });
    } catch (error) {
      setFailure(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="animate-expand space-y-3 rounded-xl border border-linha bg-papel/60 p-3">
      <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_1.4fr]">
        <Field label={t("dish.name")}>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoFocus={!initialName} />
        </Field>
        <Field label={t("ingredients.unit")}>
          <select className={inputClass} value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {t(`unit.${u}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={`${t("ingredients.price")} (${priceUnit(unit)})`}>
          <input className={inputClass} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <Field label={t("ingredients.aisle")}>
          <select className={inputClass} value={aisle} onChange={(e) => setAisle(e.target.value as Aisle)}>
            {AISLES.map((a) => (
              <option key={a} value={a}>
                {t(`aisle.${a}`)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm" title={t("ingredients.proteinHint")}>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" className="size-4 accent-mar" checked={protein} onChange={(e) => setProtein(e.target.checked)} />
          {t("ingredients.protein")}
        </label>
        {protein && unit === "un" && (
          <span className="inline-flex items-center gap-2">
            <input aria-label={t("ingredients.proteinEach")} className={`${inputBase} w-16`} inputMode="decimal" value={each} onChange={(e) => setEach(e.target.value)} />
            <span className="text-tinta-soft">{t("ingredients.proteinEach")}</span>
          </span>
        )}
      </div>
      {failure !== undefined && <ErrorText error={failure} />}
      <div className="flex gap-2">
        <Button disabled={busy || !name.trim() || (price.trim() !== "" && parseMoney(price) === null) || !proteinValid} onClick={create}>
          {t("dish.create")}
        </Button>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            {t("common.close")}
          </Button>
        )}
      </div>
    </div>
  );
}
