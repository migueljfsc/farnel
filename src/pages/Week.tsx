import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { APP_NAME } from "../../shared/app";
import { addDays, daysBetween, todayLisbon, weekStartOf } from "../../shared/time";
import type { CookingView, DishSummary, PersonView, PlanView, ShoppingList } from "../../shared/types";
import { buttonClass, cx, inputClass } from "../components/styles";
import { Button, Link, Loaded } from "../components/ui";
import { useI18n } from "../i18n/context";
import { api, useApi } from "../lib/api";
import { useApp } from "../lib/app-context";
import { claudeLinks, planPrompt } from "../lib/claude";
import { errorMessage } from "../lib/errors";
import { useToast } from "../lib/toast";

const DAYS = 7;
const SWIPE_PX = 70;

/** The week last shown, so the next one slides in from the side it lies on. */
let lastWeek: string | undefined;

export function Week({ weekStart }: { weekStart?: string }) {
  const { navigate } = useApp();
  const { t, day } = useI18n();
  const thisWeek = weekStartOf(todayLisbon(new Date()));
  const week = weekStart ?? thisWeek;
  const [direction] = useState(() => {
    const from = lastWeek;
    lastWeek = week;
    return from && week < from ? "previous" : from && week > from ? "next" : null;
  });
  const { data, error, reload } = useApi<{ plan: PlanView | null; shopping: ShoppingList }>(`/api/weeks/${week}`);
  const go = useCallback((days: number) => navigate({ page: "week", weekStart: addDays(week, days) }), [navigate, week]);
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
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="display text-4xl sm:text-5xl">{t("week.title", { day: day(week) })}</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => go(-DAYS)}>
            {t("week.previous")}
          </Button>
          <Button variant="secondary" onClick={() => go(DAYS)}>
            {t("week.next")}
          </Button>
        </div>
      </header>

      {week >= thisWeek && data && <PlanWithClaude weekStart={week} hasPlan={!!data.plan} onRefresh={reload} />}

      <Loaded data={data} error={error}>
        {({ plan, shopping }) =>
          plan ? (
            <>
              <Budget plan={plan} />
              <Board plan={plan} onChange={reload} />
              <Shopping list={shopping} />
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
      <p className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-terra-soft">
        <span>{t("week.summary", { people: plan.people.map((p) => p.name).join(", "), total: money(plan.totalCents), budget: money(plan.budgetCents) })}</span>
        {plan.overBudget && <span className="font-semibold text-tomate">{t("week.overBudget")}</span>}
      </p>
      <div className="h-2 overflow-hidden rounded-full bg-linha" role="presentation">
        <div className={cx("animate-bar h-full rounded-full", plan.overBudget ? "bg-tomate" : "bg-manjericao")} style={{ width: `${share * 100}%` }} />
      </div>
      {plan.notes && <p className="text-sm italic text-terra-soft">{plan.notes}</p>}
    </div>
  );
}

// ----------------------------------------------------------------- board

/** The days a cooking feeds, as a column span on the 7-day board (1-based, end exclusive). */
function span(cooking: CookingView, weekStart: string): { start: number; end: number; first: string; last: string } {
  const dates = cooking.meals.map((m) => m.date).sort();
  const first = dates[0] ?? cooking.cookDate;
  const last = dates[dates.length - 1] ?? cooking.cookDate;
  const start = Math.max(daysBetween(weekStart, first), 0) + 1;
  const end = Math.min(daysBetween(weekStart, last), DAYS - 1) + 2;
  return { start, end, first, last };
}

function Board({ plan, onChange }: { plan: PlanView; onChange: () => void }) {
  const { day } = useI18n();
  const [selected, setSelected] = useState<number | null>(null);
  const today = todayLisbon(new Date());
  const days = Array.from({ length: DAYS }, (_, i) => addDays(plan.weekStart, i));
  const open = plan.cookings.find((c) => c.id === selected);
  const close = useCallback(() => setSelected(null), []);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 [grid-auto-flow:dense] sm:grid-cols-7">
        {days.map((date) => {
          const [weekday, numbers] = day(date).split(" ");
          return (
            <div
              key={date}
              className={cx("hidden items-baseline gap-1.5 border-b-2 pb-1 sm:flex", date === today ? "border-manjericao text-manjericao" : "border-linha text-terra-soft")}
            >
              <span className="display text-2xl">{numbers.split("/")[0]}</span>
              <span className="text-xs font-medium">{weekday}</span>
            </div>
          );
        })}
        {plan.cookings.map((cooking, index) => (
          <Tin
            key={cooking.id}
            cooking={cooking}
            weekStart={plan.weekStart}
            index={index}
            selected={cooking.id === selected}
            onSelect={() => setSelected(cooking.id === selected ? null : cooking.id)}
          />
        ))}
      </div>
      {open && <TinDetail key={open.id} cooking={open} onChange={onChange} onClose={close} />}
    </div>
  );
}

const RIM: Record<CookingView["status"], string> = {
  planned: "border-manjericao",
  done: "border-acafrao",
  skipped: "border-dashed border-linha opacity-60",
  replaced: "border-manjericao/40",
};

function Tin({ cooking, weekStart, index, selected, onSelect }: { cooking: CookingView; weekStart: string; index: number; selected: boolean; onSelect: () => void }) {
  const { t, tn, day, money } = useI18n();
  const { start, end, first, last } = span(cooking, weekStart);
  const replacedBy = cooking.replacedBy && ("dish" in cooking.replacedBy ? cooking.replacedBy.dish : cooking.replacedBy.text);
  const style = { "--i": index, "--col": `${start} / ${end}` } as CSSProperties;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-expanded={selected}
      style={style}
      className={cx(
        "animate-tin relative flex min-h-28 flex-col justify-between gap-2 rounded-2xl border-[3px] bg-louca p-3 text-left transition sm:[grid-column:var(--col)]",
        RIM[cooking.status],
        selected ? "ring-4 ring-manjericao/25" : "hover:-translate-y-0.5",
      )}
    >
      {replacedBy && (
        <span
          title={t("cooking.replacedBy", { dish: replacedBy })}
          className="absolute -right-1.5 -top-2.5 max-w-[80%] truncate rounded-full bg-tomate px-2 py-0.5 text-[11px] font-bold text-louca shadow-sm"
        >
          {t("cooking.replacedBy", { dish: replacedBy })}
        </span>
      )}
      <span>
        <span className="block text-xs font-medium text-terra-soft sm:hidden">{first === last ? day(first) : `${day(first)} – ${day(last)}`}</span>
        <span className={cx("block font-semibold leading-tight", cooking.status === "skipped" && "line-through")}>{cooking.dish}</span>
        {cooking.meals.some((m) => m.slot === "dinner") && (
          <span className="mt-1 inline-block rounded-full bg-manjericao-soft px-2 py-0.5 text-[11px] font-semibold text-manjericao">{t("slot.dinner")}</span>
        )}
      </span>
      <span className="flex items-end justify-between gap-2">
        <span className="flex flex-wrap gap-1" aria-label={tn("dish.portions", cooking.portions)}>
          {Array.from({ length: cooking.portions }, (_, i) => (
            <span key={i} className={cx("size-2.5 rounded-full", cooking.status === "done" ? "bg-acafrao" : "bg-manjericao")} />
          ))}
        </span>
        <span className="text-xs tabular-nums text-terra-soft">{money(cooking.costCents)}</span>
      </span>
    </button>
  );
}

/** The status change that puts a cooking back the way it is now, for Undo. */
function currentState(cooking: CookingView): Record<string, unknown> {
  if (cooking.status === "skipped") return { status: "skipped" };
  if (cooking.status === "replaced" && cooking.replacedBy) return { status: "replaced", ...cooking.replacedBy };
  return { status: "planned" };
}

function TinDetail({ cooking, onChange, onClose }: { cooking: CookingView; onChange: () => void; onClose: () => void }) {
  const { t, tn, day, money } = useI18n();
  const toast = useToast();
  const [replacing, setReplacing] = useState(false);
  const heading = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    heading.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onClose]);

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
    <>
      <button type="button" aria-label={t("common.close")} onClick={onClose} className="fixed inset-0 z-30 bg-terra/40 sm:hidden" />
      <div
        role="dialog"
        aria-labelledby={`tin-${cooking.id}`}
        className="animate-sheet fixed inset-x-0 bottom-0 z-40 max-h-[80dvh] space-y-3 overflow-y-auto rounded-t-3xl border-t border-linha bg-louca p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-tin sm:animate-expand sm:static sm:z-auto sm:rounded-2xl sm:border sm:p-4 sm:shadow-none"
      >
        <span className="mx-auto block h-1 w-10 rounded-full bg-linha sm:hidden" aria-hidden />
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <Link to={{ page: "dish", id: cooking.dishId }} className="display text-xl">
            <span id={`tin-${cooking.id}`} ref={heading} tabIndex={-1}>
              {cooking.dish}
            </span>
          </Link>
          <span className="flex items-center gap-2 text-sm font-medium text-terra-soft">
            {t(`status.${cooking.status}`)}
            <button type="button" onClick={onClose} aria-label={t("common.close")} className="grid size-7 place-items-center rounded-full hover:bg-folha">
              ✕
            </button>
          </span>
        </div>
        <div className="space-y-0.5 text-sm text-terra-soft">
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
            </>
          )}
        </div>
        {replacing && <ReplaceForm onReplace={(by) => change({ status: "replaced", ...by }, "toast.replaced")} />}
      </div>
    </>
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
      <span className="h-10 w-16 rounded-b-2xl rounded-t-md border-[3px] border-manjericao/40" aria-hidden />
      <p className="text-terra-soft">{t("week.empty")}</p>
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
    <div className="animate-expand space-y-3 rounded-2xl bg-manjericao-soft p-4 sm:p-5">
      <h2 className="display text-xl text-manjericao">{t(hasPlan ? "week.plan.retitle" : "week.plan.title")}</h2>
      {people.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium text-terra-soft">{t("week.plan.who")}</span>
          {people.map((p) => {
            const on = !skipped.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(p.id)}
                className={cx("rounded-full px-3 py-1 font-semibold transition", on ? "bg-manjericao text-louca" : "bg-louca text-terra-soft ring-1 ring-linha")}
              >
                {p.name}
              </button>
            );
          })}
        </div>
      )}
      <label className="block space-y-1 text-sm">
        <span className="font-medium text-terra-soft">{t("week.plan.notes")}</span>
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
      <p className="text-xs text-terra-soft">{t("week.plan.help", { app: APP_NAME })}</p>
    </div>
  );
}

// -------------------------------------------------------------- shopping

function Shopping({ list }: { list: ShoppingList }) {
  const { t, tn, money } = useI18n();
  if (list.items.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="display text-2xl">{t("shopping.title")}</h2>
      <ul className="grid gap-x-8 sm:grid-cols-2">
        {list.items.map((i) => (
          <li key={i.ingredientId} className="flex items-baseline justify-between gap-3 border-b border-linha py-1.5 text-sm">
            <span>{i.name}</span>
            <span className="tabular-nums text-terra-soft">
              {i.quantity} {t(`unit.${i.unit}`)} · {i.costCents === null ? t("shopping.noPrice") : money(i.costCents)}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-sm font-semibold">
        {t("shopping.total", { amount: money(list.totalCents) })}
        {list.missingPrices > 0 && <span className="font-normal text-terra-soft"> · {tn("shopping.missing", list.missingPrices)}</span>}
      </p>
    </section>
  );
}
