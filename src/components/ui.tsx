import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { DecidedStatus, RestrictionStatus } from "../../shared/types";
import { ApiError } from "../lib/api";
import { useApp } from "../lib/app-context";
import { href, type Route } from "../lib/router";
import { buttonClass, cx, type Variant } from "./styles";


export function Link({ to, className, children }: { to: Route; className?: string; children: ReactNode }) {
  const { navigate } = useApp();
  return (
    <a
      href={href(to)}
      className={cx("text-emerald-700 hover:underline", className)}
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
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{title}</h1>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </header>
      {children}
    </section>
  );
}

export const Card = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cx("rounded-lg border border-stone-200 bg-white p-3 shadow-sm", className)}>{children}</div>
);

export const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="block space-y-1 text-sm">
    <span className="font-medium text-stone-700">{label}</span>
    {children}
  </label>
);


export const Badge = ({ children, tone = "stone" }: { children: ReactNode; tone?: "stone" | "amber" | "emerald" | "red" }) => (
  <span
    className={cx(
      "rounded-full px-2 py-0.5 text-xs font-medium",
      { stone: "bg-stone-100 text-stone-700", amber: "bg-amber-100 text-amber-800", emerald: "bg-emerald-100 text-emerald-800", red: "bg-red-100 text-red-800" }[tone],
    )}
  >
    {children}
  </span>
);

/** Loading, error, or the content once `data` is there. */
export function Loaded<T>({ data, error, children }: { data: T | undefined; error?: ApiError; children: (data: T) => ReactNode }) {
  if (error) return <ErrorText error={error} />;
  if (data === undefined) return <p className="text-sm text-stone-500">Loading…</p>;
  return <>{children(data)}</>;
}

export const ErrorText = ({ error }: { error: unknown }) => (
  <p className="text-sm text-red-700">{error instanceof ApiError ? `Error: ${error.code.replaceAll("_", " ")}` : "Something went wrong."}</p>
);

export function Stars({ value, onChange }: { value: number | undefined; onChange?: (rating: number) => void }) {
  return (
    <span className="inline-flex" aria-label={value ? `${value} of 5` : "not rated"}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          className={cx("px-0.5 text-lg leading-none", n <= (value ?? 0) ? "text-amber-500" : "text-stone-300", !onChange && "cursor-default")}
        >
          ★
        </button>
      ))}
    </span>
  );
}

/** Safe / forbidden for one ingredient and restriction; unknown shows as undecided. */
export function StatusToggle({ label, status, onChange }: { label: string; status: RestrictionStatus | undefined; onChange: (status: DecidedStatus) => void }) {
  const option = (value: DecidedStatus, text: string, on: string) => (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={cx("px-2 py-0.5 text-xs", status === value ? on : "bg-white text-stone-600 hover:bg-stone-100")}
    >
      {text}
    </button>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <span className={cx(status === "unknown" || !status ? "font-semibold text-amber-700" : "text-stone-600")}>{label}</span>
      <span className="inline-flex overflow-hidden rounded border border-stone-300">
        {option("safe", "safe", "bg-emerald-600 text-white")}
        {option("forbidden", "forbidden", "bg-red-600 text-white")}
      </span>
    </span>
  );
}
