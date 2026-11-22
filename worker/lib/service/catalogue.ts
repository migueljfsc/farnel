/** Dishes, ingredients and restrictions. */

import type {
  DecidedStatus,
  DishAuthor,
  DishDetail,
  DishFeedback,
  DishIngredient,
  DishStatus,
  DishSummary,
  IngredientView,
  Restriction,
  RestrictionStatus,
  UndecidedItem,
  Unit,
} from "../../../shared/types";
import { idList, isUniqueViolation, rows } from "../db";
import { nameKey } from "../names";
import { costPerPortionCents, type DishFacts } from "../rules";

export interface IngredientLine {
  name: string;
  quantity: number;
  unit: Unit;
  priceCents?: number | null;
}

export interface DishInput {
  name: string;
  notes?: string;
  portions: number;
  repeatIntervalDays: number;
  tags: string[];
  ingredients: IngredientLine[];
}

export type UnitMismatch = { ok: false; error: "unit_mismatch"; ingredient: string };

// ---------------------------------------------------------------- restriction statuses

type Statuses = Record<number, RestrictionStatus>;

/** Statuses by ingredient id, for the given ingredients or all of them. */
async function loadStatuses(db: D1Database, ingredientIds?: number[]): Promise<Map<number, Statuses>> {
  const result = await rows<{ ingredientId: number; restrictionId: number; status: RestrictionStatus }>(
    db
      .prepare(
        `SELECT ingredient_id AS ingredientId, restriction_id AS restrictionId, status FROM ingredient_restrictions
         WHERE ?1 IS NULL OR ingredient_id IN (SELECT value FROM json_each(?1))`,
      )
      .bind(ingredientIds ? idList(ingredientIds) : null),
  );
  const map = new Map<number, Statuses>();
  for (const r of result) map.set(r.ingredientId, { ...map.get(r.ingredientId), [r.restrictionId]: r.status });
  return map;
}

async function undecidedIngredientIds(db: D1Database, dishId: number): Promise<number[]> {
  const result = await rows<{ id: number }>(
    db
      .prepare(
        `SELECT DISTINCT di.ingredient_id AS id FROM dish_ingredients di
         JOIN ingredient_restrictions ir ON ir.ingredient_id = di.ingredient_id
         WHERE di.dish_id = ?1 AND ir.status = 'unknown' ORDER BY id`,
      )
      .bind(dishId),
  );
  return result.map((r) => r.id);
}

// ---------------------------------------------------------------- dish records

interface DishRecord {
  id: number;
  name: string;
  notes: string;
  status: DishStatus;
  createdBy: DishAuthor;
  portions: number;
  repeatIntervalDays: number;
  tags: string[];
  lastCooked: string | null;
  ingredients: DishIngredient[];
}

interface DishQuery {
  ids?: number[];
  status?: DishStatus;
  tag?: string;
  /** A plan whose cookings do not count towards `lastCooked`. */
  excludePlanId?: number;
}

/**
 * The last time a dish was (or is planned to be) eaten: planned cookings, and cookings replaced by
 * the dish. Skipped cookings do not count.
 */
const LAST_COOKED = `
  SELECT dish_id AS dishId, MAX(cook_date) AS lastCooked FROM (
    SELECT dish_id, cook_date, plan_id FROM cookings WHERE status = 'planned'
    UNION ALL
    SELECT replaced_by_dish_id, cook_date, plan_id FROM cookings WHERE status = 'replaced' AND replaced_by_dish_id IS NOT NULL
  ) WHERE plan_id IS NOT ?1 GROUP BY dish_id`;

async function loadDishRecords(db: D1Database, query: DishQuery = {}): Promise<DishRecord[]> {
  const dishes = await rows<Omit<DishRecord, "tags" | "lastCooked" | "ingredients">>(
    db
      .prepare(
        `SELECT id, name, notes, status, created_by AS createdBy, portions, repeat_interval_days AS repeatIntervalDays FROM dishes
         WHERE (?1 IS NULL OR id IN (SELECT value FROM json_each(?1)))
           AND (?2 IS NULL OR status = ?2)
           AND (?3 IS NULL OR id IN (SELECT dish_id FROM dish_tags WHERE tag = ?3))
         ORDER BY name COLLATE NOCASE`,
      )
      .bind(query.ids ? idList(query.ids) : null, query.status ?? null, query.tag ?? null),
  );
  if (dishes.length === 0) return [];
  const ids = idList(dishes.map((d) => d.id));
  const [lines, tags, cooked] = await Promise.all([
    rows<Omit<DishIngredient, "statuses"> & { dishId: number }>(
      db
        .prepare(
          `SELECT di.dish_id AS dishId, i.id AS ingredientId, i.name, di.quantity, i.unit, i.price_cents AS priceCents
           FROM dish_ingredients di JOIN ingredients i ON i.id = di.ingredient_id
           WHERE di.dish_id IN (SELECT value FROM json_each(?1)) ORDER BY i.name COLLATE NOCASE`,
        )
        .bind(ids),
    ),
    rows<{ dishId: number; tag: string }>(
      db.prepare("SELECT dish_id AS dishId, tag FROM dish_tags WHERE dish_id IN (SELECT value FROM json_each(?1)) ORDER BY tag").bind(ids),
    ),
    rows<{ dishId: number; lastCooked: string }>(db.prepare(LAST_COOKED).bind(query.excludePlanId ?? null)),
  ]);
  const statuses = await loadStatuses(db, [...new Set(lines.map((l) => l.ingredientId))]);
  const lastCooked = new Map(cooked.map((c) => [c.dishId, c.lastCooked]));
  return dishes.map((d) => ({
    ...d,
    tags: tags.filter((t) => t.dishId === d.id).map((t) => t.tag),
    lastCooked: lastCooked.get(d.id) ?? null,
    ingredients: lines
      .filter((l) => l.dishId === d.id)
      .map((l) => ({ ingredientId: l.ingredientId, name: l.name, quantity: l.quantity, unit: l.unit, priceCents: l.priceCents, statuses: statuses.get(l.ingredientId) ?? {} })),
  }));
}

const toFacts = (d: DishRecord): DishFacts => ({
  id: d.id,
  status: d.status,
  portions: d.portions,
  repeatIntervalDays: d.repeatIntervalDays,
  lastCooked: d.lastCooked,
  ingredients: d.ingredients,
});

function toSummary(d: DishRecord): DishSummary {
  const cost = costPerPortionCents(toFacts(d));
  return {
    id: d.id,
    name: d.name,
    status: d.status,
    createdBy: d.createdBy,
    portions: d.portions,
    repeatIntervalDays: d.repeatIntervalDays,
    tags: d.tags,
    costPerPortionCents: cost.cents,
    missingPrice: cost.missingPrice,
    lastCooked: d.lastCooked,
  };
}

export async function loadDishFacts(db: D1Database, query: Pick<DishQuery, "ids" | "excludePlanId"> = {}): Promise<Map<number, DishFacts>> {
  return new Map((await loadDishRecords(db, query)).map((d) => [d.id, toFacts(d)]));
}

/** Summaries keyed by id, for callers that combine them with their own data. */
export async function loadDishSummaries(db: D1Database, query: DishQuery = {}): Promise<Map<number, DishSummary>> {
  return new Map((await loadDishRecords(db, query)).map((d) => [d.id, toSummary(d)]));
}

export async function listDishes(db: D1Database, filter: { status?: DishStatus; tag?: string } = {}): Promise<DishSummary[]> {
  return (await loadDishRecords(db, filter)).map(toSummary);
}

export async function getDish(db: D1Database, id: number): Promise<DishDetail | null> {
  const [record] = await loadDishRecords(db, { ids: [id] });
  if (!record) return null;
  const feedback = await rows<DishFeedback>(
    db
      .prepare(
        `SELECT f.cooking_id AS cookingId, c.cook_date AS date, f.person_id AS personId, p.name AS person, f.rating, f.comment
         FROM feedback f JOIN cookings c ON c.id = f.cooking_id JOIN people p ON p.id = f.person_id
         WHERE c.dish_id = ?1 ORDER BY c.cook_date DESC, p.name`,
      )
      .bind(id),
  );
  return { ...toSummary(record), notes: record.notes, ingredients: record.ingredients, feedback };
}

// ---------------------------------------------------------------- writing dishes

/**
 * Resolves ingredient lines to ids, creating the ingredients that do not exist yet (every
 * restriction `unknown`). A line whose unit differs from the existing ingredient's is refused
 * before anything is written. Repeated ingredients are summed.
 */
async function resolveLines(
  db: D1Database,
  lines: IngredientLine[],
  now: string,
): Promise<{ ok: true; lines: { ingredientId: number; quantity: number }[]; newIngredients: number[] } | UnitMismatch> {
  const keys = lines.map((l) => nameKey(l.name));
  const existing = new Map(
    (
      await rows<{ id: number; key: string; unit: Unit }>(
        db.prepare("SELECT id, name_key AS key, unit FROM ingredients WHERE name_key IN (SELECT value FROM json_each(?1))").bind(JSON.stringify(keys)),
      )
    ).map((r) => [r.key, r]),
  );
  const mismatch = lines.find((l, i) => {
    const found = existing.get(keys[i]);
    return found && found.unit !== l.unit;
  });
  if (mismatch) return { ok: false, error: "unit_mismatch", ingredient: mismatch.name };

  const quantities = new Map<number, number>();
  const newIngredients: number[] = [];
  for (const [i, line] of lines.entries()) {
    let id = existing.get(keys[i])?.id;
    if (id === undefined) {
      const price = line.priceCents ?? null;
      const row = await db
        .prepare("INSERT INTO ingredients (name, name_key, unit, price_cents, price_updated_at) VALUES (?1, ?2, ?3, ?4, ?5) RETURNING id")
        .bind(line.name.trim(), keys[i], line.unit, price, price === null ? null : now)
        .first<{ id: number }>();
      id = row!.id;
      await db.prepare("INSERT INTO ingredient_restrictions (ingredient_id, restriction_id, status) SELECT ?1, id, 'unknown' FROM restrictions").bind(id).run();
      existing.set(keys[i], { id, key: keys[i], unit: line.unit });
      newIngredients.push(id);
    }
    quantities.set(id, (quantities.get(id) ?? 0) + line.quantity);
  }
  return { ok: true, lines: [...quantities].map(([ingredientId, quantity]) => ({ ingredientId, quantity })), newIngredients };
}

const cleanTags = (tags: string[]): string[] => [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];

function contentStatements(db: D1Database, dishId: number, lines: { ingredientId: number; quantity: number }[], tags: string[]): D1PreparedStatement[] {
  return [
    db.prepare("DELETE FROM dish_ingredients WHERE dish_id = ?1").bind(dishId),
    db.prepare("DELETE FROM dish_tags WHERE dish_id = ?1").bind(dishId),
    ...lines.map((l) => db.prepare("INSERT INTO dish_ingredients (dish_id, ingredient_id, quantity) VALUES (?1, ?2, ?3)").bind(dishId, l.ingredientId, l.quantity)),
    ...cleanTags(tags).map((t) => db.prepare("INSERT INTO dish_tags (dish_id, tag) VALUES (?1, ?2)").bind(dishId, t)),
  ];
}

export async function createDish(
  db: D1Database,
  input: DishInput,
  createdBy: DishAuthor,
  now: string,
): Promise<{ ok: true; id: number; newIngredients: number[] } | UnitMismatch> {
  const resolved = await resolveLines(db, input.ingredients, now);
  if (!resolved.ok) return resolved;
  const row = await db
    .prepare(
      "INSERT INTO dishes (name, notes, portions, repeat_interval_days, status, created_by, created_at) VALUES (?1, ?2, ?3, ?4, 'pending', ?5, ?6) RETURNING id",
    )
    .bind(input.name.trim(), input.notes ?? "", input.portions, input.repeatIntervalDays, createdBy, now)
    .first<{ id: number }>();
  await db.batch(contentStatements(db, row!.id, resolved.lines, input.tags));
  return { ok: true, id: row!.id, newIngredients: resolved.newIngredients };
}

/** Replaces a dish's fields, ingredients and tags. The status does not change. */
export async function updateDish(
  db: D1Database,
  id: number,
  input: DishInput,
  now = new Date().toISOString(),
): Promise<{ ok: true; newIngredients: number[] } | { ok: false; error: "not_found" } | UnitMismatch> {
  const exists = await db.prepare("SELECT 1 FROM dishes WHERE id = ?1").bind(id).first();
  if (!exists) return { ok: false, error: "not_found" };
  const resolved = await resolveLines(db, input.ingredients, now);
  if (!resolved.ok) return resolved;
  await db.batch([
    db
      .prepare("UPDATE dishes SET name = ?2, notes = ?3, portions = ?4, repeat_interval_days = ?5 WHERE id = ?1")
      .bind(id, input.name.trim(), input.notes ?? "", input.portions, input.repeatIntervalDays),
    ...contentStatements(db, id, resolved.lines, input.tags),
  ]);
  return { ok: true, newIngredients: resolved.newIngredients };
}

export async function validateDish(
  db: D1Database,
  id: number,
): Promise<{ ok: true } | { ok: false; error: "not_found" | "not_pending" } | { ok: false; error: "undecided_ingredients"; ingredientIds: number[] }> {
  const dish = await db.prepare("SELECT status FROM dishes WHERE id = ?1").bind(id).first<{ status: DishStatus }>();
  if (!dish) return { ok: false, error: "not_found" };
  if (dish.status !== "pending") return { ok: false, error: "not_pending" };
  const ingredientIds = await undecidedIngredientIds(db, id);
  if (ingredientIds.length) return { ok: false, error: "undecided_ingredients", ingredientIds };
  await db.prepare("UPDATE dishes SET status = 'validated' WHERE id = ?1").bind(id).run();
  return { ok: true };
}

export async function archiveDish(db: D1Database, id: number): Promise<boolean> {
  const result = await db.prepare("UPDATE dishes SET status = 'archived' WHERE id = ?1").bind(id).run();
  return result.meta.changes > 0;
}

/** Back to `validated`, or to `pending` when an ingredient became undecided meanwhile. */
export async function unarchiveDish(db: D1Database, id: number): Promise<boolean> {
  const status: DishStatus = (await undecidedIngredientIds(db, id)).length ? "pending" : "validated";
  const result = await db.prepare("UPDATE dishes SET status = ?2 WHERE id = ?1 AND status = 'archived'").bind(id, status).run();
  return result.meta.changes > 0;
}

// ---------------------------------------------------------------- ingredients and restrictions

export async function listIngredients(db: D1Database): Promise<IngredientView[]> {
  const [ingredients, statuses] = await Promise.all([
    rows<Omit<IngredientView, "statuses">>(
      db.prepare(
        `SELECT id, name, unit, price_cents AS priceCents, price_source AS priceSource, price_updated_at AS priceUpdatedAt
         FROM ingredients ORDER BY name COLLATE NOCASE`,
      ),
    ),
    loadStatuses(db),
  ]);
  return ingredients.map((i) => ({ ...i, statuses: statuses.get(i.id) ?? {} }));
}

export async function updateIngredient(
  db: D1Database,
  id: number,
  patch: { name?: string; unit?: Unit; priceCents?: number | null; statuses?: Record<number, DecidedStatus> },
  now: string,
): Promise<"ok" | "not_found" | "name_taken"> {
  const exists = await db.prepare("SELECT 1 FROM ingredients WHERE id = ?1").bind(id).first();
  if (!exists) return "not_found";
  const statements: D1PreparedStatement[] = [];
  if (patch.name !== undefined) {
    statements.push(db.prepare("UPDATE ingredients SET name = ?2, name_key = ?3 WHERE id = ?1").bind(id, patch.name.trim(), nameKey(patch.name)));
  }
  if (patch.unit !== undefined) statements.push(db.prepare("UPDATE ingredients SET unit = ?2 WHERE id = ?1").bind(id, patch.unit));
  if (patch.priceCents !== undefined) {
    statements.push(
      db.prepare("UPDATE ingredients SET price_cents = ?2, price_source = 'estimated', price_updated_at = ?3 WHERE id = ?1").bind(id, patch.priceCents, now),
    );
  }
  for (const [restrictionId, status] of Object.entries(patch.statuses ?? {})) {
    statements.push(
      db
        .prepare(
          `INSERT INTO ingredient_restrictions (ingredient_id, restriction_id, status) VALUES (?1, ?2, ?3)
           ON CONFLICT (ingredient_id, restriction_id) DO UPDATE SET status = excluded.status`,
        )
        .bind(id, Number(restrictionId), status),
    );
  }
  if (statements.length === 0) return "ok";
  try {
    await db.batch(statements);
    return "ok";
  } catch (error) {
    if (isUniqueViolation(error)) return "name_taken";
    throw error;
  }
}

export async function listUndecided(db: D1Database): Promise<UndecidedItem[]> {
  return rows<UndecidedItem>(
    db.prepare(
      `SELECT i.id AS ingredientId, i.name AS ingredient, r.id AS restrictionId, r.name AS restriction
       FROM ingredient_restrictions ir JOIN ingredients i ON i.id = ir.ingredient_id JOIN restrictions r ON r.id = ir.restriction_id
       WHERE ir.status = 'unknown' ORDER BY i.name COLLATE NOCASE, r.name`,
    ),
  );
}

export async function listRestrictions(db: D1Database): Promise<Restriction[]> {
  return rows<Restriction>(db.prepare("SELECT id, name FROM restrictions ORDER BY name"));
}

/** A new restriction starts `unknown` on every existing ingredient. */
export async function createRestriction(db: D1Database, name: string): Promise<{ id: number } | "name_taken"> {
  try {
    const row = await db.prepare("INSERT INTO restrictions (name) VALUES (?1) RETURNING id").bind(name.trim()).first<{ id: number }>();
    await db.prepare("INSERT INTO ingredient_restrictions (ingredient_id, restriction_id, status) SELECT id, ?1, 'unknown' FROM ingredients").bind(row!.id).run();
    return { id: row!.id };
  } catch (error) {
    if (isUniqueViolation(error)) return "name_taken";
    throw error;
  }
}

export async function catalogueCounts(db: D1Database): Promise<{ pendingDishes: number; undecided: number }> {
  const row = await db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM dishes WHERE status = 'pending') AS pendingDishes,
              (SELECT COUNT(*) FROM ingredient_restrictions WHERE status = 'unknown') AS undecided`,
    )
    .first<{ pendingDishes: number; undecided: number }>();
  return row!;
}
