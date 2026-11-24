/**
 * The planning rules, as pure functions over facts the services load. These are the guarantees
 * the model cannot bypass: validated dishes only, hard restrictions, enough protein, repeat
 * intervals, and a consistent plan.
 */

import type { DishStatus, RestrictionStatus, Slot, Unit } from "../../shared/types";
import { addDays, isMonday } from "../../shared/time";

export interface DishFacts {
  id: number;
  status: DishStatus;
  portions: number;
  repeatIntervalDays: number;
  lastCooked: string | null;
  /** `proteinGrams`: raw protein weight in 1 g or 1 un of the ingredient; null when it is not a protein. */
  ingredients: { quantity: number; unit: Unit; priceCents: number | null; statuses: Record<number, RestrictionStatus>; proteinGrams?: number | null }[];
}

export type RuleCode = "not_validated" | "restricted" | "low_protein" | "cooldown";

/** Price of `quantity`, with `priceCents` per 1000 g, 1000 ml or 1 un. */
export function lineCostCents(quantity: number, unit: Unit, priceCents: number | null): number | null {
  if (priceCents === null) return null;
  return Math.round((quantity * priceCents) / (unit === "un" ? 1 : 1000));
}

export function costPerPortionCents(dish: DishFacts): { cents: number; missingPrice: boolean } {
  let total = 0;
  let missingPrice = false;
  for (const line of dish.ingredients) {
    const cost = lineCostCents(line.quantity, line.unit, line.priceCents);
    if (cost === null) missingPrice = true;
    else total += cost;
  }
  return { cents: Math.round(total / dish.portions), missingPrice };
}

const exactProtein = (dish: DishFacts): number => dish.ingredients.reduce((sum, line) => sum + line.quantity * (line.proteinGrams ?? 0), 0) / dish.portions;

/** Raw weight of the dish's protein ingredients in one portion, rounded down to the gram. */
export const proteinPerPortionGrams = (dish: DishFacts): number => Math.floor(exactProtein(dish));

/** Why a dish cannot be planned on `onDate`; empty when it can. */
export function eligibility(dish: DishFacts, hardRestrictionIds: number[], onDate: string, minProteinGrams = 0): RuleCode[] {
  const codes: RuleCode[] = [];
  if (dish.status !== "validated") codes.push("not_validated");
  const unsafe = dish.ingredients.some((line) => hardRestrictionIds.some((id) => line.statuses[id] !== "safe"));
  if (unsafe) codes.push("restricted");
  if (exactProtein(dish) < minProteinGrams) codes.push("low_protein");
  if (dish.lastCooked !== null && addDays(dish.lastCooked, dish.repeatIntervalDays) > onDate) codes.push("cooldown");
  return codes;
}

export interface PlanInput {
  weekStart: string;
  notes?: string;
  /** Who eats this plan; everyone when absent. */
  peopleIds?: number[];
  cookings: { dishId: number; cookDate: string; portions: number; meals: { date: string; slot: Slot }[] }[];
}

export type PlanErrorCode =
  | RuleCode
  | "week_start_not_monday"
  | "unknown_dish"
  | "duplicate_dish"
  | "empty_meals"
  | "portions"
  | "date_out_of_week"
  | "meal_before_cook"
  | "in_past"
  | "meal_taken"
  | "plan_locked"
  | "unknown_person";

export interface PlanError {
  code: PlanErrorCode;
  /** Index in the input's cookings. */
  cooking?: number;
  dishId?: number;
}

export interface PlanFacts {
  dishes: Map<number, DishFacts>;
  /** Hard restrictions of the people eating. */
  hardRestrictionIds: number[];
  /** Raw protein weight each portion needs. */
  minProteinGrams?: number;
  /** People eating each meal: one portion each. */
  eaters: number;
  today: string;
  /** `date|slot` of meals that other weeks' plans cover. */
  takenMeals: Set<string>;
}

export const mealKey = (meal: { date: string; slot: Slot }): string => `${meal.date}|${meal.slot}`;

export function validatePlan(input: PlanInput, facts: PlanFacts): PlanError[] {
  if (!isMonday(input.weekStart)) return [{ code: "week_start_not_monday" }];

  const weekEnd = addDays(input.weekStart, 6);
  const inWeek = (date: string) => date >= input.weekStart && date <= weekEnd;
  const firstCook = input.cookings.reduce((min, c) => (c.cookDate < min ? c.cookDate : min), weekEnd);
  const seenDishes = new Set<number>();
  const seenMeals = new Set(facts.takenMeals);
  const errors: PlanError[] = [];

  input.cookings.forEach((cooking, index) => {
    const at = { cooking: index, dishId: cooking.dishId };
    const dish = facts.dishes.get(cooking.dishId);
    const structural = ((): PlanErrorCode | null => {
      if (!dish) return "unknown_dish";
      if (seenDishes.has(cooking.dishId)) return "duplicate_dish";
      if (cooking.meals.length === 0) return "empty_meals";
      if (cooking.portions < cooking.meals.length * facts.eaters) return "portions";
      if (!inWeek(cooking.cookDate) || cooking.meals.some((m) => !inWeek(m.date))) return "date_out_of_week";
      if (cooking.meals.some((m) => m.date < cooking.cookDate)) return "meal_before_cook";
      if (cooking.cookDate < facts.today) return "in_past";
      for (const meal of cooking.meals) {
        if (seenMeals.has(mealKey(meal))) return "meal_taken";
        seenMeals.add(mealKey(meal));
      }
      return null;
    })();
    seenDishes.add(cooking.dishId);

    if (structural) errors.push({ code: structural, ...at });
    else for (const code of eligibility(dish!, facts.hardRestrictionIds, firstCook, facts.minProteinGrams)) errors.push({ code, ...at });
  });
  return errors;
}
