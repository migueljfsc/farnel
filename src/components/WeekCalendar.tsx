import { useEffect, useRef, useState } from "react";
import { weekdayNames } from "../../shared/format";
import { addDays, todayLisbon, weekStartOf } from "../../shared/time";
import { useI18n } from "../i18n/context";
import { useApi } from "../lib/api";
import { addMonths, monthWeeks } from "../lib/calendar";
import { cx } from "./styles";

/**
 * The week title as a button that opens a month: each row is a week, picked as a whole. Weeks
 * with a plan carry a dot, the open week is highlighted, today is ringed.
 */
export function WeekCalendar({ week, onPick }: { week: string; onPick: (weekStart: string) => void }) {
  const { t, day, month, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(week);
  const root = useRef<HTMLDivElement>(null);
  const weeks = monthWeeks(shown);
  const { data } = useApi<{ weeks: string[] }>(open ? `/api/plans?from=${weeks[0]}&to=${weeks[weeks.length - 1]}` : null);
  const planned = new Set(data?.weeks ?? []);
  const today = todayLisbon(new Date());
  const monthKey = shown.slice(0, 7);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onPointer = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    addEventListener("keydown", onKey);
    addEventListener("pointerdown", onPointer);
    return () => {
      removeEventListener("keydown", onKey);
      removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const pick = (weekStart: string) => {
    setOpen(false);
    onPick(weekStart);
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          setShown(week);
          setOpen(!open);
        }}
        className="group flex items-end gap-2 text-left"
      >
        <h1 className="display text-4xl sm:text-5xl">{t("week.title", { day: day(week) })}</h1>
        <svg viewBox="0 0 24 24" aria-hidden className={cx("mb-2 size-6 text-salva transition group-hover:translate-y-0.5", open && "rotate-180")} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
        <span className="sr-only">{t("calendar.choose")}</span>
      </button>

      {open && (
        <div role="dialog" aria-label={t("calendar.choose")} className="animate-expand absolute left-0 top-full z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-linha bg-louca p-4 shadow-tin">
          <div className="mb-3 flex items-center justify-between">
            <button type="button" aria-label={t("calendar.previousMonth")} onClick={() => setShown(addMonths(shown, -1))} className="grid size-8 place-items-center rounded-full hover:bg-aveia">
              ‹
            </button>
            <span className="font-semibold capitalize">{month(shown)}</span>
            <button type="button" aria-label={t("calendar.nextMonth")} onClick={() => setShown(addMonths(shown, 1))} className="grid size-8 place-items-center rounded-full hover:bg-aveia">
              ›
            </button>
          </div>
          <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-semibold text-cafe-soft">
            {weekdayNames(locale).map((name) => (
              <span key={name}>{name}</span>
            ))}
          </div>
          <div className="space-y-1">
            {weeks.map((weekStart) => {
              const current = weekStart === week;
              return (
                <button
                  key={weekStart}
                  type="button"
                  aria-current={current ? "date" : undefined}
                  aria-label={`${t("week.title", { day: day(weekStart) })}${planned.has(weekStart) ? `, ${t("calendar.hasPlan")}` : ""}`}
                  onClick={() => pick(weekStart)}
                  className={cx("relative grid w-full grid-cols-7 rounded-full py-1 text-sm transition", current ? "bg-salva text-louca" : "hover:bg-salva-soft")}
                >
                  {Array.from({ length: 7 }, (_, i) => {
                    const date = addDays(weekStart, i);
                    const inMonth = date.slice(0, 7) === monthKey;
                    return (
                      <span
                        key={date}
                        className={cx(
                          "mx-auto grid size-7 place-items-center rounded-full tabular-nums",
                          !inMonth && !current && "text-cafe-soft/50",
                          date === today && (current ? "ring-2 ring-louca" : "ring-2 ring-rosa"),
                        )}
                      >
                        {Number(date.slice(8))}
                      </span>
                    );
                  })}
                  {planned.has(weekStart) && <span className={cx("absolute -right-1 top-1/2 size-2 -translate-y-1/2 rounded-full", current ? "bg-rosa" : "bg-salva")} aria-hidden />}
                </button>
              );
            })}
          </div>
          <button type="button" onClick={() => pick(weekStartOf(today))} className="mt-3 w-full rounded-full bg-aveia py-1.5 text-sm font-semibold text-salva hover:bg-salva-soft">
            {t("calendar.thisWeek")}
          </button>
        </div>
      )}
    </div>
  );
}
