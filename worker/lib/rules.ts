/**
 * The planning rules, as pure functions over facts the services load. These are the guarantees
 * the model cannot bypass: validated dishes only, hard restrictions, repeat intervals, and a
 * consistent plan.
 */

import type { DishStatus, RestrictionStatus, Slot, Unit } from "../../shared/types";
import { addDays, isMonday } from "../../shared/time";

export interface DishFacts {
  id: number;
  status: DishStatus;
  portions: number;
  repeatIntervalDays: number;
  lastCooked: string | null;
  ingredients: { quantity: number; unit: Unit; priceCents: number | null; statuses: Record<number, RestrictionStatus> }[];
}

export type RuleCode = "not_validated" | "restricted" | "cooldown";

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

/** Why a dish cannot be planned on `onDate`; empty when it can. */
export function eligibility(dish: DishFacts, hardRestrictionIds: number[], onDate: string): RuleCode[] {
  const codes: RuleCode[] = [];
  if (dish.status !== "validated") codes.push("not_validated");
  const unsafe = dish.ingredients.some((line) => hardRestrictionIds.some((id) => line.statuses[id] !== "safe"));
  if (unsafe) codes.push("restricted");
  if (dish.lastCooked !== null && addDays(dish.lastCooked, dish.repeatIntervalDays) > onDate) codes.push("cooldown");
  return codes;
}

export interface PlanInput {
  weekStart: string;
  notes?: string;
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
  | "plan_locked";

export interface PlanError {
  code: PlanErrorCode;
  /** Index in the input's cookings. */
  cooking?: number;
  dishId?: number;
}

export interface PlanFacts {
  dishes: Map<number, DishFacts>;
  hardRestrictionIds: number[];
  today: string;
  /** `date|slot` of meals that other weeks' plans cover. */
  takenMeals: Set<string>;
}

export const PORTIONS_PER_MEAL = 2;

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
      if (cooking.portions < cooking.meals.length * PORTIONS_PER_MEAL) return "portions";
      if (!inWeek(cooking.cookDate) || cooking.meals.some((m) => !inWeek(m.date))) return "date_out_of_week";
      if (cooking.meals.some((m) => m.date < cooking.cookDate)) return "meal_before_cook";
      if (cooking.cookDate < facts.today) return "in_past";
      if (cooking.meals.some((m) => seenMeals.has(mealKey(m)))) return "meal_taken";
      return null;
    })();
    seenDishes.add(cooking.dishId);
    cooking.meals.forEach((m) => seenMeals.add(mealKey(m)));

    if (structural) errors.push({ code: structural, ...at });
    else for (const code of eligibility(dish!, facts.hardRestrictionIds, firstCook)) errors.push({ code, ...at });
  });
  return errors;
}
