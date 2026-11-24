/** Input schemas shared by the JSON API and the MCP tools. */

import { z } from "zod";
import { AISLES } from "../../shared/aisles";
import { isCalendarDate } from "../../shared/time";

export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD")
  .refine(isCalendarDate, "not a calendar date");
export const id = z.number().int().positive();
export const unit = z.enum(["g", "ml", "un"]);
export const slot = z.enum(["lunch", "dinner"]);
export const cents = z.number().int().nonnegative();
export const aisle = z.enum(AISLES);
export const proteinGrams = z.number().positive().max(5000).nullable();
const decided = z.record(z.string().regex(/^\d+$/), z.enum(["safe", "forbidden"]));

export const ingredientLine = z.object({
  name: z.string().trim().min(1).max(100),
  quantity: z.number().positive(),
  unit,
  priceCents: cents.nullable().optional().describe("Estimated price of 1000 g, 1000 ml or 1 un, for a new ingredient"),
  aisle: aisle.optional().describe("Supermarket aisle, for a new ingredient"),
  proteinGrams: proteinGrams.optional().describe("For a new protein ingredient (meat, fish, eggs, tofu…): its raw weight in grams per 1 g, 1 ml or 1 un, e.g. 1 for chicken in g, 60 for an egg in un"),
});

export const dishInput = z.object({
  name: z.string().trim().min(1).max(120),
  notes: z.string().max(4000).optional(),
  portions: z.number().int().min(1).max(50),
  repeatIntervalDays: z.number().int().min(0).max(365),
  tags: z.array(z.string().max(30)).max(20).default([]),
  ingredients: z.array(ingredientLine).min(1).max(50),
});

export const planInput = z.object({
  weekStart: date,
  notes: z.string().max(2000).optional(),
  peopleIds: z.array(id).min(1).max(20).optional().describe("Who eats this plan (ids from get_context); everyone when omitted"),
  cookings: z
    .array(
      z.object({
        dishId: id,
        cookDate: date,
        portions: z.number().int().min(1).max(50),
        meals: z.array(z.object({ date, slot })).max(14),
      }),
    )
    .max(14),
});

export const ingredientPatch = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  unit: unit.optional(),
  priceCents: cents.nullable().optional(),
  aisle: aisle.optional(),
  proteinGrams: proteinGrams.optional(),
  statuses: decided.optional(),
});

export const ingredientCreate = z.object({
  name: z.string().trim().min(1).max(100),
  unit,
  priceCents: cents.nullable().optional(),
  aisle,
  proteinGrams: proteinGrams.optional(),
  statuses: decided.default({}),
});

/** One dish for one or more meals of a week, chosen by hand. */
export const cookingAdd = z.object({
  dishId: id,
  meals: z.array(z.object({ date, slot })).min(1).max(14),
});

export const cookingChange = z.union([
  z.object({ status: z.enum(["planned", "skipped"]) }),
  z.object({ status: z.literal("replaced"), dishId: id.optional(), text: z.string().max(200).optional() }),
]);

export const MAX_COMMENT = 1000;
export const rating = z.number().int().min(1).max(5);
export const feedback = z.object({ rating, comment: z.string().max(MAX_COMMENT).default("") });

export const personUpdate = z.object({
  restrictions: z.array(z.object({ name: z.string().trim().min(1).max(40), kind: z.enum(["hard", "soft"]), weight: z.number().int().min(1).max(5) })).max(20),
  preferences: z.string().max(2000),
  never: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
});

export const personCreate = z.object({ email: z.email().max(254), name: z.string().trim().min(1).max(60) });

/** A selection of rows for a bulk action. */
export const ids = z.object({ ids: z.array(id).min(1).max(200) });

export const settings = z.object({ weeklyBudgetCents: cents, lunchesPerWeek: z.number().int().min(0).max(14), minProteinGrams: z.number().int().min(0).max(1000) });
