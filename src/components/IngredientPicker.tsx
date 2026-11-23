import { useEffect, useId, useRef, useState } from "react";
import { nameKey } from "../../shared/names";
import type { IngredientView } from "../../shared/types";
import { useI18n } from "../i18n/context";
import { NewIngredientForm } from "./NewIngredientForm";
import { cx, inputClass } from "./styles";

/**
 * Picks one existing ingredient: type to filter, arrows and Enter to choose. Free text never
 * becomes an ingredient by itself; "Create" opens the new-ingredient form, prefilled.
 */
export function IngredientPicker({
  known,
  value,
  onPick,
  onCreated,
}: {
  known: IngredientView[];
  value: IngredientView | undefined;
  onPick: (ingredient: IngredientView) => void;
  onCreated: (ingredient: IngredientView) => void;
}) {
  const { t } = useI18n();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [creating, setCreating] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const key = nameKey(query);
  const matches = known.filter((i) => nameKey(i.name).includes(key)).slice(0, 8);
  const exact = known.some((i) => nameKey(i.name) === key);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    addEventListener("pointerdown", onPointer);
    return () => removeEventListener("pointerdown", onPointer);
  }, [open]);

  const choose = (ingredient: IngredientView) => {
    onPick(ingredient);
    setQuery("");
    setOpen(false);
  };

  if (creating !== null) {
    return (
      <NewIngredientForm
        initialName={creating}
        onCancel={() => setCreating(null)}
        onCreated={(ingredient) => {
          setCreating(null);
          onCreated(ingredient);
        }}
      />
    );
  }

  return (
    <div ref={root} className="relative min-w-40 flex-1">
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        className={inputClass}
        placeholder={value?.name ?? t("picker.search")}
        value={open ? query : (value?.name ?? "")}
        onFocus={() => {
          setOpen(true);
          setActive(0);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, matches.length - (exact || !query.trim() ? 1 : 0)));
          else if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
          else if (e.key === "Escape") setOpen(false);
          else if (e.key === "Enter") {
            e.preventDefault();
            if (matches[active]) choose(matches[active]);
            else if (query.trim() && !exact) setCreating(query.trim());
          } else return;
          e.preventDefault();
        }}
      />
      {open && (
        <ul id={listId} role="listbox" className="animate-expand absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-linha bg-louca p-1 shadow-tin">
          {matches.map((ingredient, index) => (
            <li
              key={ingredient.id}
              role="option"
              aria-selected={index === active}
              onPointerDown={(e) => {
                e.preventDefault();
                choose(ingredient);
              }}
              className={cx("flex cursor-pointer items-center justify-between rounded-lg px-3 py-1.5 text-sm", index === active && "bg-salva-soft text-salva")}
            >
              <span>{ingredient.name}</span>
              <span className="text-xs text-cafe-soft">{t(`unit.${ingredient.unit}`)}</span>
            </li>
          ))}
          {matches.length === 0 && !query.trim() && <li className="px-3 py-1.5 text-sm text-cafe-soft">{t("picker.noMatch")}</li>}
          {query.trim() && !exact && (
            <li
              role="option"
              aria-selected={active === matches.length}
              onPointerDown={(e) => {
                e.preventDefault();
                setCreating(query.trim());
              }}
              className={cx("cursor-pointer rounded-lg px-3 py-1.5 text-sm font-semibold text-rosa", active === matches.length && "bg-rosa-soft")}
            >
              + {t("picker.create", { name: query.trim() })}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
