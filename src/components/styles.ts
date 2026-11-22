/** Class names shared by components and pages. */

export const cx = (...classes: (string | false | undefined)[]): string => classes.filter(Boolean).join(" ");

export const inputClass = "w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm";

export type Variant = "primary" | "secondary" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-emerald-700 text-white hover:bg-emerald-800",
  secondary: "border border-stone-300 bg-white text-stone-800 hover:bg-stone-100",
  danger: "border border-red-300 bg-white text-red-700 hover:bg-red-50",
};

/** Button styling, also for links that look like buttons. */
export const buttonClass = (variant: Variant = "primary", className?: string): string =>
  cx("inline-block rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50", VARIANTS[variant], className);
