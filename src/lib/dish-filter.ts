/** Searching the dish list by what a person remembers about a dish. */

import { nameKey } from "../../shared/names";
import type { PROTEIN_TAGS } from "../../shared/tags";

export type Protein = (typeof PROTEIN_TAGS)[number];

/** Whether the dish's name, an ingredient or a tag holds `query` (case and accents ignored), and it has `protein` when one is chosen. */
export function matchesDish(dish: { name: string; tags: string[]; ingredientNames: string[] }, { query, protein }: { query: string; protein: Protein | null }): boolean {
  if (protein && !dish.tags.includes(protein)) return false;
  const wanted = nameKey(query);
  if (!wanted) return true;
  return [dish.name, ...dish.ingredientNames, ...dish.tags].some((text) => nameKey(text).includes(wanted));
}
