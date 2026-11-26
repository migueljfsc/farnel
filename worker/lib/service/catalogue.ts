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
import type { Aisle } from "../../../shared/aisles";
import { idList, isUniqueViolation, rows } from "../db";
import { nameKey } from "../../../shared/names";
import { costPerPortionCents, proteinPerPortionGrams, type DishFacts } from "../rules";
import { todayLisbon, weekStartOf } from "../../../shared/time";
import { availableStock } from "./pantry";

export interface IngredientLine {
  name: string;
  quantity: number;
  unit: Unit;
  priceCents?: number | null;
  aisle?: Aisle;
  proteinGrams?: number | null;
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

/** Restrictions someone has. Only these are asked about; others keep their decisions for later. */
const IN_USE = "(SELECT restriction_id FROM person_restrictions)";

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
         WHERE di.dish_id = ?1 AND ir.status = 'unknown' AND ir.restriction_id IN ${IN_USE} ORDER BY id`,
      )
      .bind(dishId),
  );
  return result.map((r) => r.id);
}

// ---------------------------------------------------------------- dish records

/** Dishes not deleted; a deleted dish only lives on in the history. */
const LIVE = "deleted_at IS NULL";

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
         WHERE deleted_at IS NULL
           AND (?1 IS NULL OR id IN (SELECT value FROM json_each(?1)))
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
          `SELECT di.dish_id AS dishId, i.id AS ingredientId, i.name, di.quantity, i.unit, i.price_cents AS priceCents, i.protein_grams AS proteinGrams
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
      .map((l) => ({
        ingredientId: l.ingredientId,
        name: l.name,
        quantity: l.quantity,
        unit: l.unit,
        priceCents: l.priceCents,
        proteinGrams: l.proteinGrams,
        statuses: statuses.get(l.ingredientId) ?? {},
      })),
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
  const facts = toFacts(d);
  const cost = costPerPortionCents(facts);
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
    proteinPerPortionGrams: proteinPerPortionGrams(facts),
    lastCooked: d.lastCooked,
  };
}

export async function loadDishFacts(db: D1Database, query: Pick<DishQuery, "ids" | "excludePlanId"> = {}): Promise<Map<number, DishFacts>> {
  return new Map((await loadDishRecords(db, query)).map((d) => [d.id, toFacts(d)]));
}

/** Each dish as rule facts and as a summary, for callers that need both. */
export async function loadDishes(db: D1Database, query: DishQuery = {}): Promise<{ facts: DishFacts; summary: DishSummary }[]> {
  return (await loadDishRecords(db, query)).map((d) => ({ facts: toFacts(d), summary: toSummary(d) }));
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
      id = await insertIngredient(
        db,
        { name: line.name, unit: line.unit, priceCents: line.priceCents ?? null, aisle: line.aisle ?? "misc", proteinGrams: line.proteinGrams ?? null },
        {},
        now,
      );
      existing.set(keys[i], { id, key: keys[i], unit: line.unit });
      newIngredients.push(id);
    }
    quantities.set(id, (quantities.get(id) ?? 0) + line.quantity);
  }
  return { ok: true, lines: [...quantities].map(([ingredientId, quantity]) => ({ ingredientId, quantity })), newIngredients };
}

/**
 * Inserts an ingredient and its restriction statuses in one batch, so it never exists without
 * them: `decided` ones as given, every other restriction `unknown`.
 */
async function insertIngredient(
  db: D1Database,
  input: { name: string; unit: Unit; priceCents: number | null; aisle: Aisle; proteinGrams: number | null },
  decided: Record<number, DecidedStatus>,
  now: string,
): Promise<number> {
  const key = nameKey(input.name);
  const [, , created] = await db.batch<{ id: number }>([
    db
      .prepare("INSERT INTO ingredients (name, name_key, unit, price_cents, price_updated_at, aisle, protein_grams) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)")
      .bind(input.name.trim(), key, input.unit, input.priceCents, input.priceCents === null ? null : now, input.aisle, input.proteinGrams),
    db
      .prepare(
        `INSERT INTO ingredient_restrictions (ingredient_id, restriction_id, status)
         SELECT (SELECT id FROM ingredients WHERE name_key = ?1), r.id, COALESCE(json_extract(?2, '$."' || r.id || '"'), 'unknown') FROM restrictions r`,
      )
      .bind(key, JSON.stringify(decided)),
    db.prepare("SELECT id FROM ingredients WHERE name_key = ?1").bind(key),
  ]);
  return created.results[0].id;
}

export async function createIngredient(
  db: D1Database,
  input: { name: string; unit: Unit; priceCents?: number | null; aisle: Aisle; proteinGrams?: number | null; statuses?: Record<number, DecidedStatus> },
  now: string,
): Promise<{ id: number } | "name_taken"> {
  try {
    const fields = { name: input.name, unit: input.unit, priceCents: input.priceCents ?? null, aisle: input.aisle, proteinGrams: input.proteinGrams ?? null };
    return { id: await insertIngredient(db, fields, input.statuses ?? {}, now) };
  } catch (error) {
    if (isUniqueViolation(error)) return "name_taken";
    throw error;
  }
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
  now: string,
): Promise<{ ok: true; newIngredients: number[] } | { ok: false; error: "not_found" } | UnitMismatch> {
  const exists = await db.prepare(`SELECT 1 FROM dishes WHERE id = ?1 AND ${LIVE}`).bind(id).first();
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
): Promise<{ ok: true } | { ok: false; error: "not_found" | "not_pending" | "no_ingredients" } | { ok: false; error: "undecided_ingredients"; ingredientIds: number[] }> {
  const dish = await db.prepare(`SELECT status FROM dishes WHERE id = ?1 AND ${LIVE}`).bind(id).first<{ status: DishStatus }>();
  if (!dish) return { ok: false, error: "not_found" };
  if (dish.status !== "pending") return { ok: false, error: "not_pending" };
  const ingredientIds = await undecidedIngredientIds(db, id);
  if (ingredientIds.length) return { ok: false, error: "undecided_ingredients", ingredientIds };
  // A dish with no ingredients would pass every restriction check unseen.
  const hasIngredients = await db.prepare("SELECT 1 FROM dish_ingredients WHERE dish_id = ?1").bind(id).first();
  if (!hasIngredients) return { ok: false, error: "no_ingredients" };
  await db.prepare("UPDATE dishes SET status = 'validated' WHERE id = ?1").bind(id).run();
  return { ok: true };
}

export async function archiveDish(db: D1Database, id: number): Promise<boolean> {
  const result = await db.prepare(`UPDATE dishes SET status = 'archived' WHERE id = ?1 AND ${LIVE}`).bind(id).run();
  return result.meta.changes > 0;
}

/** Back to `validated`, or to `pending` when an ingredient became undecided meanwhile. */
export async function unarchiveDish(db: D1Database, id: number): Promise<boolean> {
  const status: DishStatus = (await undecidedIngredientIds(db, id)).length ? "pending" : "validated";
  const result = await db.prepare(`UPDATE dishes SET status = ?2 WHERE id = ?1 AND status = 'archived' AND ${LIVE}`).bind(id, status).run();
  return result.meta.changes > 0;
}

// ---------------------------------------------------------------- ingredients and restrictions

export async function listIngredients(db: D1Database): Promise<IngredientView[]> {
  const [ingredients, statuses, stock] = await Promise.all([
    rows<Omit<IngredientView, "statuses" | "stock" | "inUse"> & { counted: number; used: number }>(
      db.prepare(
        `SELECT id, name, unit, aisle, price_cents AS priceCents, price_source AS priceSource, price_updated_at AS priceUpdatedAt, protein_grams AS proteinGrams,
                stock_quantity IS NOT NULL AS counted,
                EXISTS (SELECT 1 FROM dish_ingredients di WHERE di.ingredient_id = ingredients.id) AS used
         FROM ingredients ORDER BY name COLLATE NOCASE`,
      ),
    ),
    loadStatuses(db),
    availableStock(db),
  ]);
  return ingredients.map(({ counted, used, ...i }) => ({ ...i, stock: counted ? (stock.get(i.id) ?? 0) : null, inUse: used === 1, statuses: statuses.get(i.id) ?? {} }));
}

export async function updateIngredient(
  db: D1Database,
  id: number,
  patch: { name?: string; unit?: Unit; priceCents?: number | null; aisle?: Aisle; proteinGrams?: number | null; stock?: number | null; statuses?: Record<number, DecidedStatus> },
  now: string,
): Promise<"ok" | "not_found" | "name_taken" | "in_use"> {
  const current = await db.prepare("SELECT unit FROM ingredients WHERE id = ?1").bind(id).first<{ unit: Unit }>();
  if (!current) return "not_found";
  // Dish quantities are in the ingredient's unit; changing it would silently change every dish.
  if (patch.unit !== undefined && patch.unit !== current.unit) {
    const used = await db.prepare("SELECT 1 FROM dish_ingredients WHERE ingredient_id = ?1").bind(id).first();
    if (used) return "in_use";
  }
  const statements: D1PreparedStatement[] = [];
  if (patch.name !== undefined) {
    statements.push(db.prepare("UPDATE ingredients SET name = ?2, name_key = ?3 WHERE id = ?1").bind(id, patch.name.trim(), nameKey(patch.name)));
  }
  if (patch.unit !== undefined) statements.push(db.prepare("UPDATE ingredients SET unit = ?2 WHERE id = ?1").bind(id, patch.unit));
  if (patch.aisle !== undefined) statements.push(db.prepare("UPDATE ingredients SET aisle = ?2 WHERE id = ?1").bind(id, patch.aisle));
  if (patch.proteinGrams !== undefined) statements.push(db.prepare("UPDATE ingredients SET protein_grams = ?2 WHERE id = ?1").bind(id, patch.proteinGrams));
  if (patch.stock !== undefined) {
    const counted = patch.stock === null ? null : todayLisbon(new Date(now));
    statements.push(db.prepare("UPDATE ingredients SET stock_quantity = ?2, stock_date = ?3 WHERE id = ?1").bind(id, patch.stock, counted));
  }
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
       WHERE ir.status = 'unknown' AND ir.restriction_id IN ${IN_USE} ORDER BY i.name COLLATE NOCASE, r.name`,
    ),
  );
}

/** Restrictions someone has. */
export async function listRestrictions(db: D1Database): Promise<Restriction[]> {
  return rows<Restriction>(db.prepare(`SELECT id, name FROM restrictions WHERE id IN ${IN_USE} ORDER BY name`));
}

/**
 * The restriction with this name, created when new. A new restriction starts `unknown` on every
 * existing ingredient; an existing one keeps its decisions.
 */
export async function restrictionByName(db: D1Database, name: string): Promise<number> {
  const clean = name.trim().toLowerCase();
  const [, , found] = await db.batch<{ id: number }>([
    db.prepare("INSERT INTO restrictions (name) VALUES (?1) ON CONFLICT (name) DO NOTHING").bind(clean),
    db
      .prepare(
        `INSERT INTO ingredient_restrictions (ingredient_id, restriction_id, status)
         SELECT i.id, r.id, 'unknown' FROM ingredients i, restrictions r WHERE r.name = ?1
         ON CONFLICT (ingredient_id, restriction_id) DO NOTHING`,
      )
      .bind(clean),
    db.prepare("SELECT id FROM restrictions WHERE name = ?1").bind(clean),
  ]);
  return found.results[0].id;
}

export async function catalogueCounts(db: D1Database): Promise<{ pendingDishes: number; undecided: number }> {
  const row = await db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM dishes WHERE status = 'pending' AND ${LIVE}) AS pendingDishes,
              (SELECT COUNT(*) FROM ingredient_restrictions WHERE status = 'unknown' AND restriction_id IN ${IN_USE}) AS undecided`,
    )
    .first<{ pendingDishes: number; undecided: number }>();
  return row!;
}

// ---------------------------------------------------------------- deleting

export interface Deletion {
  deleted: number[];
  /** Kept: a dish planned this week or later, or an ingredient a dish uses. */
  blocked: number[];
}

/**
 * Deletes dishes not planned in the current or a later week. One that was never cooked goes
 * entirely; one in the history (eaten, or a replacement) keeps its row, marked deleted and
 * emptied of ingredients and tags, so past weeks still show its name.
 */
export async function deleteDishes(db: D1Database, ids: number[], today: string, now: string): Promise<Deletion> {
  const list = idList(ids);
  const [planned, cooked] = await Promise.all([
    rows<{ id: number }>(
      db
        .prepare(
          `SELECT DISTINCT c.dish_id AS id FROM cookings c JOIN plans p ON p.id = c.plan_id
           WHERE p.week_start >= ?2 AND c.dish_id IN (SELECT value FROM json_each(?1))`,
        )
        .bind(list, weekStartOf(today)),
    ),
    rows<{ id: number }>(
      db
        .prepare(
          `SELECT dish_id AS id FROM cookings WHERE dish_id IN (SELECT value FROM json_each(?1))
           UNION SELECT replaced_by_dish_id FROM cookings WHERE replaced_by_dish_id IN (SELECT value FROM json_each(?1))`,
        )
        .bind(list),
    ),
  ]);
  const blocked = new Set(planned.map((r) => r.id));
  const inHistory = new Set(cooked.map((r) => r.id));
  const deleted = ids.filter((id) => !blocked.has(id));
  const statements = deleted.flatMap((id) =>
    inHistory.has(id)
      ? [
          db.prepare("UPDATE dishes SET deleted_at = ?2 WHERE id = ?1").bind(id, now),
          db.prepare("DELETE FROM dish_ingredients WHERE dish_id = ?1").bind(id),
          db.prepare("DELETE FROM dish_tags WHERE dish_id = ?1").bind(id),
        ]
      : [db.prepare("DELETE FROM dishes WHERE id = ?1").bind(id)],
  );
  if (statements.length) await db.batch(statements);
  return { deleted, blocked: ids.filter((id) => blocked.has(id)) };
}

/** Deletes ingredients no dish uses. */
export async function deleteIngredients(db: D1Database, ids: number[]): Promise<Deletion> {
  const used = new Set(
    (
      await rows<{ id: number }>(
        db.prepare("SELECT DISTINCT ingredient_id AS id FROM dish_ingredients WHERE ingredient_id IN (SELECT value FROM json_each(?1))").bind(idList(ids)),
      )
    ).map((r) => r.id),
  );
  const deleted = ids.filter((id) => !used.has(id));
  if (deleted.length) await db.batch(deleted.map((id) => db.prepare("DELETE FROM ingredients WHERE id = ?1").bind(id)));
  return { deleted, blocked: ids.filter((id) => used.has(id)) };
}
