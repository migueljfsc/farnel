/**
 * Ingredients linked to store products, and the refresh that keeps their prices current. Links are
 * refreshed a few at a time, oldest first, so each run stays within the Worker's request budget.
 */

import { unitPriceCents } from "../../../shared/packs";
import type { Store } from "../../../shared/stores";
import type { StoreLinkInput, StoreLinkView, Unit } from "../../../shared/types";
import { rows } from "../db";
import { searchStore, type Fetcher } from "../poupando";

const REFRESH_EVERY_MS = 6 * 24 * 60 * 60 * 1000;

/** Every ingredient's store links, by ingredient id. */
export async function storeLinks(db: D1Database): Promise<Map<number, StoreLinkView[]>> {
  const links = await rows<Omit<StoreLinkView, "unitPriceCents" | "missing"> & { ingredientId: number; unit: Unit; missing: number }>(
    db.prepare(
      `SELECT s.ingredient_id AS ingredientId, i.unit, s.store, s.source_id AS sourceId, s.name, s.url, s.ean, s.pack_text AS packText, s.amount,
              s.price_cents AS priceCents, s.checked_at AS checkedAt, s.refreshed_at AS refreshedAt, s.missing
       FROM store_products s JOIN ingredients i ON i.id = s.ingredient_id ORDER BY s.store`,
    ),
  );
  const byIngredient = new Map<number, StoreLinkView[]>();
  for (const { ingredientId, unit, missing, ...link } of links) {
    const view = { ...link, missing: missing === 1, unitPriceCents: unitPriceCents(link.priceCents, link.amount, unit) };
    byIngredient.set(ingredientId, [...(byIngredient.get(ingredientId) ?? []), view]);
  }
  return byIngredient;
}

/** Statements that link (or, for null, unlink) an ingredient to a product per store. */
export function linkStatements(db: D1Database, ingredientId: number, changes: Partial<Record<Store, StoreLinkInput | null>>, now: string): D1PreparedStatement[] {
  return Object.entries(changes).map(([store, link]) =>
    link
      ? db
          .prepare(
            `INSERT INTO store_products (ingredient_id, store, source_id, name, url, ean, pack_text, amount, price_cents, checked_at, refreshed_at, missing)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 0)
             ON CONFLICT (ingredient_id, store) DO UPDATE SET source_id = excluded.source_id, name = excluded.name, url = excluded.url, ean = excluded.ean,
               pack_text = excluded.pack_text, amount = excluded.amount, price_cents = excluded.price_cents, checked_at = excluded.checked_at,
               refreshed_at = excluded.refreshed_at, missing = 0`,
          )
          .bind(ingredientId, store, link.sourceId, link.name, link.url, link.ean, link.packText, link.amount, link.priceCents, link.checkedAt, now)
      : db.prepare("DELETE FROM store_products WHERE ingredient_id = ?1 AND store = ?2").bind(ingredientId, store),
  );
}

/**
 * Looks up to `limit` links not refreshed in 6 days, oldest first, one request each: a product
 * still listed gets its current price, one no longer listed is marked missing, and a failed
 * request leaves the link for the next run.
 */
export async function refreshStorePrices(db: D1Database, fetcher: Fetcher, now: string, limit = 40): Promise<{ refreshed: number; missing: number; failed: number }> {
  const before = new Date(Date.parse(now) - REFRESH_EVERY_MS).toISOString();
  const due = await rows<{ ingredientId: number; store: Store; sourceId: string; name: string; ean: string | null }>(
    db
      .prepare(
        `SELECT ingredient_id AS ingredientId, store, source_id AS sourceId, name, ean FROM store_products
         WHERE refreshed_at <= ?1 ORDER BY refreshed_at, ingredient_id LIMIT ?2`,
      )
      .bind(before, limit),
  );
  const result = { refreshed: 0, missing: 0, failed: 0 };
  for (const link of due) {
    const products = await searchStore(fetcher, link.ean ?? link.name, link.store, 24);
    if (products === "unavailable") {
      result.failed++;
      continue;
    }
    const found = products.find((p) => p.sourceId === link.sourceId);
    const where = "WHERE ingredient_id = ?1 AND store = ?2";
    if (found) {
      result.refreshed++;
      await db
        .prepare(`UPDATE store_products SET price_cents = ?3, checked_at = ?4, refreshed_at = ?5, missing = 0 ${where}`)
        .bind(link.ingredientId, link.store, found.priceCents, found.checkedAt, now)
        .run();
    } else {
      result.missing++;
      await db.prepare(`UPDATE store_products SET refreshed_at = ?3, missing = 1 ${where}`).bind(link.ingredientId, link.store, now).run();
    }
  }
  return result;
}
