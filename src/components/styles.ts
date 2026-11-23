/** Class names shared by components and pages, on the "esmalte" tokens in index.css. */

export const cx = (...classes: (string | false | undefined)[]): string => classes.filter(Boolean).join(" ");

export const inputClass =
  "w-full rounded-lg border border-linha bg-louca px-3 py-2 text-sm text-tinta placeholder:text-tinta-soft/70 transition focus:border-cobalto focus:outline-none focus:ring-2 focus:ring-cobalto/25 disabled:opacity-50";

export type Variant = "primary" | "secondary" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-cobalto text-louca hover:brightness-110",
  secondary: "border border-linha bg-louca text-tinta hover:border-cobalto/50 hover:bg-cobalto-soft",
  danger: "border border-colorau/40 bg-louca text-colorau hover:bg-colorau-soft",
};

/** Button styling, also for links that look like buttons. */
export const buttonClass = (variant: Variant = "primary", className?: string): string =>
  cx(
    "inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40",
    VARIANTS[variant],
    className,
  );

export type Tone = "neutral" | "cobalto" | "azeite" | "colorau";

export const TONES: Record<Tone, string> = {
  neutral: "bg-esmalte text-tinta-soft ring-1 ring-linha",
  cobalto: "bg-cobalto-soft text-cobalto",
  azeite: "bg-azeite-soft text-azeite",
  colorau: "bg-colorau-soft text-colorau",
};
