import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import type { SaveState } from "../lib/autosave";
import { errorMessage } from "../lib/errors";
import { useI18n } from "../i18n/context";
import { ApiError } from "../lib/api";
import { useApp } from "../lib/app-context";
import { href, type Route } from "../lib/router";
import { buttonClass, cx, TONES, type Tone, type Variant } from "./styles";


export function Link({ to, className, children, ...rest }: { to: Route; className?: string; children: ReactNode; "aria-current"?: "page" }) {
  const { navigate } = useApp();
  return (
    <a
      {...rest}
      href={href(to)}
      className={cx("text-mar underline-offset-4 hover:underline", className)}
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
      <header className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-tinta pb-3">
        <h1 className="display text-4xl text-mar sm:text-5xl">{title}</h1>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </header>
      {children}
    </section>
  );
}

/** A part of a page, set off by an ink rule instead of a floating box. */
export const Card = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cx("border-t-2 border-tinta pt-4", className)}>{children}</div>
);

/** Rows divided by hairlines under an ink rule, like a printed table. */
export const List = ({ children }: { children: ReactNode }) => (
  <ul className="divide-y divide-linha border-y border-t-2 border-linha border-t-tinta">{children}</ul>
);

export const Row = ({ children, className }: { children: ReactNode; className?: string }) => (
  <li className={cx("px-2 py-3 transition-colors hover:bg-mar-soft/40 sm:px-3", className)}>{children}</li>
);

/** Switches between the two halves of the catalogue: dishes and their ingredients. */
export function CatalogueTabs({ current }: { current: "dishes" | "ingredients" }) {
  const { t } = useI18n();
  const tab = (page: "dishes" | "ingredients", label: "nav.dishes" | "nav.ingredients") => (
    <Link
      to={{ page }}
      aria-current={current === page ? "page" : undefined}
      className={cx("py-2 text-sm font-semibold no-underline transition hover:no-underline", current === page ? "text-tinta! shadow-[inset_0_-3px_0_var(--mar)]" : "text-tinta-soft! hover:text-tinta!")}
    >
      {t(label)}
    </Link>
  );
  return (
    <div className="flex gap-5 border-b border-linha">
      {tab("dishes", "nav.dishes")}
      {tab("ingredients", "nav.ingredients")}
    </div>
  );
}

/** How the last autosave went, next to what was saved. */
export function SaveStatus({ state }: { state: SaveState }) {
  const { t } = useI18n();
  if (state === "idle") return null;
  if (state === "error") return <span className="text-sm font-medium text-tomate">{t("error.generic")}</span>;
  return (
    <span role="status" className={cx("text-sm font-medium", state === "saving" ? "text-tinta-soft" : "animate-pop text-mar")}>
      {state === "saving" ? t("common.saving") : `✓ ${t("common.saved")}`}
    </span>
  );
}

export const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="block space-y-1 text-sm">
    <span className="font-medium text-tinta-soft">{label}</span>
    {children}
  </label>
);


export const Badge = ({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) => (
  <span className={cx("inline-flex items-center rounded-[2px] px-1.5 py-0.5 text-[11px] font-bold", TONES[tone])}>{children}</span>
);

/** Loading, error, or the content once `data` is there. */
export function Loaded<T>({ data, error, children }: { data: T | undefined; error?: ApiError; children: (data: T) => ReactNode }) {
  if (error) return <ErrorText error={error} />;
  if (data === undefined) return <LoadingText />;
  return <>{children(data)}</>;
}

/** Shimmering placeholders in the rough shape of a page while its data loads. */
function LoadingText() {
  const { t } = useI18n();
  return (
    <div role="status" aria-label={t("common.loading")} className="space-y-3">
      <div className="skeleton h-5 w-2/5" />
      <div className="skeleton h-24" />
      <div className="skeleton h-24" />
    </div>
  );
}

export function ErrorText({ error }: { error: unknown }) {
  const { t } = useI18n();
  return <p className="text-sm font-medium text-tomate">{errorMessage(t, error)}</p>;
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
            n <= (value ?? 0) ? "text-tomate" : "text-tinta-soft/35",
            onChange ? "hover:text-tomate/70" : "cursor-default",
            popped === n && "animate-pop",
          )}
        >
          ★
        </button>
      ))}
    </span>
  );
}
