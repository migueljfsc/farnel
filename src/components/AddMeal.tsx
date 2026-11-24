import { useEffect, useRef, useState } from "react";
import { nameKey } from "../../shared/names";
import type { CookingView, Meal, MealOption } from "../../shared/types";
import { useI18n } from "../i18n/context";
import { api, useApi } from "../lib/api";
import { freeMealsAfter } from "../lib/board";
import { errorMessage } from "../lib/errors";
import { useToast } from "../lib/toast";
import { CloseButton, Sheet } from "./Sheet";
import { cx, inputClass } from "./styles";
import { Button, Loaded } from "./ui";

const LEFTOVER_CHOICES = 4;

/**
 * Picks a dish for one free meal: what every eater can have, cheapest first, the recently eaten
 * apart. When the recipe makes more than one meal's worth, the next free meals can take the rest.
 */
export function AddMeal({
  weekStart,
  cookings,
  meal,
  onAdded,
  onClose,
}: {
  weekStart: string;
  cookings: CookingView[];
  meal: Meal;
  onAdded: () => void;
  onClose: () => void;
}) {
  const { t, tn, day, money } = useI18n();
  const toast = useToast();
  const { data, error } = useApi<{ eaters: number; dishes: MealOption[] }>(`/api/weeks/${weekStart}/options?date=${meal.date}`);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<MealOption | null>(null);
  const [extra, setExtra] = useState<Meal[]>([]);
  const [busy, setBusy] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => search.current?.focus(), []);

  const label = (m: Meal) => `${day(m.date)} ${t(`slot.${m.slot}`)}`;
  const spare = picked && data ? Math.max(0, Math.floor(picked.portions / data.eaters) - 1) : 0;
  const free = freeMealsAfter(cookings, weekStart, meal).slice(0, LEFTOVER_CHOICES);
  const has = (m: Meal) => extra.some((e) => e.date === m.date && e.slot === m.slot);
  const toggle = (m: Meal) => setExtra(has(m) ? extra.filter((e) => !(e.date === m.date && e.slot === m.slot)) : [...extra, m]);

  const add = async () => {
    if (!picked) return;
    setBusy(true);
    try {
      const { id } = await api.post<{ id: number }>(`/api/weeks/${weekStart}/cookings`, { dishId: picked.id, meals: [meal, ...extra] });
      onAdded();
      onClose();
      toast({
        message: t("toast.added", { dish: picked.name }),
        action: {
          label: t("common.undo"),
          run: async () => {
            await api.delete(`/api/cookings/${id}`);
            onAdded();
          },
        },
      });
    } catch (e) {
      toast({ message: errorMessage(t, e), tone: "error" });
      setBusy(false);
    }
  };

  const option = (d: MealOption) => (
    <li key={d.id}>
      <button
        type="button"
        aria-pressed={picked?.id === d.id}
        onClick={() => {
          setPicked(d);
          setExtra([]);
        }}
        className={cx(
          "flex w-full flex-wrap items-baseline justify-between gap-x-3 rounded-[3px] border-2 px-3 py-2 text-left transition",
          picked?.id === d.id ? "border-mar bg-mar-soft" : "border-transparent hover:bg-papel",
        )}
      >
        <span className="font-semibold">{d.name}</span>
        <span className="text-xs text-tinta-soft">
          {t("add.meta", { cost: money(d.costPerPortionCents), portions: tn("dish.portions", d.portions) })}
          {d.lastCooked && ` · ${t("add.last", { day: day(d.lastCooked) })}`}
        </span>
      </button>
    </li>
  );

  return (
    <Sheet labelledBy="add-meal" onClose={onClose}>
      <div className="flex items-center justify-between gap-2">
        <h2 id="add-meal" className="display text-xl">
          {label(meal)}
        </h2>
        <CloseButton onClose={onClose} />
      </div>
      <input ref={search} className={inputClass} placeholder={t("add.search")} value={query} onChange={(e) => setQuery(e.target.value)} />
      <Loaded data={data} error={error}>
        {({ dishes }) => {
          const shown = dishes.filter((d) => nameKey(d.name).includes(nameKey(query)));
          const fresh = shown.filter((d) => !d.tooSoon);
          const recent = shown.filter((d) => d.tooSoon);
          return shown.length === 0 ? (
            <p className="text-sm text-tinta-soft">{t("add.none")}</p>
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto">
              <ul className="space-y-0.5">{fresh.map(option)}</ul>
              {recent.length > 0 && (
                <div className="space-y-1">
                  <p className="px-3 text-xs font-semibold text-tinta-soft">
                    {t("add.recent")} <span className="font-normal">· {t("add.recentNote")}</span>
                  </p>
                  <ul className="space-y-0.5 opacity-75">{recent.map(option)}</ul>
                </div>
              )}
            </div>
          );
        }}
      </Loaded>
      {picked && spare > 0 && free.length > 0 && (
        <div className="animate-expand space-y-1.5">
          <p className="text-sm font-medium text-tinta-soft">{t("add.leftovers")}</p>
          <div className="flex flex-wrap gap-1.5">
            {free.map((m) => (
              <button
                key={`${m.date}:${m.slot}`}
                type="button"
                aria-pressed={has(m)}
                disabled={!has(m) && extra.length >= spare}
                onClick={() => toggle(m)}
                className={cx(
                  "rounded-[3px] px-3 py-1 text-sm font-semibold transition disabled:opacity-40",
                  has(m) ? "bg-mar text-on-mar" : "ring-1 ring-linha hover:bg-mar-soft",
                )}
              >
                {label(m)}
              </button>
            ))}
          </div>
        </div>
      )}
      <Button disabled={!picked || busy} onClick={add}>
        {picked ? t("add.submit", { dish: picked.name }) : t("add.choose")}
      </Button>
    </Sheet>
  );
}
