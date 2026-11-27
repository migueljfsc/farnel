/** Shapes shared by the Worker (API and MCP) and the web UI. Types only. */

import type { Aisle } from "./aisles";
import type { Pack } from "./packs";
import type { Store } from "./stores";

export type { Store };

export type Unit = "g" | "ml" | "un";

/** A product as the price source shows it. `priceCents` is the price of one priced item (a pack, a kg, a litre or a unit). */
export interface StoreProduct {
  store: Store;
  sourceId: string;
  name: string;
  url: string;
  ean: string | null;
  packText: string | null;
  priceUnit: string | null;
  priceCents: number;
  checkedAt: string;
  pack: Pack | null;
}

/** A store product linked to an ingredient; `amount` is how much of the ingredient, in its unit, one priced item gives. */
export interface StoreLinkInput {
  sourceId: string;
  name: string;
  url: string;
  ean: string | null;
  packText: string | null;
  amount: number;
  priceCents: number;
  checkedAt: string;
}

export interface StoreLinkView extends StoreLinkInput {
  store: Store;
  /** Price of 1000 g, 1000 ml or 1 un at this store. */
  unitPriceCents: number;
  /** The price source stopped showing it; the last price is kept. */
  missing: boolean;
  refreshedAt: string;
}
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
  /** Raw protein weight in 1 g, 1 ml or 1 un; null when it is not a protein. */
  proteinGrams: number | null;
  /** What is at home: the count minus meals marked cooked since, in its unit; null when never counted. */
  stock: number | null;
  /** The last count, before cooked meals used it up; null when never counted. */
  stockCount: number | null;
  /** A dish uses it, so its unit cannot change. */
  inUse: boolean;
  /** By restriction id. */
  statuses: Record<number, RestrictionStatus>;
  /** Products linked at each store, in store order. */
  stores: StoreLinkView[];
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
  /** Raw weight of its protein ingredients in one portion. */
  proteinPerPortionGrams: number;
  /** Ingredient names, sorted. */
  ingredientNames: string[];
  lastCooked: string | null;
}

export interface DishIngredient {
  ingredientId: number;
  name: string;
  quantity: number;
  unit: Unit;
  priceCents: number | null;
  proteinGrams: number | null;
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
  /** The dish's tags, sorted. */
  tags: string[];
  cookDate: string;
  portions: number;
  costCents: number;
  status: CookingStatus;
  /** Marked cooked by a person, which takes its ingredients off what is at home. */
  cooked: boolean;
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
  /** Still to buy, after what is at home. */
  quantity: number;
  /** Covered by what is at home. */
  fromStock: number;
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
  proteinPerPortionGrams: number;
  /** What is already at home: the share of the recipe's cost and the ingredients it covers. */
  pantry: { share: number; items: { name: string; have: number; need: number; unit: Unit }[] };
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
  /** Ingredients they never eat, by name. */
  never: string[];
  preferences: string;
}

export interface Settings {
  weeklyBudgetCents: number;
  lunchesPerWeek: number;
  /** Raw protein weight every portion needs. */
  minProteinGrams: number;
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

/** A dish offered for one meal of the week. */
export interface MealOption {
  id: number;
  name: string;
  tags: string[];
  portions: number;
  costPerPortionCents: number;
  missingPrice: boolean;
  lastCooked: string | null;
  /** Eaten more recently than its repeat interval allows; still allowed when chosen by hand. */
  tooSoon: boolean;
}
