# Farnel store prices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Link ingredients to Continente and Pingo Doce products through Poupando, refresh their prices daily in batches, and show per-ingredient and per-week-total store prices.

**Architecture:** Pack parsing in `shared/packs.ts` (used by the worker and the UI); a Poupando client with an injected `fetch`; a `stores` service owning `store_products`; the ingredient patch carries link changes and "use this price"; a `scheduled` handler runs the refresh; the shopping list adds per-store costs.

**Tech Stack:** Cloudflare Worker + D1 + Cron Triggers, zod, Vitest (worker + app), React.

**Spec:** `docs/superpowers/specs/2026-11-27-farnel-store-prices-design.md`

## Global Constraints
- Stores: `continente` ↔ Poupando `supermercado=Continente`; `pingo_doce` ↔ `Pingo Doce`. No others.
- Source: `GET https://poupando.pt/api/grupos?pesquisa=&supermercado=&limite=`; response is an array of groups, each an array of items.
- `ingredients.price_cents` stays cents per 1000 g, 1000 ml or 1 un; store price per ingredient unit = `round(price_cents ÷ amount × (unit = un ? 1 : 1000))`.
- Refresh: at most 40 links per run, skip links refreshed in the last 6 days, one request per link, sequential.
- Only a search phrase and a store name are sent to Poupando.
- Preço changes only by the person typing it or pressing "Usar".

## Review Focus
- Poupando answers non-JSON, 403 or a changed shape: search returns 502 `source_unavailable`; refresh leaves the link untouched (no `missing`, no `refreshed_at`) so it retries next run.
- Pack text with comma decimals and multipacks ("0,75 L", "emb. 20 x 8 gr", "3 x 1 L") parses to the total.
- An ingredient's unit changes after linking: its links are deleted in the same batch.
- A link whose product disappears keeps its last price, `missing = 1`; shopping totals still count it (Ruling below).
- `amount` 0, negative or absurd (> 1,000,000) is rejected by the schema.

Ruling: stale (`missing = 1`) links still count in shopping totals with their last price, marked stale in the UI. The spec says the last price is kept and shown as stale, and is silent on totals. Cost if wrong: a total can include a price Poupando stopped showing.

---

### Task 1: Pack parsing
**Files:** Create `shared/packs.ts`, `shared/packs.test.ts`.

**Interfaces:**
- Produces: `type Pack = { quantity: number; unit: Unit }`; `packOf(priceUnit: string | null, packText: string | null, name: string): Pack | null`; `amountFor(pack: Pack, ingredientUnit: Unit, gramsPerUnit?: number): number | null`.

- [ ] **Step 1: Failing tests** (`shared/packs.test.ts`):
  - `packOf("kg", null, "x")` → `{1000, g}`; `packOf("l", null, "x")` → `{1000, ml}`; `packOf("un", null, "x")` → `{1, un}`.
  - `packOf("embalagem", "emb. 110 gr", "x")` → `{110, g}`; `"0.15 Kg"` → `{150, g}`; `"0,75 L"` → `{750, ml}`; `"75 cl"` → `{750, ml}`; `"emb. 20 x 8 gr"` → `{160, g}`; `"6 un"` → `{6, un}`.
  - `packOf("embalagem", null, "SALSA FRESCA 50G")` → `{50, g}` (falls back to the name).
  - `packOf("embalagem", null, "Salsa Fresca")` → `null`.
  - `amountFor({1000, g}, "g")` → 1000; `amountFor({750, ml}, "ml")` → 750; `amountFor({6, un}, "un")` → 6; `amountFor({1000, g}, "un", 150)` → 6.67; `amountFor({1000, g}, "un")` → `null`; `amountFor({750, ml}, "g")` → `null`.
- [ ] **Step 2:** `pnpm vitest run shared/packs.test.ts`, expect FAIL (module missing).
- [ ] **Step 3:** Implement. One regex over `(\d+(?:[.,]\d+)?)\s*(?:x\s*(\d+(?:[.,]\d+)?)\s*)?(kg|gr|g|l|cl|ml|un)\b` (case-insensitive); kg→×1000 g, cl→×10 ml, l→×1000 ml; multiply count × size. `amountFor` rounds to 2 decimals.
- [ ] **Step 4:** Same command, expect PASS.
- [ ] **Step 5:** Commit `feat: parse store pack sizes`.

### Task 2: Schema, Poupando client, stores service
**Files:** Create `worker/migrations/0009_store_products.sql`, `worker/lib/poupando.ts`, `worker/lib/poupando.test.ts`, `worker/lib/service/stores.ts`, `worker/lib/service/stores.test.ts`; modify `shared/types.ts`.

**Interfaces:**
- Consumes: `packOf` (Task 1).
- Produces:
  - `shared/types.ts`: `type Store = "continente" | "pingo_doce"`; `STORES: readonly Store[]`; `interface StoreProduct { store: Store; sourceId: string; name: string; url: string; ean: string | null; packText: string | null; priceUnit: string | null; priceCents: number; checkedAt: string; pack: Pack | null }`; `interface StoreLinkInput { sourceId; name; url; ean; packText; amount: number; priceCents; checkedAt }`; `interface StoreLinkView extends StoreLinkInput { store: Store; unitPriceCents: number; missing: boolean; refreshedAt: string }`.
  - `worker/lib/poupando.ts`: `type Fetcher = typeof fetch`; `searchStore(fetcher: Fetcher, query: string, store: Store, limit = 10): Promise<StoreProduct[] | "unavailable">`.
  - `worker/lib/service/stores.ts`: `unitPriceCents(priceCents: number, amount: number, unit: Unit): number`; `storeLinks(db): Promise<Map<number, StoreLinkView[]>>` (by ingredient id); `linkStatements(db, ingredientId, changes: Partial<Record<Store, StoreLinkInput | null>>, now): D1PreparedStatement[]`; `refreshStorePrices(db, fetcher, now, limit = 40): Promise<{ refreshed: number; missing: number; failed: number }>`.

- [ ] **Step 1: Migration** `0009_store_products.sql`: table per spec (`ingredient_id INTEGER NOT NULL REFERENCES ingredients (id) ON DELETE CASCADE`, `store TEXT NOT NULL CHECK (store IN ('continente','pingo_doce'))`, `source_id`, `name`, `url`, `ean`, `pack_text`, `amount REAL NOT NULL CHECK (amount > 0)`, `price_cents INTEGER NOT NULL CHECK (price_cents >= 0)`, `checked_at`, `refreshed_at TEXT NOT NULL`, `missing INTEGER NOT NULL DEFAULT 0`, `UNIQUE (ingredient_id, store)`), index on `refreshed_at`.
- [ ] **Step 2: Failing tests** `poupando.test.ts` (fake fetcher returning canned JSON from a real 2026-11-27 response, trimmed):
  - Flattens groups, keeps only the asked store, maps `preco` 0.99 → `priceCents` 99, `ultima_atualizacao` → `checkedAt`, `pack` from `packOf`.
  - Sends `pesquisa`, `supermercado=Pingo Doce`, `limite` and no other parameters; URL host is `poupando.pt`.
  - Drops items failing the zod shape; returns `"unavailable"` on status 403, on non-JSON, and on a thrown fetch.
- [ ] **Step 3: Failing tests** `stores.test.ts`:
  - `unitPriceCents(169, 1000, "g")` → 169; `(99, 50, "g")` → 1980; `(169, 6.67, "un")` → 25.
  - `linkStatements` upsert then `null` removes; `storeLinks` returns `unitPriceCents` and `missing: false`.
  - Deleting the ingredient removes its links.
  - `refreshStorePrices`: updates price/`checkedAt` when `sourceId` is found; sets `missing` when not found; leaves the row untouched when the fetcher yields `"unavailable"` (counts `failed`); skips links refreshed < 6 days ago; refreshes oldest first and at most `limit`; searches by `ean` when present, else `name`.
- [ ] **Step 4:** `pnpm vitest run worker/lib/poupando.test.ts worker/lib/service/stores.test.ts`, expect FAIL.
- [ ] **Step 5:** Implement; fetch with `accept: application/json` and a generic `user-agent: farnel`; `AbortSignal.timeout(15000)`.
- [ ] **Step 6:** Same command, expect PASS. `pnpm vitest run worker/migrations.test.ts` PASS.
- [ ] **Step 7:** Commit `feat: store product links and Poupando price refresh`.

### Task 3: API, ingredient patch, cron
**Files:** Modify `worker/lib/schemas.ts` (+ test), `worker/lib/service/catalogue.ts` (+ test), `worker/api/catalogue.ts`, `worker/api.test.ts`, `worker/index.ts`, `worker/index.test.ts`, `wrangler.jsonc`, `shared/types.ts` (`IngredientView.stores: StoreLinkView[]`).

**Interfaces:**
- Consumes: Task 2 (`searchStore`, `linkStatements`, `storeLinks`, `refreshStorePrices`).
- Produces: `GET /api/store-search?q=&store=` → `{ products: StoreProduct[] }` or 502 `source_unavailable`, 400 `invalid` for an unknown store or empty `q`; `ingredientPatch` gains `stores?: Partial<Record<Store, storeLinkInput | null>>` and `priceFromStore?: Store`; `listIngredients` returns `stores`.

- [ ] **Step 1: Failing tests:**
  - Schema: `amount` 0, -1 and 1_000_001 rejected; unknown store key rejected.
  - `updateIngredient` with `stores` links and unlinks; with `unit` change deletes links; with `priceFromStore` sets `price_cents` to the link's unit price, `price_source` to the store, `price_updated_at` to `checked_at`; `priceFromStore` for an unlinked store returns `"not_found"`.
  - API: store-search 400 for `store=lidl`; ingredient list includes `stores`.
  - `index.test.ts`: the default export has `scheduled`, and it calls `refreshStorePrices` (assert rows change with a fake `fetch` stubbed via `vi.spyOn(globalThis, "fetch")`).
- [ ] **Step 2:** `pnpm vitest run --project worker`, expect the new tests FAIL.
- [ ] **Step 3:** Implement. `scheduled(controller, env, ctx)` → `ctx.waitUntil(refreshStorePrices(env.DB, fetch, new Date().toISOString()))`, logging the counts. `wrangler.jsonc`: `"triggers": { "crons": ["0 4 * * *"] }`.
- [ ] **Step 4:** Same command, expect PASS.
- [ ] **Step 5:** Commit `feat: store search API, links on ingredients, daily refresh`.

### Task 4: Shopping list per store
**Files:** Modify `shared/types.ts` (`ShoppingItem.storeCosts: Record<Store, number | null>`, `ShoppingList.stores: { store: Store; totalCents: number; missing: number }[]`), `worker/lib/service/planning.ts` (+ test), `worker/mcp/tools.ts` (+ test).

**Interfaces:**
- Consumes: `storeLinks`, `unitPriceCents` (Task 2), `lineCostCents` (rules).

- [ ] **Step 1: Failing tests:** two items, one linked at both stores, one only at Continente: `storeCosts` per item from `quantity` (after stock); `stores` totals and `missing` = 0 / 1; a fully covered item (quantity 0) costs 0 and is not missing; `get_shopping_list` data carries `stores` and its summary names each store's total.
- [ ] **Step 2:** `pnpm vitest run worker/lib/service/planning.test.ts worker/mcp/tools.test.ts`, expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Same command, expect PASS.
- [ ] **Step 5:** Commit `feat: shopping list totals per store`.

### Task 5: Web
**Files:** Modify `src/lib/ingredient-drafts.ts` (+ test), `src/pages/Ingredients.tsx`, `src/pages/Week.tsx`, `src/lib/shopping.ts` (+ test) if the cheaper-store logic lives there, `src/i18n/en.ts`, `src/i18n/pt.ts`; create `src/components/StoreSearch.tsx`.

**Interfaces:**
- Consumes: `IngredientView.stores`, `StoreProduct`, `packOf`/`amountFor`, store-search API, patch `stores` / `priceFromStore`, `ShoppingList.stores`, `ShoppingItem.storeCosts`.
- Produces: `Draft.stores?: Partial<Record<Store, StoreLinkInput | null>>`; `cheaperStore(costs: Record<Store, number | null>): Store | null` (null on a tie or a missing side).

- [ ] **Step 1: Failing tests:** `patchFor` includes `stores` only when changed and is invalid when a draft link has no positive `amount`; `cheaperStore` cases (both, tie, one missing).
- [ ] **Step 2:** `pnpm vitest run --project app`, expect FAIL.
- [ ] **Step 3:** Implement:
  - The edit row gets a "Lojas" block: per store, the link (name, pack, unit price, checked date, stale mark, remove) or "Procurar".
  - `StoreSearch` queries the API with the ingredient name prefilled, lists results, and on pick proposes `amountFor(pack, unit)`; it asks grams per unit when the ingredient is `un` and the pack is by weight.
  - The table shows both unit prices next to Preço (cheaper marked, stale greyed), with "Usar" → patch `priceFromStore` saved through the save bar.
  - Week's shopping list shows each item's cheaper store and the per-store totals with missing counts; the cheaper total is marked only when both have `missing` 0.
  - en and pt strings.
- [ ] **Step 4:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build`, all PASS; `pre-commit run --all-files` clean.
- [ ] **Step 5:** Browser check on the local dev servers: link salsa (g) and cebola (un, 150 g) at both stores, "Usar" one price, plan a week and read the shopping totals; check phone width.
- [ ] **Step 6:** Commit `feat: store prices in Ingredientes and the shopping list`; push to main; `GH_TOKEN=$(gh auth token --user migueljfsc) gh run watch` until the deploy (with migration 0009) passes.
