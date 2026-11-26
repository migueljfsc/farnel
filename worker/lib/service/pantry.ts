/**
 * What is at home. A count is taken on a day; from that day on, every planned cooking uses its
 * share of the recipe, so what is available goes down by itself until the next count.
 */

import type { Unit } from "../../../shared/types";
import { nameKey } from "../../../shared/names";
import { rows } from "../db";
import { createIngredient } from "./catalogue";

export interface StockLine {
  name: string;
  quantity: number;
  unit: Unit;
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Records counts dated `today`. Unknown names become new ingredients; a unit that differs from an
 * existing ingredient's is refused for that line only. Names come back as stored.
 */
export async function setStock(db: D1Database, lines: StockLine[], today: string, now: string): Promise<{ set: string[]; created: string[]; mismatched: string[] }> {
  const result = { set: [] as string[], created: [] as string[], mismatched: [] as string[] };
  for (const line of lines) {
    const key = nameKey(line.name);
    let found = await db.prepare("SELECT id, name, unit FROM ingredients WHERE name_key = ?1").bind(key).first<{ id: number; name: string; unit: Unit }>();
    if (found && found.unit !== line.unit) {
      result.mismatched.push(found.name);
      continue;
    }
    if (!found) {
      const created = await createIngredient(db, { name: line.name, unit: line.unit, aisle: "misc" }, now);
      if (created === "name_taken") continue;
      found = { id: created.id, name: line.name.trim(), unit: line.unit };
      result.created.push(found.name);
    }
    await db.prepare("UPDATE ingredients SET stock_quantity = ?2, stock_date = ?3 WHERE id = ?1").bind(found.id, line.quantity, today).run();
    result.set.push(found.name);
  }
  return result;
}

/**
 * What is left of each counted ingredient: its count minus what planned cookings from the count's
 * day on use, scaled to their portions. `until` (exclusive) stops at a date; `excludePlanId`
 * leaves out a plan being replaced. Skipped and replaced cookings use nothing.
 */
export async function availableStock(db: D1Database, { until, excludePlanId }: { until?: string; excludePlanId?: number } = {}): Promise<Map<number, number>> {
  const result = await rows<{ id: number; stock: number; used: number }>(
    db
      .prepare(
        `SELECT i.id, i.stock_quantity AS stock,
           COALESCE((SELECT SUM(di.quantity * c.portions * 1.0 / d.portions)
             FROM dish_ingredients di JOIN cookings c ON c.dish_id = di.dish_id JOIN dishes d ON d.id = c.dish_id
             WHERE di.ingredient_id = i.id AND c.status = 'planned' AND c.cook_date >= i.stock_date
               AND (?1 IS NULL OR c.cook_date < ?1) AND c.plan_id IS NOT ?2), 0) AS used
         FROM ingredients i WHERE i.stock_quantity IS NOT NULL`,
      )
      .bind(until ?? null, excludePlanId ?? null),
  );
  return new Map(result.map((r) => [r.id, round(Math.max(0, r.stock - r.used))]));
}

/** What is available now, for ingredients with any left, by name. */
export async function stockList(db: D1Database): Promise<StockLine[]> {
  const stock = await availableStock(db);
  const names = await rows<{ id: number; name: string; unit: Unit }>(db.prepare("SELECT id, name, unit FROM ingredients WHERE stock_quantity IS NOT NULL ORDER BY name COLLATE NOCASE"));
  return names.filter((n) => (stock.get(n.id) ?? 0) > 0).map((n) => ({ name: n.name, quantity: stock.get(n.id)!, unit: n.unit }));
}
