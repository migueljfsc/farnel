/** Candidates, weekly plans, history, cooking outcomes, feedback and the shopping list. */

import type { Aisle } from "../../../shared/aisles";
import type { Candidate, CookingStatus, CookingView, FeedbackView, Meal, MealOption, PlanView, ShoppingList, Unit } from "../../../shared/types";
import { idList, rows } from "../db";
import { costPerPortionCents, eligibility, lineCostCents, mealKey, pantryCover, validatePlan, type PlanError, type PlanInput } from "../rules";
import { addDays } from "../../../shared/time";
import { MAX_COMMENT, rating as ratingSchema } from "../schemas";
import { loadDishes, loadDishFacts } from "./catalogue";
import { availableStock } from "./pantry";
import { getSettings, hardRestrictionIds, neverEaten, resolvePeople } from "./people";

const RECENT_COMMENTS = 3;

async function planIdForWeek(db: D1Database, weekStart: string): Promise<number | undefined> {
  const row = await db.prepare("SELECT id FROM plans WHERE week_start = ?1").bind(weekStart).first<{ id: number }>();
  return row?.id;
}

// ---------------------------------------------------------------- candidates

/** Dishes the people eating (everyone when not given) can have that week. */
export async function listCandidates(db: D1Database, weekStart: string, today: string, tags: string[] = [], peopleIds?: number[]): Promise<Candidate[]> {
  const people = peopleIds ? idList(peopleIds) : null;
  const excludePlanId = await planIdForWeek(db, weekStart);
  const onDate = weekStart > today ? weekStart : today;
  const [dishes, hard, ratings, comments, soft, settings, never, stock] = await Promise.all([
    loadDishes(db, { status: "validated", excludePlanId }),
    hardRestrictionIds(db, peopleIds),
    rows<{ dishId: number; personId: number; person: string; average: number; count: number }>(
      db.prepare(
        `SELECT c.dish_id AS dishId, f.person_id AS personId, p.name AS person, ROUND(AVG(f.rating), 1) AS average, COUNT(*) AS count
         FROM feedback f JOIN cookings c ON c.id = f.cooking_id JOIN people p ON p.id = f.person_id
         GROUP BY c.dish_id, f.person_id ORDER BY p.name`,
      ),
    ),
    rows<{ dishId: number; date: string; person: string; rating: number; comment: string }>(
      db.prepare(
        `SELECT c.dish_id AS dishId, c.cook_date AS date, p.name AS person, f.rating, f.comment
         FROM feedback f JOIN cookings c ON c.id = f.cooking_id JOIN people p ON p.id = f.person_id
         WHERE f.comment <> '' ORDER BY c.cook_date DESC, f.updated_at DESC`,
      ),
    ),
    rows<{ person: string; restrictionId: number; restriction: string }>(
      db
        .prepare(
        `SELECT p.name AS person, r.id AS restrictionId, r.name AS restriction
         FROM person_restrictions pr JOIN people p ON p.id = pr.person_id JOIN restrictions r ON r.id = pr.restriction_id
         WHERE pr.kind = 'soft' AND (?1 IS NULL OR pr.person_id IN (SELECT value FROM json_each(?1))) ORDER BY p.name, r.name`,
        )
        .bind(people),
    ),
    getSettings(db),
    neverEaten(db, peopleIds),
    availableStock(db, { until: weekStart, excludePlanId }),
  ]);

  return dishes
    .filter(({ facts, summary }) => eligibility(facts, hard, onDate, settings.minProteinGrams, never).length === 0 && (tags.length === 0 || tags.some((t) => summary.tags.includes(t))))
    .map(({ facts, summary }) => ({
      id: summary.id,
      name: summary.name,
      tags: summary.tags,
      portions: summary.portions,
      repeatIntervalDays: summary.repeatIntervalDays,
      lastCooked: summary.lastCooked,
      costPerPortionCents: summary.costPerPortionCents,
      missingPrice: summary.missingPrice,
      proteinPerPortionGrams: summary.proteinPerPortionGrams,
      pantry: pantryCover(facts, stock),
      ratings: ratings.filter((r) => r.dishId === summary.id).map(({ personId, person, average, count }) => ({ personId, person, average, count })),
      recentComments: comments
        .filter((c) => c.dishId === summary.id)
        .slice(0, RECENT_COMMENTS)
        .map(({ date, person, rating, comment }) => ({ date, person, rating, comment })),
      softFlags: soft
        .filter((s) => facts.ingredients.some((i) => i.statuses[s.restrictionId] === "forbidden"))
        .map(({ person, restriction }) => ({ person, restriction })),
    }));
}

// ---------------------------------------------------------------- saving a plan

export async function savePlan(
  db: D1Database,
  input: PlanInput,
  today: string,
  now: string,
): Promise<{ ok: true; plan: PlanView } | { ok: false; errors: PlanError[] }> {
  const existing = await planIdForWeek(db, input.weekStart);
  if (existing !== undefined) {
    const started = await db.prepare("SELECT 1 FROM cookings WHERE plan_id = ?1 AND cook_date < ?2").bind(existing, today).first();
    if (started) return { ok: false, errors: [{ code: "plan_locked" }] };
  }

  const eaters = await resolvePeople(db, input.peopleIds);
  if (!eaters || eaters.length === 0) return { ok: false, errors: [{ code: "unknown_person" }] };

  const weekEnd = addDays(input.weekStart, 6);
  const [dishes, hard, taken, settings, never] = await Promise.all([
    loadDishFacts(db, { ids: input.cookings.map((c) => c.dishId), excludePlanId: existing }),
    hardRestrictionIds(db, eaters),
    rows<Meal>(
      db
        .prepare(
          `SELECT m.date, m.slot FROM meals m JOIN cookings c ON c.id = m.cooking_id
           WHERE m.date BETWEEN ?1 AND ?2 AND c.plan_id IS NOT ?3`,
        )
        .bind(input.weekStart, weekEnd, existing ?? null),
    ),
    getSettings(db),
    neverEaten(db, eaters),
  ]);
  const errors = validatePlan(input, {
    dishes,
    hardRestrictionIds: hard,
    minProteinGrams: settings.minProteinGrams,
    neverEaten: never,
    eaters: eaters.length,
    today,
    takenMeals: new Set(taken.map(mealKey)),
  });
  if (errors.length) return { ok: false, errors };

  const costs = input.cookings.map((c) => costPerPortionCents(dishes.get(c.dishId)!).cents * c.portions);
  const total = costs.reduce((sum, cost) => sum + cost, 0);
  // Statements in a batch run in one transaction; later rows find their parent by the week and dish.
  const PLAN = "(SELECT id FROM plans WHERE week_start = ?1)";
  await db.batch([
    db.prepare("DELETE FROM plans WHERE week_start = ?1").bind(input.weekStart),
    db
      .prepare("INSERT INTO plans (week_start, budget_cents, total_cents, notes, created_at) VALUES (?1, ?2, ?3, ?4, ?5)")
      .bind(input.weekStart, settings.weeklyBudgetCents, total, input.notes ?? "", now),
    ...eaters.map((personId) => db.prepare(`INSERT INTO plan_people (plan_id, person_id) VALUES (${PLAN}, ?2)`).bind(input.weekStart, personId)),
    ...input.cookings.flatMap((c, i) => [
      db
        .prepare(`INSERT INTO cookings (plan_id, dish_id, cook_date, portions, cost_cents) VALUES (${PLAN}, ?2, ?3, ?4, ?5)`)
        .bind(input.weekStart, c.dishId, c.cookDate, c.portions, costs[i]),
      ...c.meals.map((m) =>
        db
          .prepare(`INSERT INTO meals (date, slot, cooking_id) SELECT ?3, ?4, id FROM cookings WHERE plan_id = ${PLAN} AND dish_id = ?2`)
          .bind(input.weekStart, c.dishId, m.date, m.slot),
      ),
    ]),
  ]);
  return { ok: true, plan: (await getPlan(db, input.weekStart, today))! };
}

// ---------------------------------------------------------------- adding one meal

/** Who eats in a week: its plan's people, or everyone when there is no plan yet. */
async function weekEaters(db: D1Database, weekStart: string): Promise<number[]> {
  const planned = await rows<{ id: number }>(
    db.prepare("SELECT pp.person_id AS id FROM plan_people pp JOIN plans p ON p.id = pp.plan_id WHERE p.week_start = ?1").bind(weekStart),
  );
  return planned.length ? planned.map((r) => r.id) : ((await resolvePeople(db)) ?? []);
}

/** Validated dishes every eater of the week can have on `date`, cheapest first; the ones eaten too recently last. */
export async function mealOptions(db: D1Database, weekStart: string, date: string, today: string): Promise<{ eaters: number; dishes: MealOption[] }> {
  const eaters = await weekEaters(db, weekStart);
  const [dishes, hard, settings, never] = await Promise.all([
    loadDishes(db, { status: "validated" }),
    hardRestrictionIds(db, eaters),
    getSettings(db),
    neverEaten(db, eaters),
  ]);
  const onDate = date > today ? date : today;
  const options = dishes.flatMap(({ facts, summary }) => {
    const codes = eligibility(facts, hard, onDate, settings.minProteinGrams, never);
    if (codes.some((code) => code !== "cooldown")) return [];
    const { id, name, tags, portions, costPerPortionCents, missingPrice, lastCooked } = summary;
    return [{ id, name, tags, portions, costPerPortionCents, missingPrice, lastCooked, tooSoon: codes.includes("cooldown") }];
  });
  options.sort((a, b) => Number(a.tooSoon) - Number(b.tooSoon) || a.costPerPortionCents - b.costPerPortionCents || a.name.localeCompare(b.name));
  return { eaters: eaters.length, dishes: options };
}

export interface CookingInput {
  weekStart: string;
  dishId: number;
  /** Cooked on the first meal's day; the rest are its leftovers. */
  meals: Meal[];
}

/**
 * Adds one cooking to a week, starting its plan (everyone eating, the current budget) when there
 * is none. Same checks as a whole plan, except a dish eaten recently is allowed: it was chosen by hand.
 */
export async function addCooking(db: D1Database, input: CookingInput, today: string, now: string): Promise<{ ok: true; id: number } | { ok: false; errors: PlanError[] }> {
  const meals = [...input.meals].sort((a, b) => mealKey(a).localeCompare(mealKey(b)));
  const cookDate = meals[0]?.date ?? input.weekStart;
  const eaters = await weekEaters(db, input.weekStart);
  if (eaters.length === 0) return { ok: false, errors: [{ code: "unknown_person" }] };
  const weekEnd = addDays(input.weekStart, 6);
  const [dishes, hard, taken, settings, never] = await Promise.all([
    loadDishFacts(db, { ids: [input.dishId] }),
    hardRestrictionIds(db, eaters),
    rows<Meal>(db.prepare("SELECT date, slot FROM meals WHERE date BETWEEN ?1 AND ?2").bind(input.weekStart, weekEnd)),
    getSettings(db),
    neverEaten(db, eaters),
  ]);
  const portions = meals.length * eaters.length;
  const cooking = { dishId: input.dishId, cookDate, portions, meals };
  const errors = validatePlan(
    { weekStart: input.weekStart, cookings: [cooking] },
    {
      dishes,
      hardRestrictionIds: hard,
      minProteinGrams: settings.minProteinGrams,
      neverEaten: never,
      eaters: eaters.length,
      today,
      takenMeals: new Set(taken.map(mealKey)),
    },
  ).filter((e) => e.code !== "cooldown");
  if (errors.length) return { ok: false, errors };

  const cost = costPerPortionCents(dishes.get(input.dishId)!).cents * portions;
  const PLAN = "(SELECT id FROM plans WHERE week_start = ?1)";
  const exists = await planIdForWeek(db, input.weekStart);
  const start =
    exists === undefined
      ? [
          db
            .prepare("INSERT INTO plans (week_start, budget_cents, total_cents, notes, created_at) VALUES (?1, ?2, 0, '', ?3)")
            .bind(input.weekStart, settings.weeklyBudgetCents, now),
          ...eaters.map((personId) => db.prepare(`INSERT INTO plan_people (plan_id, person_id) VALUES (${PLAN}, ?2)`).bind(input.weekStart, personId)),
        ]
      : [];
  const results = await db.batch([
    ...start,
    db
      .prepare(`INSERT INTO cookings (plan_id, dish_id, cook_date, portions, cost_cents) VALUES (${PLAN}, ?2, ?3, ?4, ?5)`)
      .bind(input.weekStart, input.dishId, cookDate, portions, cost),
    ...meals.map((m) =>
      db.prepare(`INSERT INTO meals (date, slot, cooking_id) SELECT ?2, ?3, MAX(id) FROM cookings WHERE plan_id = ${PLAN}`).bind(input.weekStart, m.date, m.slot),
    ),
    db.prepare("UPDATE plans SET total_cents = total_cents + ?2 WHERE week_start = ?1").bind(input.weekStart, cost),
  ]);
  return { ok: true, id: results[start.length].meta.last_row_id };
}

/** Takes a cooking off its plan, with its meals and its cost; only before its cook day. */
export async function removeCooking(db: D1Database, id: number, today: string): Promise<"ok" | "not_found" | "in_past"> {
  const cooking = await db.prepare("SELECT cook_date AS cookDate FROM cookings WHERE id = ?1").bind(id).first<{ cookDate: string }>();
  if (!cooking) return "not_found";
  if (cooking.cookDate < today) return "in_past";
  await db.batch([
    db.prepare("UPDATE plans SET total_cents = total_cents - (SELECT cost_cents FROM cookings WHERE id = ?1) WHERE id = (SELECT plan_id FROM cookings WHERE id = ?1)").bind(id),
    db.prepare("DELETE FROM meals WHERE cooking_id = ?1").bind(id),
    db.prepare("DELETE FROM feedback WHERE cooking_id = ?1").bind(id),
    db.prepare("DELETE FROM cookings WHERE id = ?1").bind(id),
  ]);
  return "ok";
}

// ---------------------------------------------------------------- reading cookings

interface CookingRow {
  id: number;
  dishId: number;
  dish: string;
  cookDate: string;
  portions: number;
  costCents: number;
  status: Exclude<CookingStatus, "done">;
  replacedByDishId: number | null;
  replacedByDish: string | null;
  replacedByText: string | null;
}

async function loadCookings(
  db: D1Database,
  filter: { weekStart: string } | { from: string; to: string },
  today: string,
  order: "ASC" | "DESC",
): Promise<CookingView[]> {
  const week = "weekStart" in filter ? filter.weekStart : null;
  const [from, to] = "from" in filter ? [filter.from, filter.to] : [null, null];
  const cookings = await rows<CookingRow>(
    db
      .prepare(
        `SELECT c.id, c.dish_id AS dishId, d.name AS dish, c.cook_date AS cookDate, c.portions, c.cost_cents AS costCents, c.status,
                c.replaced_by_dish_id AS replacedByDishId, rd.name AS replacedByDish, c.replaced_by_text AS replacedByText
         FROM cookings c JOIN plans p ON p.id = c.plan_id JOIN dishes d ON d.id = c.dish_id LEFT JOIN dishes rd ON rd.id = c.replaced_by_dish_id
         WHERE (?1 IS NULL OR p.week_start = ?1) AND (?2 IS NULL OR c.cook_date >= ?2) AND (?3 IS NULL OR c.cook_date <= ?3)
         ORDER BY c.cook_date ${order}, c.id ${order}`,
      )
      .bind(week, from, to),
  );
  if (cookings.length === 0) return [];
  const ids = idList(cookings.map((c) => c.id));
  const [meals, feedback, tags] = await Promise.all([
    rows<Meal & { cookingId: number }>(
      db
        .prepare("SELECT cooking_id AS cookingId, date, slot FROM meals WHERE cooking_id IN (SELECT value FROM json_each(?1)) ORDER BY date, slot = 'dinner'")
        .bind(ids),
    ),
    rows<FeedbackView & { cookingId: number }>(
      db
        .prepare(
          `SELECT f.cooking_id AS cookingId, f.person_id AS personId, p.name AS person, f.rating, f.comment
           FROM feedback f JOIN people p ON p.id = f.person_id WHERE f.cooking_id IN (SELECT value FROM json_each(?1)) ORDER BY p.name`,
        )
        .bind(ids),
    ),
    rows<{ dishId: number; tag: string }>(
      db
        .prepare("SELECT dish_id AS dishId, tag FROM dish_tags WHERE dish_id IN (SELECT value FROM json_each(?1)) ORDER BY tag")
        .bind(idList([...new Set(cookings.map((c) => c.dishId))])),
    ),
  ]);
  return cookings.map((c) => ({
    id: c.id,
    dishId: c.dishId,
    dish: c.dish,
    tags: tags.filter((t) => t.dishId === c.dishId).map((t) => t.tag),
    cookDate: c.cookDate,
    portions: c.portions,
    costCents: c.costCents,
    status: c.status === "planned" && c.cookDate < today ? "done" : c.status,
    replacedBy:
      c.status !== "replaced"
        ? null
        : c.replacedByDishId !== null
          ? { dishId: c.replacedByDishId, dish: c.replacedByDish ?? "" }
          : { text: c.replacedByText ?? "" },
    meals: meals.filter((m) => m.cookingId === c.id).map(({ date, slot }) => ({ date, slot })),
    feedback: feedback.filter((f) => f.cookingId === c.id).map(({ personId, person, rating, comment }) => ({ personId, person, rating, comment })),
  }));
}

export async function getPlan(db: D1Database, weekStart: string, today: string): Promise<PlanView | null> {
  const plan = await db
    .prepare("SELECT week_start AS weekStart, budget_cents AS budgetCents, total_cents AS totalCents, notes FROM plans WHERE week_start = ?1")
    .bind(weekStart)
    .first<Omit<PlanView, "overBudget" | "cookings" | "people">>();
  if (!plan) return null;
  const [people, cookings] = await Promise.all([
    rows<{ id: number; name: string }>(
      db
        .prepare(
          `SELECT p.id, p.name FROM plan_people pp JOIN people p ON p.id = pp.person_id
           WHERE pp.plan_id = (SELECT id FROM plans WHERE week_start = ?1) ORDER BY p.id`,
        )
        .bind(weekStart),
    ),
    loadCookings(db, { weekStart }, today, "ASC"),
  ]);
  return { ...plan, overBudget: plan.totalCents > plan.budgetCents, people, cookings };
}

/** Cookings dated within [from, to], newest first. */
export async function history(db: D1Database, from: string, to: string, today: string): Promise<CookingView[]> {
  return loadCookings(db, { from, to }, today, "DESC");
}

// ---------------------------------------------------------------- outcomes and feedback

export type CookingChange = { status: "planned" | "skipped" } | { status: "replaced"; dishId?: number; text?: string };

export async function setCookingStatus(db: D1Database, id: number, change: CookingChange): Promise<"ok" | "not_found" | "invalid"> {
  let dishId: number | null = null;
  let text: string | null = null;
  if (change.status === "replaced") {
    const byDish = change.dishId !== undefined;
    const byText = change.text !== undefined && change.text.trim() !== "";
    if (byDish === byText) return "invalid";
    if (byDish) {
      const exists = await db.prepare("SELECT 1 FROM dishes WHERE id = ?1 AND deleted_at IS NULL").bind(change.dishId).first();
      if (!exists) return "invalid";
      dishId = change.dishId!;
    } else text = change.text!.trim();
  }
  const result = await db
    .prepare("UPDATE cookings SET status = ?2, replaced_by_dish_id = ?3, replaced_by_text = ?4 WHERE id = ?1")
    .bind(id, change.status, dishId, text)
    .run();
  return result.meta.changes > 0 ? "ok" : "not_found";
}

export async function setFeedback(
  db: D1Database,
  cookingId: number,
  personId: number,
  rating: number,
  comment: string,
  now: string,
): Promise<"ok" | "not_found" | "invalid"> {
  if (!ratingSchema.safeParse(rating).success || comment.length > MAX_COMMENT) return "invalid";
  const exists = await db.prepare("SELECT 1 FROM cookings WHERE id = ?1").bind(cookingId).first();
  if (!exists) return "not_found";
  await db
    .prepare(
      `INSERT INTO feedback (cooking_id, person_id, rating, comment, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)
       ON CONFLICT (cooking_id, person_id) DO UPDATE SET rating = excluded.rating, comment = excluded.comment, updated_at = excluded.updated_at`,
    )
    .bind(cookingId, personId, rating, comment.trim(), now)
    .run();
  return "ok";
}

/** Monday of every week with a plan between `from` and `to`. */
export async function plannedWeeks(db: D1Database, from: string, to: string): Promise<string[]> {
  const result = await rows<{ weekStart: string }>(
    db.prepare("SELECT week_start AS weekStart FROM plans WHERE week_start BETWEEN ?1 AND ?2 ORDER BY week_start").bind(from, to),
  );
  return result.map((r) => r.weekStart);
}

// ---------------------------------------------------------------- shopping list

/** The week's ingredients; what was left at home when the week starts covers them first. */
export async function shoppingList(db: D1Database, weekStart: string): Promise<ShoppingList> {
  const stock = await availableStock(db, { until: weekStart });
  const lines = await rows<{ ingredientId: number; name: string; unit: Unit; aisle: Aisle; priceCents: number | null; quantity: number }>(
    db
      .prepare(
        `SELECT i.id AS ingredientId, i.name, i.unit, i.aisle, i.price_cents AS priceCents, SUM(di.quantity * c.portions / d.portions) AS quantity
         FROM cookings c JOIN plans p ON p.id = c.plan_id JOIN dishes d ON d.id = c.dish_id
         JOIN dish_ingredients di ON di.dish_id = c.dish_id JOIN ingredients i ON i.id = di.ingredient_id
         WHERE p.week_start = ?1 AND c.status = 'planned'
         GROUP BY i.id ORDER BY i.name COLLATE NOCASE`,
      )
      .bind(weekStart),
  );
  const round = (n: number) => Math.round(n * 100) / 100;
  const items = lines.map((l) => {
    const needed = round(l.quantity);
    const fromStock = Math.min(stock.get(l.ingredientId) ?? 0, needed);
    const quantity = round(needed - fromStock);
    return { ingredientId: l.ingredientId, name: l.name, unit: l.unit, aisle: l.aisle, quantity, fromStock, costCents: lineCostCents(quantity, l.unit, l.priceCents) };
  });
  return {
    items,
    totalCents: items.reduce((sum, i) => sum + (i.costCents ?? 0), 0),
    missingPrices: items.filter((i) => i.costCents === null).length,
  };
}
