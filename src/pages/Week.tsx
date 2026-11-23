import { Fragment, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { APP_NAME } from "../../shared/app";
import { addDays, todayLisbon, weekStartOf } from "../../shared/time";
import type { CookingView, DishSummary, Meal, PersonView, PlanView, ShoppingList, Slot } from "../../shared/types";
import { buttonClass, cx, inputClass } from "../components/styles";
import { Button, Link, Loaded } from "../components/ui";
import { WeekCalendar } from "../components/WeekCalendar";
import { useI18n } from "../i18n/context";
import { api, useApi } from "../lib/api";
import { useApp } from "../lib/app-context";
import { SLOTS, segments } from "../lib/board";
import { AddMeal } from "../components/AddMeal";
import { CloseButton, Sheet } from "../components/Sheet";
import { byAisle, shoppingText } from "../lib/shopping";
import { claudeLinks, planPrompt } from "../lib/claude";
import { errorMessage } from "../lib/errors";
import { useToast } from "../lib/toast";

const DAYS = 7;
const SWIPE_PX = 70;

/** The week last shown, so the next one slides in from the side it lies on. */
let lastWeek: string | undefined;

export function Week({ weekStart }: { weekStart?: string }) {
  const { navigate } = useApp();
  const { t } = useI18n();
  const thisWeek = weekStartOf(todayLisbon(new Date()));
  const week = weekStart ?? thisWeek;
  const [direction] = useState(() => {
    const from = lastWeek;
    lastWeek = week;
    return from && week < from ? "previous" : from && week > from ? "next" : null;
  });
  const { data, error, reload } = useApi<{ plan: PlanView | null; shopping: ShoppingList }>(`/api/weeks/${week}`);
  const open = useCallback((weekStart: string) => navigate({ page: "week", weekStart }), [navigate]);
  const go = useCallback((days: number) => open(addDays(week, days)), [open, week]);
  const touch = useRef<number | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [role=dialog]")) return;
      if (e.key === "ArrowLeft") go(-DAYS);
      if (e.key === "ArrowRight") go(DAYS);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [go]);

  return (
    <section
      className={cx("space-y-6", direction === "next" && "animate-week-next", direction === "previous" && "animate-week-previous")}
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current === null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        touch.current = null;
        if (Math.abs(dx) > SWIPE_PX) go(dx < 0 ? DAYS : -DAYS);
      }}
    >
      <WeekCalendar week={week} onPick={open} />

      {week >= thisWeek && data && <PlanWithClaude weekStart={week} hasPlan={!!data.plan} onRefresh={reload} />}

      <Loaded data={data} error={error}>
        {({ plan, shopping }) =>
          plan ? (
            <>
              <Budget plan={plan} />
              <Board weekStart={week} cookings={plan.cookings} onChange={reload} />
              <Shopping list={shopping} plan={plan} />
            </>
          ) : addDays(week, DAYS - 1) >= todayLisbon(new Date()) ? (
            <>
              <p className="text-sm text-cafe-soft">{t("week.emptyFuture")}</p>
              <Board weekStart={week} cookings={[]} onChange={reload} />
            </>
          ) : (
            <EmptyWeek />
          )
        }
      </Loaded>
    </section>
  );
}

// ---------------------------------------------------------------- budget

function Budget({ plan }: { plan: PlanView }) {
  const { t, money } = useI18n();
  const share = plan.budgetCents > 0 ? Math.min(plan.totalCents / plan.budgetCents, 1) : 1;
  return (
    <div className="space-y-2">
      <p className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-cafe-soft">
        <span>{t("week.summary", { people: plan.people.map((p) => p.name).join(", "), total: money(plan.totalCents), budget: money(plan.budgetCents) })}</span>
        {plan.overBudget && <span className="font-semibold text-rosa">{t("week.overBudget")}</span>}
      </p>
      <div className="h-2 overflow-hidden rounded-full bg-linha" role="presentation">
        <div className={cx("animate-bar h-full rounded-full", plan.overBudget ? "bg-rosa" : "bg-salva")} style={{ width: `${share * 100}%` }} />
      </div>
      {plan.notes && <p className="text-sm italic text-cafe-soft">{plan.notes}</p>}
    </div>
  );
}

// ----------------------------------------------------------------- board

/** Every cooking looks the same; rose stays for what needs attention. */
const COOKING = "border-salva bg-salva-soft";

function PotIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cx("size-4", className)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11h16v3a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6ZM2 11h2M20 11h2M9 7c0-1 1-1 1-2M14 7c0-1 1-1 1-2" />
    </svg>
  );
}

function Board({ weekStart, cookings, onChange }: { weekStart: string; cookings: CookingView[]; onChange: () => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [adding, setAdding] = useState<Meal | null>(null);
  const open = cookings.find((c) => c.id === selected);
  const close = useCallback(() => {
    setSelected(null);
    setAdding(null);
  }, []);
  const props: BoardProps = {
    weekStart,
    cookings,
    selected,
    adding,
    onSelect: (id) => {
      setAdding(null);
      setSelected(id === selected ? null : id);
    },
    onAdd: (meal) => {
      setSelected(null);
      setAdding(meal);
    },
  };
  return (
    <div className="space-y-3">
      <MealGrid {...props} />
      <DayList {...props} />
      {open && <TinDetail key={open.id} weekStart={weekStart} cooking={open} onChange={onChange} onClose={close} />}
      {adding && <AddMeal key={`${adding.date}:${adding.slot}`} weekStart={weekStart} cookings={cookings} meal={adding} onAdded={onChange} onClose={close} />}
    </div>
  );
}

interface BoardProps {
  weekStart: string;
  cookings: CookingView[];
  selected: number | null;
  adding: Meal | null;
  onSelect: (id: number) => void;
  onAdd: (meal: Meal) => void;
}

const isMeal = (meal: Meal | null, date: string, slot: Slot) => meal?.date === date && meal.slot === slot;
const feeding = (cookings: CookingView[], date: string, slot: Slot) => cookings.find((c) => c.meals.some((m) => m.date === date && m.slot === slot));

/** A meal no cooking feeds: "+" from today on, a dash before. */
function FreeMeal({ date, slot, today, adding, onAdd, className, style }: { date: string; slot: Slot; today: string; adding: Meal | null; onAdd: (meal: Meal) => void; className: string; style?: CSSProperties }) {
  const { t, day } = useI18n();
  if (date < today)
    return (
      <span aria-hidden className={cx(className, "border-linha text-cafe-soft/40")} style={style}>
        —
      </span>
    );
  const active = isMeal(adding, date, slot);
  return (
    <button
      type="button"
      aria-label={t("board.add", { meal: `${day(date)} ${t(`slot.${slot}`)}` })}
      aria-expanded={active}
      onClick={() => onAdd({ date, slot })}
      className={cx(className, "text-xl transition", active ? "border-salva bg-salva-soft text-salva" : "border-linha text-cafe-soft/50 hover:border-salva hover:bg-salva-soft/60 hover:text-salva")}
      style={style}
    >
      +
    </button>
  );
}

/** Desktop: a row per meal, a column per day; a cooking covers exactly the meals it feeds. */
function MealGrid({ weekStart, cookings, selected, adding, onSelect, onAdd }: BoardProps) {
  const { t, day } = useI18n();
  const today = todayLisbon(new Date());
  const days = Array.from({ length: DAYS }, (_, i) => addDays(weekStart, i));
  return (
    <div className="hidden gap-1.5 sm:grid" style={{ gridTemplateColumns: "4.5rem repeat(7, minmax(0, 1fr))" }}>
      <span />
      {days.map((date) => {
        const [weekday, numbers] = day(date).split(" ");
        const cooked = cookings.filter((c) => c.cookDate === date && c.status !== "skipped");
        return (
          <div key={date} className={cx("flex items-center gap-1.5 border-b-2 pb-1", date === today ? "border-salva text-salva" : "border-linha text-cafe-soft")}>
            <span className="flex items-baseline gap-1">
              <span className="display text-2xl">{numbers.split("/")[0]}</span>
              <span className="text-xs font-medium">{weekday}</span>
            </span>
            <span className="flex gap-0.5">
              {cooked.map((c) => (
                <span key={c.id} title={`${t("board.cookDay")}: ${c.dish}`} className="grid size-5 place-items-center rounded-full bg-salva text-louca">
                  <PotIcon className="size-3.5" />
                </span>
              ))}
            </span>
          </div>
        );
      })}
      {SLOTS.map((slot, row) => (
        <Fragment key={slot}>
          <span className="self-center text-sm font-semibold text-cafe-soft" style={{ gridRow: row + 2, gridColumn: 1 }}>
            {t(`slot.${slot}`)}
          </span>
          {days.map((date, i) =>
            feeding(cookings, date, slot) ? null : (
              <FreeMeal
                key={date}
                date={date}
                slot={slot}
                today={today}
                adding={adding}
                onAdd={onAdd}
                className="grid min-h-20 place-items-center rounded-xl border-2 border-dashed"
                style={{ gridRow: row + 2, gridColumn: i + 2 }}
              />
            ),
          )}
          {segments(cookings, weekStart, slot).map((segment) => {
            const cooking = cookings[segment.cooking];
            return (
              <MealBlock
                key={`${cooking.id}-${slot}-${segment.start}`}
                cooking={cooking}
                selected={cooking.id === selected}
                onSelect={() => onSelect(cooking.id)}
                continued={!segment.first}
                style={{ gridRow: row + 2, gridColumn: `${segment.start + 1} / ${segment.end + 1}`, "--i": segment.cooking } as CSSProperties}
              />
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}

function MealBlock({
  cooking,
  selected,
  onSelect,
  continued,
  style,
}: {
  cooking: CookingView;
  selected: boolean;
  onSelect: () => void;
  continued: boolean;
  style: CSSProperties;
}) {
  const { t, tn, money } = useI18n();
  const replacedBy = cooking.replacedBy && ("dish" in cooking.replacedBy ? cooking.replacedBy.dish : cooking.replacedBy.text);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-expanded={selected}
      style={style}
      className={cx(
        "animate-tin relative z-10 flex min-h-20 flex-col justify-between gap-1 rounded-xl border-2 p-2.5 text-left transition",
        COOKING,
        cooking.status === "skipped" && "border-dashed opacity-50",
        selected ? "ring-4 ring-salva/25" : "hover:-translate-y-0.5",
      )}
    >
      {replacedBy && (
        <span title={t("cooking.replacedBy", { dish: replacedBy })} className="absolute -right-1.5 -top-2.5 max-w-[85%] truncate rounded-full bg-rosa px-2 py-0.5 text-[11px] font-bold text-louca shadow-sm">
          {t("cooking.replacedBy", { dish: replacedBy })}
        </span>
      )}
      <span className={cx("text-sm font-semibold leading-tight", cooking.status === "skipped" && "line-through")}>
        {continued ? `↳ ${cooking.dish}` : cooking.dish}
        {cooking.status === "done" && <span className="ml-1 text-salva">✓</span>}
      </span>
      {!continued && (
        <span className="flex items-center justify-between gap-2 text-[11px] text-cafe-soft">
          <span>{tn("dish.portions", cooking.portions)}</span>
          <span className="tabular-nums">{money(cooking.costCents)}</span>
        </span>
      )}
    </button>
  );
}

/** Phones: day by day, each meal a chip in its cooking's colour. */
function DayList({ weekStart, cookings, selected, adding, onSelect, onAdd }: BoardProps) {
  const { t, day } = useI18n();
  const today = todayLisbon(new Date());
  const days = Array.from({ length: DAYS }, (_, i) => addDays(weekStart, i));
  return (
    <ol className="space-y-2 sm:hidden">
      {days.map((date) => (
        <li key={date} className={cx("rounded-2xl border bg-louca p-3", date === today ? "border-salva" : "border-linha")}>
          <p className={cx("mb-2 flex items-center gap-2 text-sm font-semibold", date === today ? "text-salva" : "text-cafe-soft")}>
            {day(date)}
            {cookings.map((c) =>
              c.cookDate === date && c.status !== "skipped" ? (
                <span key={c.id} className="grid size-5 place-items-center rounded-full bg-salva text-louca" title={`${t("board.cookDay")}: ${c.dish}`}>
                  <PotIcon className="size-3.5" />
                </span>
              ) : null,
            )}
          </p>
          <div className="grid gap-1.5">
            {SLOTS.map((slot) => {
              const cooking = feeding(cookings, date, slot);
              return (
                <div key={slot} className="flex items-center gap-2 text-sm">
                  <span className="w-16 shrink-0 text-xs text-cafe-soft">{t(`slot.${slot}`)}</span>
                  {cooking ? (
                    <button
                      type="button"
                      onClick={() => onSelect(cooking.id)}
                      aria-expanded={cooking.id === selected}
                      className={cx("flex-1 truncate rounded-lg border-2 px-2.5 py-1.5 text-left font-semibold", COOKING, cooking.status === "skipped" && "border-dashed line-through opacity-50")}
                    >
                      {cooking.dish}
                    </button>
                  ) : (
                    <FreeMeal date={date} slot={slot} today={today} adding={adding} onAdd={onAdd} className="flex-1 rounded-lg border-2 border-dashed px-2.5 py-1 text-left" />
                  )}
                </div>
              );
            })}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** The status change that puts a cooking back the way it is now, for Undo. */
function currentState(cooking: CookingView): Record<string, unknown> {
  if (cooking.status === "skipped") return { status: "skipped" };
  if (cooking.status === "replaced" && cooking.replacedBy) return { status: "replaced", ...cooking.replacedBy };
  return { status: "planned" };
}

function TinDetail({ weekStart, cooking, onChange, onClose }: { weekStart: string; cooking: CookingView; onChange: () => void; onClose: () => void }) {
  const { t, tn, day, money } = useI18n();
  const toast = useToast();
  const [replacing, setReplacing] = useState(false);
  const heading = useRef<HTMLSpanElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const removable = cooking.status === "planned" && cooking.cookDate >= todayLisbon(new Date());
  const remove = async () => {
    try {
      await api.delete(`/api/cookings/${cooking.id}`);
      onClose();
      onChange();
      toast({
        message: t("toast.removed", { dish: cooking.dish }),
        action: {
          label: t("common.undo"),
          run: async () => {
            await api.post(`/api/weeks/${weekStart}/cookings`, { dishId: cooking.dishId, meals: cooking.meals });
            onChange();
          },
        },
      });
    } catch (error) {
      toast({ message: errorMessage(t, error), tone: "error" });
    }
  };

  const change = async (body: Record<string, unknown>, message: "toast.skipped" | "toast.replaced" | "toast.restored") => {
    const before = currentState(cooking);
    try {
      await api.put(`/api/cookings/${cooking.id}/status`, body);
      setReplacing(false);
      onChange();
      toast({
        message: t(message, { dish: cooking.dish }),
        action: {
          label: t("common.undo"),
          run: async () => {
            await api.put(`/api/cookings/${cooking.id}/status`, before);
            onChange();
          },
        },
      });
    } catch (error) {
      toast({ message: errorMessage(t, error), tone: "error" });
    }
  };
  const undoable = cooking.status === "skipped" || cooking.status === "replaced";

  return (
    <Sheet labelledBy={`tin-${cooking.id}`} onClose={onClose}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <Link to={{ page: "dish", id: cooking.dishId }} className="display text-xl">
            <span id={`tin-${cooking.id}`} ref={heading} tabIndex={-1}>
              {cooking.dish}
            </span>
          </Link>
          <span className="flex items-center gap-2 text-sm font-medium text-cafe-soft">
            {t(`status.${cooking.status}`)}
            <CloseButton onClose={onClose} />
          </span>
        </div>
        <div className="space-y-0.5 text-sm text-cafe-soft">
          <p>{t("cooking.cook", { day: day(cooking.cookDate), portions: tn("dish.portions", cooking.portions), cost: money(cooking.costCents) })}</p>
          <p>{t("cooking.eat", { meals: cooking.meals.map((m) => `${day(m.date)} ${t(`slot.${m.slot}`)}`).join(", ") })}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {undoable ? (
            <Button variant="secondary" onClick={() => change({ status: "planned" }, "toast.restored")}>
              {t("common.undo")}
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => change({ status: "skipped" }, "toast.skipped")}>
                {t("cooking.skip")}
              </Button>
              <Button variant="secondary" aria-expanded={replacing} onClick={() => setReplacing(!replacing)}>
                {t("cooking.replace")}
              </Button>
              {removable && (
                <Button variant="danger" onClick={remove}>
                  {t("cooking.remove")}
                </Button>
              )}
            </>
          )}
        </div>
        {replacing && <ReplaceForm onReplace={(by) => change({ status: "replaced", ...by }, "toast.replaced")} />}
    </Sheet>
  );
}

function ReplaceForm({ onReplace }: { onReplace: (by: { dishId: number } | { text: string }) => void }) {
  const { t } = useI18n();
  const { data } = useApi<{ dishes: DishSummary[] }>("/api/dishes?status=validated");
  const [text, setText] = useState("");
  return (
    <div className="animate-expand flex flex-wrap gap-2">
      <select className={cx(inputClass, "sm:max-w-64")} defaultValue="" onChange={(e) => e.target.value && onReplace({ dishId: Number(e.target.value) })}>
        <option value="">{t("cooking.replacePick")}</option>
        {data?.dishes.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
      <input className={cx(inputClass, "sm:max-w-64")} placeholder={t("cooking.replaceOther")} value={text} onChange={(e) => setText(e.target.value)} />
      <Button disabled={!text.trim()} onClick={() => onReplace({ text })}>
        {t("common.save")}
      </Button>
    </div>
  );
}

function EmptyWeek() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-linha px-6 py-12 text-center">
      <span className="h-10 w-16 rounded-b-2xl rounded-t-md border-[3px] border-salva/40" aria-hidden />
      <p className="text-cafe-soft">{t("week.empty")}</p>
    </div>
  );
}

// ------------------------------------------------------ plan with Claude

function PlanWithClaude({ weekStart, hasPlan, onRefresh }: { weekStart: string; hasPlan: boolean; onRefresh: () => void }) {
  const i18n = useI18n();
  const { t } = i18n;
  const { data } = useApi<{ people: PersonView[] }>("/api/people");
  const people = data?.people ?? [];
  const [notes, setNotes] = useState("");
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(!hasPlan);
  const eating = people.filter((p) => !skipped.has(p.id));
  const toggle = (id: number) => setSkipped((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])));
  const prompt = planPrompt({ weekStart, notes, eaters: eating.length === people.length ? null : eating.map((p) => p.name) }, i18n);
  const links = claudeLinks(prompt);
  const copy = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
  };

  if (!open) {
    return (
      <Button variant="secondary" aria-expanded={false} onClick={() => setOpen(true)}>
        {t("week.plan.retitle")}
      </Button>
    );
  }

  return (
    <div className="animate-expand space-y-3 rounded-2xl bg-salva-soft p-4 sm:p-5">
      <h2 className="display text-xl text-salva">{t(hasPlan ? "week.plan.retitle" : "week.plan.title")}</h2>
      {people.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium text-cafe-soft">{t("week.plan.who")}</span>
          {people.map((p) => {
            const on = !skipped.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(p.id)}
                className={cx("rounded-full px-3 py-1 font-semibold transition", on ? "bg-salva text-louca" : "bg-louca text-cafe-soft ring-1 ring-linha")}
              >
                {p.name}
              </button>
            );
          })}
        </div>
      )}
      <label className="block space-y-1 text-sm">
        <span className="font-medium text-cafe-soft">{t("week.plan.notes")}</span>
        <input className={inputClass} placeholder={t("week.plan.notesHint")} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <div className={cx("flex flex-wrap gap-2", eating.length === 0 && "pointer-events-none opacity-40")}>
        <a className={buttonClass("primary")} href={links.app}>
          {t("week.plan.openApp")}
        </a>
        <a className={buttonClass("secondary")} href={links.web} target="_blank" rel="noreferrer">
          {t("week.plan.openWeb")}
        </a>
        <Button variant="secondary" onClick={copy}>
          {t(copied ? "week.plan.copied" : "week.plan.copy")}
        </Button>
        <Button variant="secondary" onClick={onRefresh}>
          {t("common.refresh")}
        </Button>
      </div>
      <p className="text-xs text-cafe-soft">{t("week.plan.help", { app: APP_NAME })}</p>
    </div>
  );
}

// -------------------------------------------------------------- shopping

/** Ticks live in this browser only, per week: a convenience while shopping, not shared state. */
function useTicks(weekStart: string): [Set<number>, (id: number) => void] {
  const key = `shopping:${weekStart}`;
  const [ticked, setTicked] = useState<Set<number>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(key) ?? "[]") as number[]);
    } catch {
      return new Set();
    }
  });
  const toggle = (id: number) => {
    const next = new Set(ticked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setTicked(next);
    try {
      localStorage.setItem(key, JSON.stringify([...next]));
    } catch {
      // Storage blocked: ticks last until the page closes.
    }
  };
  return [ticked, toggle];
}

function Shopping({ list, plan }: { list: ShoppingList; plan: PlanView }) {
  const { t, tn, day, money, quantity } = useI18n();
  const toast = useToast();
  const [ticked, toggle] = useTicks(plan.weekStart);
  if (list.items.length === 0) return null;
  const groups = byAisle(list.items);
  const bought = list.items.filter((i) => ticked.has(i.ingredientId)).length;

  const share = async () => {
    const heading = t("shopping.heading", { day: day(plan.weekStart) });
    const text = shoppingText(heading, groups, { aisle: (a) => t(`aisle.${a}`), quantity });
    try {
      if (navigator.share) await navigator.share({ title: heading, text });
      else {
        await navigator.clipboard.writeText(text);
        toast({ message: t("shopping.copied") });
      }
    } catch {
      // The person closed the share sheet.
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-linha bg-louca p-4 sm:p-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="display text-2xl">{t("shopping.title")}</h2>
          <p className="text-sm text-cafe-soft">
            {t("shopping.estimate", { total: money(list.totalCents), budget: money(plan.budgetCents) })}
            {list.missingPrices > 0 && <> · {tn("shopping.missing", list.missingPrices)}</>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold tabular-nums text-salva">{t("shopping.bought", { count: bought, total: list.items.length })}</span>
          <Button variant="secondary" onClick={share}>
            {t("shopping.share")}
          </Button>
        </div>
      </header>
      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {groups.map((group) => (
          <div key={group.aisle} className="space-y-1">
            <h3 className="text-sm font-semibold text-rosa">{t(`aisle.${group.aisle}`)}</h3>
            <ul>
              {group.items.map((i) => {
                const done = ticked.has(i.ingredientId);
                return (
                  <li key={i.ingredientId}>
                    <label className="flex cursor-pointer items-center gap-3 border-b border-linha py-2 text-sm">
                      <input type="checkbox" checked={done} onChange={() => toggle(i.ingredientId)} className="peer sr-only" />
                      <span
                        aria-hidden
                        className={cx(
                          "grid size-5 shrink-0 place-items-center rounded-full border-2 text-[11px] font-bold transition peer-focus-visible:ring-2 peer-focus-visible:ring-salva",
                          done ? "animate-pop border-salva bg-salva text-louca" : "border-linha",
                        )}
                      >
                        {done && "✓"}
                      </span>
                      <span className={cx("flex-1 transition", done && "text-cafe-soft line-through")}>{i.name}</span>
                      <span className="tabular-nums text-cafe-soft">{quantity(i.quantity, i.unit)}</span>
                      <span className="w-14 text-right tabular-nums text-cafe-soft">{i.costCents === null ? "–" : money(i.costCents)}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
