/** Shapes shared by the Worker (API and MCP) and the web UI. Types only. */

import type { Aisle } from "./aisles";

export type Unit = "g" | "ml" | "un";
export type RestrictionStatus = "safe" | "forbidden" | "unknown";
export type DecidedStatus = Exclude<RestrictionStatus, "unknown">;
export type RestrictionKind = "hard" | "soft";
export type DishStatus = "pending" | "validated" | "archived";
export type DishAuthor = "person" | "claude";
/** `done` is derived: a planned cooking dated before today. */
export type CookingStatus = "planned" | "done" | "skipped" | "replaced";
export type Slot = "lunch" | "dinner";

export interface Restriction {
  id: number;
  name: string;
}

export interface IngredientView {
  id: number;
  name: string;
  unit: Unit;
  aisle: Aisle;
  priceCents: number | null;
  priceSource: string;
  priceUpdatedAt: string | null;
  /** By restriction id. */
  statuses: Record<number, RestrictionStatus>;
}

export interface DishSummary {
  id: number;
  name: string;
  status: DishStatus;
  createdBy: DishAuthor;
  portions: number;
  repeatIntervalDays: number;
  tags: string[];
  costPerPortionCents: number;
  missingPrice: boolean;
  lastCooked: string | null;
}

export interface DishIngredient {
  ingredientId: number;
  name: string;
  quantity: number;
  unit: Unit;
  priceCents: number | null;
  statuses: Record<number, RestrictionStatus>;
}

export interface FeedbackView {
  personId: number;
  person: string;
  rating: number;
  comment: string;
}

export interface DishFeedback extends FeedbackView {
  cookingId: number;
  date: string;
}

export interface DishDetail extends DishSummary {
  notes: string;
  ingredients: DishIngredient[];
  feedback: DishFeedback[];
}

export interface Meal {
  date: string;
  slot: Slot;
}

export interface CookingView {
  id: number;
  dishId: number;
  dish: string;
  cookDate: string;
  portions: number;
  costCents: number;
  status: CookingStatus;
  replacedBy: { dishId: number; dish: string } | { text: string } | null;
  meals: Meal[];
  feedback: FeedbackView[];
}

export interface PlanView {
  weekStart: string;
  /** Who eats this plan. */
  people: { id: number; name: string }[];
  budgetCents: number;
  totalCents: number;
  overBudget: boolean;
  notes: string;
  cookings: CookingView[];
}

export interface ShoppingItem {
  ingredientId: number;
  name: string;
  unit: Unit;
  aisle: Aisle;
  quantity: number;
  costCents: number | null;
}

export interface ShoppingList {
  items: ShoppingItem[];
  totalCents: number;
  missingPrices: number;
}

export interface Candidate {
  id: number;
  name: string;
  tags: string[];
  portions: number;
  repeatIntervalDays: number;
  lastCooked: string | null;
  costPerPortionCents: number;
  missingPrice: boolean;
  ratings: { personId: number; person: string; average: number; count: number }[];
  recentComments: { date: string; person: string; rating: number; comment: string }[];
  /** Soft restrictions for which the dish has a forbidden ingredient. */
  softFlags: { person: string; restriction: string }[];
}

export interface PersonRestriction {
  restrictionId: number;
  name: string;
  kind: RestrictionKind;
  weight: number;
}

export interface PersonView {
  id: number;
  email: string;
  name: string;
  restrictions: PersonRestriction[];
  preferences: string;
}

export interface Settings {
  weeklyBudgetCents: number;
  lunchesPerWeek: number;
}

export interface UndecidedItem {
  ingredientId: number;
  ingredient: string;
  restrictionId: number;
  restriction: string;
}

export interface Me {
  person: { id: number; email: string; name: string };
  pendingDishes: number;
  undecided: number;
}
