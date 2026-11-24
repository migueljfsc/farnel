import { useState } from "react";
import { hasProteinAndBase } from "../../shared/tags";
import type { DishDetail, IngredientView, Restriction, Settings } from "../../shared/types";
import { ContainsPicker } from "../components/ContainsPicker";
import { IngredientPicker } from "../components/IngredientPicker";
import { TagPicker } from "../components/TagPicker";
import { Badge, Button, Card, ErrorText, Field, Loaded, Page, Stars } from "../components/ui";
import { cx, inputBase, inputClass } from "../components/styles";
import { api, useApi } from "../lib/api";
import { useApp } from "../lib/app-context";
import { useI18n } from "../i18n/context";

interface Line {
  ingredientId: number | null;
  quantity: string;
}

interface Form {
  name: string;
  notes: string;
  portions: string;
  repeatIntervalDays: string;
  tags: string[];
  lines: Line[];
}

const EMPTY_LINE: Line = { ingredientId: null, quantity: "" };
const EMPTY: Form = { name: "", notes: "", portions: "4", repeatIntervalDays: "14", tags: [], lines: [EMPTY_LINE] };

const toForm = (d: DishDetail): Form => ({
  name: d.name,
  notes: d.notes,
  portions: String(d.portions),
  repeatIntervalDays: String(d.repeatIntervalDays),
  tags: d.tags,
  lines: d.ingredients.map((i) => ({ ingredientId: i.ingredientId, quantity: String(i.quantity) })),
});

/** Lines refer to existing ingredients only; the API matches them by name and unit. */
const toBody = (f: Form, known: Map<number, IngredientView>) => ({
  name: f.name,
  notes: f.notes,
  portions: Number(f.portions),
  repeatIntervalDays: Number(f.repeatIntervalDays),
  tags: f.tags,
  ingredients: f.lines.flatMap((l) => {
    const ingredient = l.ingredientId === null ? undefined : known.get(l.ingredientId);
    return ingredient ? [{ name: ingredient.name, quantity: Number(l.quantity), unit: ingredient.unit }] : [];
  }),
});

export function DishEditor({ id }: { id: number | "new" }) {
  const dish = useApi<{ dish: DishDetail }>(id === "new" ? null : `/api/dishes/${id}`);
  const ingredients = useApi<{ ingredients: IngredientView[] }>("/api/ingredients");
  const restrictions = useApi<{ restrictions: Restriction[] }>("/api/restrictions");
  const settings = useApi<{ settings: Settings }>("/api/settings");
  const loaded = id === "new" ? {} : dish.data;
  return (
    <Loaded
      data={loaded && ingredients.data && restrictions.data && settings.data ? { dish: dish.data?.dish, ...ingredients.data, ...restrictions.data, ...settings.data } : undefined}
      error={dish.error ?? ingredients.error ?? restrictions.error ?? settings.error}
    >
      {(data) => (
        <DishForm
          key={data.dish?.id ?? "new"}
          dish={data.dish}
          known={data.ingredients}
          restrictions={data.restrictions}
          minProteinGrams={data.settings.minProteinGrams}
          reload={dish.reload}
        />
      )}
    </Loaded>
  );
}

/** Raw protein weight in one portion of the form as it stands, rounded down like the server's. */
function proteinPerPortion(form: Form, byId: Map<number, IngredientView>): number {
  const portions = Number(form.portions);
  if (!(portions > 0)) return 0;
  const total = form.lines.reduce((sum, l) => {
    const grams = l.ingredientId === null ? null : (byId.get(l.ingredientId)?.proteinGrams ?? null);
    const quantity = Number(l.quantity);
    return grams === null || !Number.isFinite(quantity) ? sum : sum + quantity * grams;
  }, 0);
  return Math.floor(total / portions);
}

function DishForm({
  dish,
  known,
  restrictions,
  minProteinGrams,
  reload,
}: {
  dish?: DishDetail;
  known: IngredientView[];
  restrictions: Restriction[];
  minProteinGrams: number;
  reload: () => void;
}) {
  const { navigate, refreshMe } = useApp();
  const { t, day, money } = useI18n();
  const [saved, setSaved] = useState<Form>(dish ? toForm(dish) : EMPTY);
  const [form, setForm] = useState<Form>(saved);
  /** Bumped on discard, so pickers holding their own text start over. */
  const [revision, setRevision] = useState(0);
  const [failure, setFailure] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const setLine = (index: number, patch: Partial<Line>) => set({ lines: form.lines.map((l, i) => (i === index ? { ...l, ...patch } : l)) });
  const [ingredients, setIngredients] = useState(known);
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const tagsOk = hasProteinAndBase(form.tags);
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const protein = proteinPerPortion(form, byId);
  const lowProtein = protein < minProteinGrams;
  const missing = !form.name.trim() ? t("dish.missingName") : !tagsOk ? t("tags.missing") : null;

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
        await api.put(`/api/dishes/${dish.id}`, toBody(form, byId));
        setSaved(form);
        reload();
      } else {
        const { id } = await api.post<{ id: number }>("/api/dishes", toBody(form, byId));
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
            <Badge tone={dish.status === "validated" ? "salva" : dish.status === "pending" ? "rosa" : "neutral"}>{t(`dishStatus.${dish.status}`)}</Badge>
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
        <Field label={t("dish.portionsField")}>
          <input className={inputClass} type="number" min={1} value={form.portions} onChange={(e) => set({ portions: e.target.value })} />
        </Field>
        <Field label={t("dish.interval")}>
          <input className={inputClass} type="number" min={0} value={form.repeatIntervalDays} onChange={(e) => set({ repeatIntervalDays: e.target.value })} />
        </Field>
        <div className="sm:col-span-2">
          <TagPicker key={revision} tags={form.tags} onChange={(tags) => set({ tags })} />
        </div>
        <div className="sm:col-span-2">
          <Field label={t("dish.notes")}>
            <textarea className={inputClass} rows={3} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
        </div>
      </Card>

      <Card className="space-y-2">
        <h2 className="font-medium">{t("nav.ingredients")}</h2>
        {form.lines.map((line, index) => {
          const ingredient = line.ingredientId === null ? undefined : byId.get(line.ingredientId);
          return (
            <div key={index} className="flex flex-wrap items-start gap-2">
              <IngredientPicker
                key={`${revision}-${index}`}
                known={ingredients}
                value={ingredient}
                onPick={(picked) => setLine(index, { ingredientId: picked.id })}
                onCreated={(created) => {
                  setIngredients((all) => [...all, created]);
                  setLine(index, { ingredientId: created.id });
                }}
              />
              <span className="flex items-center gap-1.5">
                <input className={`${inputBase} w-24`} inputMode="decimal" placeholder={t("dish.quantity")} value={line.quantity} onChange={(e) => setLine(index, { quantity: e.target.value })} />
                <span className="w-6 text-sm text-cafe-soft">{ingredient && t(`unit.${ingredient.unit}`)}</span>
              </span>
              <Button variant="secondary" aria-label={t("common.remove", { name: ingredient?.name ?? "" })} onClick={() => set({ lines: form.lines.filter((_, i) => i !== index) })}>
                ✕
              </Button>
            </div>
          );
        })}
        <Button variant="secondary" onClick={() => set({ lines: [...form.lines, EMPTY_LINE] })}>{t("dish.addIngredient")}</Button>
        <p role="status" className={cx("text-sm", lowProtein ? "font-semibold text-rosa" : "text-cafe-soft")}>
          {t("dish.protein", { grams: protein, min: minProteinGrams })}
          {lowProtein && <span className="block font-normal">{t("dish.lowProtein")}</span>}
        </p>
      </Card>

      {(dirty || !dish) && (
        <div className="animate-toast sticky bottom-20 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-linha bg-louca/95 px-4 py-3 shadow-tin backdrop-blur sm:bottom-4">
          <span className={cx("mr-auto text-sm font-semibold", missing ? "text-rosa" : "text-cafe")}>{missing ?? (dirty ? t("common.unsaved") : "")}</span>
          {dish && (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setForm(saved);
                setRevision((r) => r + 1);
              }}
            >
              {t("common.discard")}
            </Button>
          )}
          <Button disabled={busy || missing !== null || (dish !== undefined && !dirty)} onClick={save}>
            {t(dish ? "common.save" : "dish.create")}
          </Button>
        </div>
      )}

      {dish && dish.ingredients.length > 0 && (
        <Card className="space-y-2">
          <h2 className="font-medium">{t("dish.restrictions")}</h2>
          {dish.ingredients.map((i) => (
            <div key={i.ingredientId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>{i.name}</span>
              <ContainsPicker ingredientId={i.ingredientId} statuses={i.statuses} restrictions={restrictions} onChange={reload} />
            </div>
          ))}
          <p className="text-xs text-cafe-soft">
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
              <span className="text-cafe-soft">{day(f.date)}</span> {f.person} <Stars value={f.rating} /> {f.comment}
            </p>
          ))}
        </Card>
      )}
    </Page>
  );
}
