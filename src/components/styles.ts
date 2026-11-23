/** Class names shared by components and pages, on the "folha" tokens in index.css. */

export const cx = (...classes: (string | false | undefined)[]): string => classes.filter(Boolean).join(" ");

/** An input without a width, for fields sized by their content (quantities, prices, selects). */
export const inputBase =
  "rounded-lg border border-linha bg-louca px-3 py-2 text-sm text-terra placeholder:text-terra-soft/70 transition focus:border-manjericao focus:outline-none focus:ring-2 focus:ring-manjericao/25 disabled:opacity-50";

export const inputClass = `${inputBase} w-full`;

export type Variant = "primary" | "secondary" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-manjericao text-louca hover:brightness-110",
  secondary: "border border-linha bg-louca text-terra hover:border-manjericao/50 hover:bg-manjericao-soft",
  danger: "border border-tomate/40 bg-louca text-tomate hover:bg-tomate-soft",
};

/** Button styling, also for links that look like buttons. */
export const buttonClass = (variant: Variant = "primary", className?: string): string =>
  cx(
    "inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40",
    VARIANTS[variant],
    className,
  );

export type Tone = "neutral" | "manjericao" | "acafrao" | "tomate";

export const TONES: Record<Tone, string> = {
  neutral: "bg-folha text-terra-soft ring-1 ring-linha",
  manjericao: "bg-manjericao-soft text-manjericao",
  acafrao: "bg-acafrao-soft text-terra",
  tomate: "bg-tomate-soft text-tomate",
};
