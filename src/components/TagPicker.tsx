import { useState } from "react";
import { BASE_TAGS, PROTEIN_TAGS, type FixedTag } from "../../shared/tags";
import { useI18n } from "../i18n/context";
import { cx, inputClass } from "./styles";
import { Field } from "./ui";

const FIXED: readonly string[] = [...PROTEIN_TAGS, ...BASE_TAGS];

/** Protein and base as chips, any other tag as free text. */
export function TagPicker({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const { t } = useI18n();
  const [extra, setExtra] = useState(tags.filter((tag) => !FIXED.includes(tag)).join(", "));
  const fixed = tags.filter((tag) => FIXED.includes(tag));
  const emit = (nextFixed: string[], nextExtra: string) =>
    onChange([...nextFixed, ...nextExtra.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)]);
  const toggle = (tag: string) => emit(fixed.includes(tag) ? fixed.filter((x) => x !== tag) : [...fixed, tag], extra);

  const group = (label: "tags.protein" | "tags.base", options: readonly FixedTag[]) => (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-cafe-soft">{t(label)}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((tag) => (
          <button
            key={tag}
            type="button"
            aria-pressed={fixed.includes(tag)}
            onClick={() => toggle(tag)}
            className={cx("rounded-full px-3 py-1 text-sm font-semibold transition", fixed.includes(tag) ? "bg-ganga text-louca" : "ring-1 ring-linha hover:bg-ganga-soft")}
          >
            {t(`tag.${tag}`)}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {group("tags.protein", PROTEIN_TAGS)}
      {group("tags.base", BASE_TAGS)}
      <Field label={t("tags.extra")}>
        <input
          className={inputClass}
          value={extra}
          onChange={(e) => {
            setExtra(e.target.value);
            emit(fixed, e.target.value);
          }}
        />
      </Field>
    </div>
  );
}
