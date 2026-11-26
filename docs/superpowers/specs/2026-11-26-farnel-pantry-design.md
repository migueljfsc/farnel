# Farnel pantry

## Intent
Tell Farnel what ingredients are at home, in their own units, so that planning leans towards
dishes that use them and the shopping list only asks for what is missing. A soft guide: nothing
is forced or rejected because of stock.

## Approaches
- **Quantities per ingredient, consumed by cookings** (picked): a count and the day it was taken;
  what is available is the count minus what planned cookings use from that day on.
- A have / have-not flag: simpler, but cannot tell 100 g from 2 kg.
- Server-side ranking by stock: turns the nudge into a rule.

## Design
- **Data**: `ingredients.stock_quantity` (in the ingredient's unit, ≥ 0, NULL when never counted)
  and `ingredients.stock_date` (YYYY-MM-DD, Lisbon). Setting a count sets both; 0 means none.
- **Available** on a date `until` (exclusive), optionally ignoring the plan being replaced:
  `stock − Σ quantity × cooking.portions ÷ dish.portions` over cookings with status `planned`
  (skipped and replaced use nothing) and `stock_date ≤ cook_date < until`, never below 0. Without
  `until`, every planned cooking from the count on is subtracted (what is free for new plans).
- **Telling it**:
  - MCP tool `set_stock(items: {name, quantity, unit}[])`: matches existing ingredients by name
    (case/accents/spacing ignored), creates the missing ones (aisle misc, restrictions unknown),
    refuses a unit that differs from an existing ingredient's, per item.
  - Web: an "Em casa" column in the Ingredientes table, showing what is available; editing it
    records a new count dated today. Saved with the save bar.
  - `get_context` lists what is available (`stock`: name, quantity, unit).
- **Planning**: each `list_candidates` entry gets `pantry: { share, items }`: for each ingredient
  line, the part of the recipe covered by what is available at the start of the week (`until` =
  week start, replaced plan ignored); `share` = covered cost ÷ dish cost (0–1, two decimals);
  `items` = `{ name, have, need, unit }` for lines with any cover. Instructions: favour dishes
  with a higher share when otherwise comparable; never required.
- **Shopping list** for a week: what is available at the week start covers the week's needs
  first. Each item carries `fromStock` (amount covered) and `quantity` (still to buy, may be 0);
  cost counts only what is to buy. The UI lists fully covered items in an "Em casa" group and
  shows partial cover next to the quantity.

## Left to the builder
Rounding of quantities (2 decimals), wording, column layout.
