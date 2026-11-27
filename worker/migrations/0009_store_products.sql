-- A store product linked to an ingredient. amount: how much of the ingredient, in its unit, one
-- priced item gives; price_cents: the shelf price of that item. missing = 1 when the price source
-- no longer showed it at the last refresh (the last price is kept).
CREATE TABLE store_products (
  ingredient_id INTEGER NOT NULL REFERENCES ingredients (id) ON DELETE CASCADE,
  store TEXT NOT NULL CHECK (store IN ('continente', 'pingo_doce')),
  source_id TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  ean TEXT,
  pack_text TEXT,
  amount REAL NOT NULL CHECK (amount > 0),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  checked_at TEXT NOT NULL,
  refreshed_at TEXT NOT NULL,
  missing INTEGER NOT NULL DEFAULT 0 CHECK (missing IN (0, 1)),
  PRIMARY KEY (ingredient_id, store)
);

CREATE INDEX store_products_refreshed_at ON store_products (refreshed_at);
