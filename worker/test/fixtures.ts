/** Direct-SQL builders for tests. Worker tests share one D1 per file: call `resetDb` first. */

import type { DishStatus, RestrictionStatus, Unit } from "../../shared/types";
import { nameKey } from "../../shared/names";

export async function resetDb(db: D1Database): Promise<void> {
  const tables = [
    "feedback",
    "meals",
    "cookings",
    "plans",
    "dish_tags",
    "dish_ingredients",
    "dishes",
    "ingredient_restrictions",
    "ingredients",
    "person_restrictions",
    "person_preferences",
    "people",
  ];
  await db.batch([
    ...tables.map((t) => db.prepare(`DELETE FROM ${t}`)),
    db.prepare("DELETE FROM restrictions WHERE name <> 'gluten'"),
    db.prepare("UPDATE settings SET weekly_budget_cents = 3000, lunches_per_week = 5, min_protein_grams = 0"),
  ]);
}

export async function restrictionId(db: D1Database, name = "gluten"): Promise<number> {
  const row = await db.prepare("SELECT id FROM restrictions WHERE name = ?1").bind(name).first<{ id: number }>();
  if (!row) throw new Error(`no restriction ${name}`);
  return row.id;
}

export async function addPerson(db: D1Database, email: string, name: string): Promise<number> {
  const row = await db.prepare("INSERT INTO people (email, name) VALUES (?1, ?2) RETURNING id").bind(email, name).first<{ id: number }>();
  return row!.id;
}

/** Two people, so a meal eats 2 portions. */
export async function addHousehold(db: D1Database): Promise<[number, number]> {
  return [await addPerson(db, "one@example.com", "One"), await addPerson(db, "two@example.com", "Two")];
}

export async function addPersonRestriction(db: D1Database, personId: number, restriction: number, kind: "hard" | "soft", weight = 1): Promise<void> {
  await db
    .prepare("INSERT INTO person_restrictions (person_id, restriction_id, kind, weight) VALUES (?1, ?2, ?3, ?4)")
    .bind(personId, restriction, kind, weight)
    .run();
}

/** Sets the household's minimum raw protein per portion. */
export async function setMinProtein(db: D1Database, grams: number): Promise<void> {
  await db.prepare("UPDATE settings SET min_protein_grams = ?1").bind(grams).run();
}

/** Every restriction not named in `statuses` gets `safe`. */
export async function addIngredient(
  db: D1Database,
  name: string,
  opts: { unit?: Unit; priceCents?: number | null; statuses?: Record<string, RestrictionStatus>; proteinGrams?: number } = {},
): Promise<number> {
  const row = await db
    .prepare("INSERT INTO ingredients (name, name_key, unit, price_cents, protein_grams) VALUES (?1, ?2, ?3, ?4, ?5) RETURNING id")
    .bind(name, nameKey(name), opts.unit ?? "g", opts.priceCents === undefined ? 100 : opts.priceCents, opts.proteinGrams ?? null)
    .first<{ id: number }>();
  const id = row!.id;
  const { results } = await db.prepare("SELECT id, name FROM restrictions").all<{ id: number; name: string }>();
  await db.batch(
    results.map((r) =>
      db
        .prepare("INSERT INTO ingredient_restrictions (ingredient_id, restriction_id, status) VALUES (?1, ?2, ?3)")
        .bind(id, r.id, opts.statuses?.[r.name] ?? "safe"),
    ),
  );
  return id;
}

export async function addDish(
  db: D1Database,
  name: string,
  opts: { portions?: number; interval?: number; status?: DishStatus; ingredients?: [number, number][]; tags?: string[] } = {},
): Promise<number> {
  const row = await db
    .prepare(
      "INSERT INTO dishes (name, portions, repeat_interval_days, status, created_by, created_at) VALUES (?1, ?2, ?3, ?4, 'person', '2026-01-01T00:00:00Z') RETURNING id",
    )
    .bind(name, opts.portions ?? 4, opts.interval ?? 14, opts.status ?? "validated")
    .first<{ id: number }>();
  const id = row!.id;
  const writes = [
    ...(opts.ingredients ?? []).map(([ingredient, quantity]) =>
      db.prepare("INSERT INTO dish_ingredients (dish_id, ingredient_id, quantity) VALUES (?1, ?2, ?3)").bind(id, ingredient, quantity),
    ),
    ...(opts.tags ?? []).map((tag) => db.prepare("INSERT INTO dish_tags (dish_id, tag) VALUES (?1, ?2)").bind(id, tag)),
  ];
  if (writes.length) await db.batch(writes);
  return id;
}

/** A plan with one cooking per entry, each covering the given lunches. */
export async function addPlan(
  db: D1Database,
  weekStart: string,
  cookings: { dishId: number; cookDate: string; portions?: number; meals?: string[]; status?: "planned" | "skipped" | "replaced"; replacedByDishId?: number }[],
): Promise<{ planId: number; cookingIds: number[] }> {
  const plan = await db
    .prepare("INSERT INTO plans (week_start, budget_cents, total_cents, created_at) VALUES (?1, 6000, 0, '') RETURNING id")
    .bind(weekStart)
    .first<{ id: number }>();
  const cookingIds: number[] = [];
  for (const c of cookings) {
    const row = await db
      .prepare(
        "INSERT INTO cookings (plan_id, dish_id, cook_date, portions, cost_cents, status, replaced_by_dish_id) VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6) RETURNING id",
      )
      .bind(plan!.id, c.dishId, c.cookDate, c.portions ?? 2, c.status ?? "planned", c.replacedByDishId ?? null)
      .first<{ id: number }>();
    cookingIds.push(row!.id);
    for (const date of c.meals ?? [c.cookDate]) {
      await db.prepare("INSERT INTO meals (date, slot, cooking_id) VALUES (?1, 'lunch', ?2)").bind(date, row!.id).run();
    }
  }
  return { planId: plan!.id, cookingIds };
}
