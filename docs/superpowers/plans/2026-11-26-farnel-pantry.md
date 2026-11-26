# Farnel pantry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Track ingredient stock and use it to nudge planning and trim the shopping list.

**Architecture:** Two columns on `ingredients`; a `pantry` service computes what is available from the count minus planned cookings; planning, the shopping list, the MCP tools and the Ingredientes page read it.

**Tech Stack:** Cloudflare Worker + D1, Vitest (worker + app), React.

**Spec:** `docs/superpowers/specs/2026-11-26-farnel-pantry-design.md`

## Global Constraints
- Quantities in the ingredient's unit (g, ml, un); rounded to 2 decimals in outputs.
- Stock never forces or rejects a dish.
- Skipped and replaced cookings use no stock.

## Review Focus
- A count taken on a date with cookings that same day: they are subtracted (the count is taken before cooking).
- Replanning a week: its own old plan must not reserve stock (`excludePlanId`).
- A dish ingredient with no price: the cover share ignores it rather than dividing by zero.
- Unit mismatch in `set_stock` reports the item and still applies the others.
- Shopping list cost counts only what is to buy.

---

### Task 1: Schema and pantry service
**Files:** `worker/migrations/0007_stock.sql`, `worker/lib/service/pantry.ts`, `worker/lib/service/pantry.test.ts`, `worker/test/fixtures.ts`.
- [x] Tests: `setStock` sets count and date, creates a missing ingredient, refuses a unit mismatch per item; `availableStock(db, { until?, excludePlanId? })` subtracts planned cookings from the count date on (scaled by portions), ignores skipped/replaced, earlier cookings, cookings on/after `until`, and the excluded plan; never below 0.
- [x] Implement `setStock(db, items, today, now): { set: string[]; created: string[]; mismatched: string[] }` and `availableStock(db, opts): Map<number, number>`.

### Task 2: Shopping list uses stock
**Files:** `shared/types.ts` (`ShoppingItem.fromStock`), `worker/lib/service/planning.ts`, its test.
- [x] Test: available stock at the week start covers needs; `quantity` is what is left to buy, `fromStock` the cover, cost only for what is to buy.

### Task 3: Candidates carry pantry cover
**Files:** `shared/types.ts` (`Candidate.pantry`), `worker/lib/service/planning.ts`, its test.
- [x] Test: `pantry.share` and `items` for a dish partly covered; zero share without stock.

### Task 4: Claude tools
**Files:** `worker/mcp/tools.ts`, `worker/mcp/server.ts`, tests, `worker/lib/schemas.ts`.
- [x] `set_stock` tool; `get_context.stock`; instructions favour pantry share; tests.

### Task 5: Web
**Files:** `shared/types.ts` (`IngredientView.stock`), `worker/lib/service/catalogue.ts` (`listIngredients` with available, `updateIngredient` `stock`), `worker/lib/schemas.ts`, `src/lib/ingredient-drafts.ts` + test, `src/pages/Ingredients.tsx`, `src/pages/Week.tsx`, i18n.
- [x] "Em casa" column (draft `stock`, saved with the bar); shopping list "Em casa" group and partial cover.
- [x] Verify in the browser, commit, push, watch the deploy.
