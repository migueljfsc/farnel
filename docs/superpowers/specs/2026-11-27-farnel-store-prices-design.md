# Farnel store prices

## Intent
Know which supermarket is cheaper for what we cook: each ingredient shows its price at Continente
and Pingo Doce, and a week's shopping list shows what it would cost at each.

## Goals, non-goals, anti-goals
- Goals: per-ingredient price at each store, in the ingredient's own unit; per-store total for a
  week's shopping list; prices refreshed without anyone typing them.
- Non-goals: other stores (Auchan, Froiz, Lidl, Aldi, Intermarché, Mercadona); automatic matching
  of ingredients to products; filling a store cart; price history; card-only discounts; rounding
  quantities up to whole packs.
- Anti-goals: the weekly budget changing on its own; any running cost; more than a few hundred
  requests a week to the price source.

## Approaches
- **Poupando.pt as the source** (picked): one search endpoint (`GET https://poupando.pt/api/grupos`)
  already covers both stores with price, price unit, pack text, store URL, EAN and the date it was
  checked; it hides prices unchecked for 7 days. Undocumented and run by one person, so it can
  change or go away; the store URL of every link is kept so a direct reader can replace it.
- Scraping Continente and Pingo Doce directly: works from a Worker (tested 2026-11-27), but two
  parsers to keep alive and Pingo Doce lacks online prices for part of its range.
- Receipts: rejected by the household.

## Constraints
- Workers free plan: 50 outbound requests per invocation, so the refresh is spread over days.
- Prices in the app stay integer cents per 1000 g, 1000 ml or 1 un (`ingredients.price_cents`).
- Only text sent to Poupando is a search phrase (ingredient or product name) and a store name.

## Design
- **Stores**: `continente` (Poupando `supermercado=Continente`) and `pingo_doce` (`Pingo Doce`).
- **Data**: table `store_products`, one row per ingredient and store (`UNIQUE (ingredient_id,
  store)`, cascade on ingredient delete):
  - `store`, `source_id` (Poupando item `id`), `name`, `url`, `ean` (nullable), `pack_text`;
  - `amount`: how much of the ingredient, in its unit, one priced item gives (a kg of cebola with
    150 g per onion is 6.67 un; a 50 g bunch of salsa is 50 g; chicken sold per kg is 1000 g);
  - `price_cents` (shelf price of one priced item), `checked_at` (Poupando's
    `ultima_atualizacao`), `refreshed_at` (last time Farnel looked), `missing` (0/1: not found or
    hidden by Poupando at the last look; the last price is kept and shown as stale).
  - Price per ingredient unit = `price_cents ÷ amount × 1000` for g and ml, `× 1` for un, rounded
    to whole cents.
  - Changing an ingredient's unit deletes its store links.
- **Searching and linking** (web, Ingredientes edit row):
  - A "Lojas" block with one slot per store: linked product name, pack, price per ingredient
    unit, checked date, stale mark, remove.
  - "Procurar" searches that store through the worker (`GET /api/store-search?q=&store=`,
    proxying Poupando, 10 results), prefilled with the ingredient name.
  - Picking a result proposes `amount` from the pack text and price unit (`kg` → 1000 g, `l` →
    1000 ml, "emb. 110 gr", "0.15 Kg", "0.75 L", "20 x 8 gr", "6 un"); the person confirms or
    types it. When the ingredient is in un and the product is sold by weight, the person types
    grams per unit and Farnel works out `amount`.
  - Links are part of the row's draft and saved with the save bar.
- **Refresh**: a daily Cron Trigger refreshes the links with the oldest `refreshed_at`, at most 40
  per run, skipping any refreshed in the last 6 days. Each link is looked up by searching its
  `name` (or `ean` when known) with its store filter and matching `source_id`; found → price,
  `checked_at`, `missing = 0`; not found → `missing = 1`. Sequential requests, failures logged and
  retried next run.
- **Prices shown**:
  - Ingredientes table: each store's price per ingredient unit next to Preço, the cheaper one
    marked; stale prices greyed.
  - "Usar" next to a store price copies it into Preço (`price_source` = the store,
    `price_updated_at` = `checked_at`). Nothing else changes Preço.
  - The budget and planning keep using Preço.
- **Shopping list** for a week:
  - Each item shows which store is cheaper for it, when both have a price.
  - A total per store for what is still to buy (after stock), counting `quantity × store price`;
    items without a price at a store are counted as missing there and left out of its total.
  - The cheaper total is marked only when neither store has missing items.
  - `get_shopping_list` (MCP) returns the same totals: `stores: { store, totalCents, missing }[]`.

## Left to the builder
Pack-text parsing details beyond the examples, cron time, column layout, wording, how results
are shown in the search, zod schema of the Poupando response (validate and drop bad rows).
