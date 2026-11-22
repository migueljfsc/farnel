/** Candidates, weekly plans, history, cooking outcomes, feedback and the shopping list. */

import type { Candidate, CookingStatus, CookingView, FeedbackView, Meal, PlanView, ShoppingList, Unit } from "../../../shared/types";
import { idList, rows } from "../db";
import { costPerPortionCents, eligibility, lineCostCents, mealKey, validatePlan, type PlanError, type PlanInput } from "../rules";
import { addDays } from "../../../shared/time";
import { loadDishes, loadDishFacts } from "./catalogue";
import { getSettings, hardRestrictionIds } from "./people";

const RECENT_COMMENTS = 3;
const MAX_COMMENT = 1000;

async function planIdForWeek(db: D1Database, weekStart: string): Promise<number | undefined> {
  const row = await db.prepare("SELECT id FROM plans WHERE week_start = ?1").bind(weekStart).first<{ id: number }>();
  return row?.id;
}

// ---------------------------------------------------------------- candidates

export async function listCandidates(db: D1Database, weekStart: string, today: string, tags: string[] = []): Promise<Candidate[]> {
  const excludePlanId = await planIdForWeek(db, weekStart);
  const onDate = weekStart > today ? weekStart : today;
  const [dishes, hard, ratings, comments, soft] = await Promise.all([
    loadDishes(db, { status: "validated", excludePlanId }),
    hardRestrictionIds(db),
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
      db.prepare(
        `SELECT p.name AS person, r.id AS restrictionId, r.name AS restriction
         FROM person_restrictions pr JOIN people p ON p.id = pr.person_id JOIN restrictions r ON r.id = pr.restriction_id
         WHERE pr.kind = 'soft' ORDER BY p.name, r.name`,
      ),
    ),
  ]);

  return dishes
    .filter(({ facts, summary }) => eligibility(facts, hard, onDate).length === 0 && (tags.length === 0 || tags.some((t) => summary.tags.includes(t))))
    .map(({ facts, summary }) => ({
      id: summary.id,
      name: summary.name,
      tags: summary.tags,
      portions: summary.portions,
      repeatIntervalDays: summary.repeatIntervalDays,
      lastCooked: summary.lastCooked,
      costPerPortionCents: summary.costPerPortionCents,
      missingPrice: summary.missingPrice,
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

  const weekEnd = addDays(input.weekStart, 6);
  const [dishes, hard, taken, settings] = await Promise.all([
    loadDishFacts(db, { ids: input.cookings.map((c) => c.dishId), excludePlanId: existing }),
    hardRestrictionIds(db),
    rows<Meal>(
      db
        .prepare(
          `SELECT m.date, m.slot FROM meals m JOIN cookings c ON c.id = m.cooking_id
           WHERE m.date BETWEEN ?1 AND ?2 AND c.plan_id IS NOT ?3`,
        )
        .bind(input.weekStart, weekEnd, existing ?? null),
    ),
    getSettings(db),
  ]);
  const errors = validatePlan(input, { dishes, hardRestrictionIds: hard, today, takenMeals: new Set(taken.map(mealKey)) });
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
  const [meals, feedback] = await Promise.all([
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
  ]);
  return cookings.map((c) => ({
    id: c.id,
    dishId: c.dishId,
    dish: c.dish,
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
    .first<Omit<PlanView, "overBudget" | "cookings">>();
  if (!plan) return null;
  return { ...plan, overBudget: plan.totalCents > plan.budgetCents, cookings: await loadCookings(db, { weekStart }, today, "ASC") };
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
      const exists = await db.prepare("SELECT 1 FROM dishes WHERE id = ?1").bind(change.dishId).first();
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
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || comment.length > MAX_COMMENT) return "invalid";
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

// ---------------------------------------------------------------- shopping list

export async function shoppingList(db: D1Database, weekStart: string): Promise<ShoppingList> {
  const lines = await rows<{ ingredientId: number; name: string; unit: Unit; priceCents: number | null; quantity: number }>(
    db
      .prepare(
        `SELECT i.id AS ingredientId, i.name, i.unit, i.price_cents AS priceCents, SUM(di.quantity * c.portions / d.portions) AS quantity
         FROM cookings c JOIN plans p ON p.id = c.plan_id JOIN dishes d ON d.id = c.dish_id
         JOIN dish_ingredients di ON di.dish_id = c.dish_id JOIN ingredients i ON i.id = di.ingredient_id
         WHERE p.week_start = ?1 AND c.status = 'planned'
         GROUP BY i.id ORDER BY i.name COLLATE NOCASE`,
      )
      .bind(weekStart),
  );
  const items = lines.map((l) => {
    const quantity = Math.round(l.quantity * 100) / 100;
    return { ingredientId: l.ingredientId, name: l.name, unit: l.unit, quantity, costCents: lineCostCents(quantity, l.unit, l.priceCents) };
  });
  return {
    items,
    totalCents: items.reduce((sum, i) => sum + (i.costCents ?? 0), 0),
    missingPrices: items.filter((i) => i.costCents === null).length,
  };
}
