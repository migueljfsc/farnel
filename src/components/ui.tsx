import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import type { DecidedStatus, RestrictionStatus } from "../../shared/types";
import { isMessageKey } from "../i18n/core";
import { useI18n } from "../i18n/context";
import { ApiError } from "../lib/api";
import { useApp } from "../lib/app-context";
import { href, type Route } from "../lib/router";
import { buttonClass, cx, TONES, type Tone, type Variant } from "./styles";


export function Link({ to, className, children }: { to: Route; className?: string; children: ReactNode }) {
  const { navigate } = useApp();
  return (
    <a
      href={href(to)}
      className={cx("text-cobalto underline-offset-4 hover:underline", className)}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey) return;
        e.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}

export function Button({ variant = "primary", className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type="button" className={buttonClass(variant, className)} {...props} />;
}

export function Page({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="display text-3xl sm:text-4xl">{title}</h1>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </header>
      {children}
    </section>
  );
}

export const Card = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cx("rounded-xl border border-linha bg-louca p-4", className)}>{children}</div>
);

/** One enamel surface holding rows divided by hairlines, instead of a stack of separate cards. */
export const List = ({ children }: { children: ReactNode }) => (
  <ul className="divide-y divide-linha overflow-hidden rounded-2xl border border-linha bg-louca">{children}</ul>
);

export const Row = ({ children, className }: { children: ReactNode; className?: string }) => (
  <li className={cx("px-4 py-3 transition-colors hover:bg-esmalte/60", className)}>{children}</li>
);

export const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="block space-y-1 text-sm">
    <span className="font-medium text-tinta-soft">{label}</span>
    {children}
  </label>
);


export const Badge = ({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) => (
  <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", TONES[tone])}>{children}</span>
);

/** Loading, error, or the content once `data` is there. */
export function Loaded<T>({ data, error, children }: { data: T | undefined; error?: ApiError; children: (data: T) => ReactNode }) {
  if (error) return <ErrorText error={error} />;
  if (data === undefined) return <LoadingText />;
  return <>{children(data)}</>;
}

function LoadingText() {
  const { t } = useI18n();
  return <p className="animate-pulse text-sm text-tinta-soft">{t("common.loading")}</p>;
}

/** An API error as a sentence in the reader's language; unknown codes get the generic one. */
export function ErrorText({ error }: { error: unknown }) {
  const { t } = useI18n();
  const key = error instanceof ApiError ? `error.${error.code}` : "";
  const vars = error instanceof ApiError ? (error.details as Record<string, string>) : undefined;
  return <p className="text-sm font-medium text-colorau">{isMessageKey(key) ? t(key, vars) : t("error.generic")}</p>;
}

export function Stars({ value, onChange }: { value: number | undefined; onChange?: (rating: number) => void }) {
  const { t } = useI18n();
  const [popped, setPopped] = useState<number | null>(null);
  return (
    <span className="inline-flex" aria-label={value ? t("common.rating", { value }) : t("common.notRated")}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={`${n}-${popped === n ? "pop" : ""}`}
          type="button"
          disabled={!onChange}
          aria-label={t("common.rating", { value: n })}
          onClick={() => {
            setPopped(n);
            onChange?.(n);
          }}
          className={cx(
            "px-0.5 text-xl leading-none transition-colors",
            n <= (value ?? 0) ? "text-colorau" : "text-tinta-soft/35",
            onChange ? "hover:text-colorau/70" : "cursor-default",
            popped === n && "animate-pop",
          )}
        >
          ★
        </button>
      ))}
    </span>
  );
}

/** Safe / forbidden for one ingredient and restriction; undecided stands out until someone chooses. */
export function StatusToggle({ label, status, onChange }: { label: string; status: RestrictionStatus | undefined; onChange: (status: DecidedStatus) => void }) {
  const { t } = useI18n();
  const undecided = status !== "safe" && status !== "forbidden";
  const option = (value: DecidedStatus, text: string, on: string) => (
    <button
      type="button"
      aria-pressed={status === value}
      onClick={() => onChange(value)}
      className={cx("rounded-full px-2.5 py-0.5 text-xs font-semibold transition", status === value ? on : "text-tinta-soft hover:text-tinta")}
    >
      {text}
    </button>
  );
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className={cx(undecided ? "font-bold text-colorau" : "text-tinta-soft")}>{label}</span>
      <span className={cx("inline-flex rounded-full bg-esmalte p-0.5 ring-1", undecided ? "ring-colorau/50" : "ring-linha")}>
        {option("safe", t("restriction.safe"), "bg-azeite text-louca")}
        {option("forbidden", t("restriction.forbidden"), "bg-colorau text-louca")}
      </span>
    </span>
  );
}
