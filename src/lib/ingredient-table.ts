/** Grouping, searching and filtering the ingredients table. */

import { AISLES, type Aisle } from "../../shared/aisles";
import { nameKey } from "../../shared/names";
import type { DecidedStatus, IngredientView, Restriction, RestrictionStatus } from "../../shared/types";
import { isUndecided } from "./catalogue";
import type { DraftView } from "./ingredient-drafts";

export type TableFilter = "all" | "undecided" | "protein" | "noPrice";

/** Ingredients by aisle, in the order of a walk through the shop; aisles with none are left out. */
export function groupByAisle(ingredients: IngredientView[]): { aisle: Aisle; items: IngredientView[] }[] {
  return AISLES.map((aisle) => ({ aisle, items: ingredients.filter((i) => i.aisle === aisle) })).filter((g) => g.items.length > 0);
}

/** Whether a row shows for the search and filter; `view` holds its unsaved edits. */
export function matches(ingredient: IngredientView, view: DraftView, { query, filter }: { query: string; filter: TableFilter }, restrictions: Restriction[]): boolean {
  if (query.trim() && !nameKey(ingredient.name).includes(nameKey(query))) return false;
  if (filter === "undecided") return isUndecided({ statuses: view.statuses }, restrictions);
  if (filter === "protein") return view.protein.trim() !== "";
  if (filter === "noPrice") return view.price.trim() === "";
  return true;
}

/** What a restriction cell becomes when clicked: an undecided one is first marked safe. */
export const nextStatus = (status: RestrictionStatus): DecidedStatus => (status === "safe" ? "forbidden" : "safe");
