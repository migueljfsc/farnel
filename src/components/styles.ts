/** Class names shared by components and pages, on the "lata de conserva" tokens in index.css. */

export const cx = (...classes: (string | false | undefined)[]): string => classes.filter(Boolean).join(" ");

/** An input without a width, for fields sized by their content (quantities, prices, selects). */
export const inputBase =
  "rounded-[3px] border-[1.5px] border-linha bg-raised px-3 py-2 text-sm text-tinta placeholder:text-tinta-soft/70 transition focus:border-mar focus:outline-none disabled:opacity-50";

export const inputClass = `${inputBase} w-full`;

export type Variant = "primary" | "secondary" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-mar text-on-mar hover:brightness-110",
  secondary: "bg-transparent text-tinta shadow-[inset_0_0_0_1.5px_var(--tinta)] hover:bg-mar-soft",
  danger: "bg-transparent text-tomate shadow-[inset_0_0_0_1.5px_var(--tomate)] hover:bg-tomate-soft",
};

/** Button styling, also for links that look like buttons. */
export const buttonClass = (variant: Variant = "primary", className?: string): string =>
  cx(
    "inline-flex items-center justify-center gap-1.5 rounded-[3px] px-3.5 py-1.5 text-sm font-semibold transition active:translate-y-px disabled:pointer-events-none disabled:opacity-40",
    VARIANTS[variant],
    className,
  );

export type Tone = "neutral" | "mar" | "tomate";

export const TONES: Record<Tone, string> = {
  neutral: "text-tinta-soft shadow-[inset_0_0_0_1px_var(--linha)]",
  mar: "bg-mar-soft text-mar",
  tomate: "bg-tomate-soft text-tomate",
};
