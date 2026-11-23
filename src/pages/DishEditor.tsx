import { useState } from "react";
import { parseMoney } from "../../shared/format";
import { nameKey } from "../../shared/names";
import type { DishDetail, IngredientView, Restriction, Unit } from "../../shared/types";
import { IngredientStatuses } from "../components/IngredientStatuses";
import { Badge, Button, Card, ErrorText, Field, Loaded, Page, Stars } from "../components/ui";
import { inputClass } from "../components/styles";
import { api, useApi } from "../lib/api";
import { useApp } from "../lib/app-context";
import { useI18n } from "../i18n/context";

interface Line {
  name: string;
  quantity: string;
  unit: Unit;
  price: string;
}

interface Form {
  name: string;
  notes: string;
  portions: string;
  repeatIntervalDays: string;
  tags: string;
  lines: Line[];
}

const EMPTY_LINE: Line = { name: "", quantity: "", unit: "g", price: "" };
const EMPTY: Form = { name: "", notes: "", portions: "4", repeatIntervalDays: "14", tags: "", lines: [EMPTY_LINE] };

const toForm = (d: DishDetail): Form => ({
  name: d.name,
  notes: d.notes,
  portions: String(d.portions),
  repeatIntervalDays: String(d.repeatIntervalDays),
  tags: d.tags.join(", "),
  lines: d.ingredients.map((i) => ({ name: i.name, quantity: String(i.quantity), unit: i.unit, price: "" })),
});

const toBody = (f: Form) => ({
  name: f.name,
  notes: f.notes,
  portions: Number(f.portions),
  repeatIntervalDays: Number(f.repeatIntervalDays),
  tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean),
  ingredients: f.lines.filter((l) => l.name.trim()).map((l) => ({ name: l.name, quantity: Number(l.quantity), unit: l.unit, priceCents: parseMoney(l.price) })),
});

export function DishEditor({ id }: { id: number | "new" }) {
  const dish = useApi<{ dish: DishDetail }>(id === "new" ? null : `/api/dishes/${id}`);
  const ingredients = useApi<{ ingredients: IngredientView[] }>("/api/ingredients");
  const restrictions = useApi<{ restrictions: Restriction[] }>("/api/restrictions");
  const loaded = id === "new" ? {} : dish.data;
  return (
    <Loaded
      data={loaded && ingredients.data && restrictions.data ? { dish: dish.data?.dish, ...ingredients.data, ...restrictions.data } : undefined}
      error={dish.error ?? ingredients.error ?? restrictions.error}
    >
      {(data) => <DishForm key={data.dish?.id ?? "new"} dish={data.dish} known={data.ingredients} restrictions={data.restrictions} reload={dish.reload} />}
    </Loaded>
  );
}

function DishForm({ dish, known, restrictions, reload }: { dish?: DishDetail; known: IngredientView[]; restrictions: Restriction[]; reload: () => void }) {
  const { navigate, refreshMe } = useApp();
  const { t, day, money } = useI18n();
  const [form, setForm] = useState<Form>(dish ? toForm(dish) : EMPTY);
  const [failure, setFailure] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const setLine = (index: number, patch: Partial<Line>) => set({ lines: form.lines.map((l, i) => (i === index ? { ...l, ...patch } : l)) });
  const knownByKey = new Map(known.map((k) => [nameKey(k.name), k]));

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setFailure(undefined);
    try {
      await action();
      refreshMe();
    } catch (e) {
      setFailure(e);
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    run(async () => {
      if (dish) {
        await api.put(`/api/dishes/${dish.id}`, toBody(form));
        reload();
      } else {
        const { id } = await api.post<{ id: number }>("/api/dishes", toBody(form));
        navigate({ page: "dish", id });
      }
    });
  const action = (path: string) =>
    run(async () => {
      await api.post(`/api/dishes/${dish!.id}/${path}`);
      reload();
    });

  return (
    <Page
      title={dish ? dish.name : t("dishes.new")}
      actions={
        dish && (
          <>
            <Badge tone={dish.status === "validated" ? "azeite" : dish.status === "pending" ? "cobalto" : "neutral"}>{t(`dishStatus.${dish.status}`)}</Badge>
            {dish.status === "pending" && <Button disabled={busy} onClick={() => action("validate")}>{t("dish.validate")}</Button>}
            {dish.status === "archived" ? (
              <Button variant="secondary" disabled={busy} onClick={() => action("unarchive")}>{t("dish.unarchive")}</Button>
            ) : (
              <Button variant="danger" disabled={busy} onClick={() => action("archive")}>{t("dish.archive")}</Button>
            )}
          </>
        )
      }
    >
      {failure !== undefined && <ErrorText error={failure} />}

      <Card className="grid gap-3 sm:grid-cols-2">
        <Field label={t("dish.name")}>
          <input className={inputClass} value={form.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label={t("dish.tags")}>
          <input className={inputClass} value={form.tags} onChange={(e) => set({ tags: e.target.value })} />
        </Field>
        <Field label={t("dish.portionsField")}>
          <input className={inputClass} type="number" min={1} value={form.portions} onChange={(e) => set({ portions: e.target.value })} />
        </Field>
        <Field label={t("dish.interval")}>
          <input className={inputClass} type="number" min={0} value={form.repeatIntervalDays} onChange={(e) => set({ repeatIntervalDays: e.target.value })} />
        </Field>
        <div className="sm:col-span-2">
          <Field label={t("dish.notes")}>
            <textarea className={inputClass} rows={3} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
        </div>
      </Card>

      <Card className="space-y-2">
        <h2 className="font-medium">{t("nav.ingredients")}</h2>
        <datalist id="known-ingredients">
          {known.map((k) => (
            <option key={k.id} value={k.name} />
          ))}
        </datalist>
        {form.lines.map((line, index) => {
          const existing = knownByKey.get(nameKey(line.name));
          return (
            <div key={index} className="flex flex-wrap items-center gap-2">
              <input className={`${inputClass} min-w-32 flex-1`} list="known-ingredients" placeholder={t("dish.ingredient")} value={line.name} onChange={(e) => setLine(index, { name: e.target.value })} />
              <input className={`${inputClass} w-20`} inputMode="decimal" placeholder={t("dish.quantity")} value={line.quantity} onChange={(e) => setLine(index, { quantity: e.target.value })} />
              <select className={`${inputClass} w-16`} value={existing?.unit ?? line.unit} disabled={!!existing} onChange={(e) => setLine(index, { unit: e.target.value as Unit })}>
                {(["g", "ml", "un"] as const).map((u) => (
                  <option key={u} value={u}>
                    {t(`unit.${u}`)}
                  </option>
                ))}
              </select>
              {!existing && <input className={`${inputClass} w-24`} inputMode="decimal" placeholder={t("dish.newPrice")} value={line.price} onChange={(e) => setLine(index, { price: e.target.value })} />}
              <Button variant="secondary" aria-label={t("common.remove", { name: line.name })} onClick={() => set({ lines: form.lines.filter((_, i) => i !== index) })}>✕</Button>
            </div>
          );
        })}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => set({ lines: [...form.lines, EMPTY_LINE] })}>{t("dish.addIngredient")}</Button>
          <Button disabled={busy} onClick={save}>{t(dish ? "common.save" : "dish.create")}</Button>
        </div>
      </Card>

      {dish && dish.ingredients.length > 0 && (
        <Card className="space-y-2">
          <h2 className="font-medium">{t("dish.restrictions")}</h2>
          {dish.ingredients.map((i) => (
            <div key={i.ingredientId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>{i.name}</span>
              <IngredientStatuses ingredientId={i.ingredientId} statuses={i.statuses} restrictions={restrictions} onChange={reload} />
            </div>
          ))}
          <p className="text-xs text-tinta-soft">
            {t("dish.costPerPortion", { cost: money(dish.costPerPortionCents) })}
            {dish.missingPrice && ` ${t("dish.someMissing")}`}
          </p>
        </Card>
      )}

      {dish && dish.feedback.length > 0 && (
        <Card className="space-y-1">
          <h2 className="font-medium">{t("dish.feedback")}</h2>
          {dish.feedback.map((f) => (
            <p key={`${f.cookingId}-${f.personId}`} className="text-sm">
              <span className="text-tinta-soft">{day(f.date)}</span> {f.person} <Stars value={f.rating} /> {f.comment}
            </p>
          ))}
        </Card>
      )}
    </Page>
  );
}
