import type { IngredientView, Restriction } from "../../shared/types";

/** Whether someone still has to say if the ingredient is safe for one of the restrictions in use. */
export const isUndecided = (ingredient: Pick<IngredientView, "statuses">, restrictions: Restriction[]): boolean =>
  restrictions.some((r) => (ingredient.statuses[r.id] ?? "unknown") === "unknown");
