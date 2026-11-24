import { cx } from "./styles";

/** A few mutually exclusive choices side by side, the chosen one filled. `onMar` is for the teal rail. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  onMar = false,
}: {
  label: string;
  options: { value: T; label: string; lang?: string }[];
  value: T;
  onChange: (value: T) => void;
  onMar?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx("inline-flex w-max overflow-hidden rounded-[3px] text-xs font-bold", onMar ? "shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--on-mar)_40%,transparent)]" : "shadow-[inset_0_0_0_1px_var(--linha)]")}
    >
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            lang={option.lang}
            onClick={() => onChange(option.value)}
            className={cx(
              "px-2.5 py-1 transition",
              on ? (onMar ? "bg-on-mar text-mar" : "bg-tinta text-papel") : onMar ? "text-on-mar/80 hover:text-on-mar" : "text-tinta-soft hover:text-tinta",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
