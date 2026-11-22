-- Dates are YYYY-MM-DD in Europe/Lisbon; timestamps are ISO 8601; money is integer cents.

CREATE TABLE people (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL
);

CREATE TABLE restrictions (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE
);

CREATE TABLE person_restrictions (
  person_id INTEGER NOT NULL REFERENCES people (id) ON DELETE CASCADE,
  restriction_id INTEGER NOT NULL REFERENCES restrictions (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('hard', 'soft')),
  weight INTEGER NOT NULL DEFAULT 1 CHECK (weight BETWEEN 1 AND 5),
  PRIMARY KEY (person_id, restriction_id)
);

CREATE TABLE person_preferences (
  person_id INTEGER PRIMARY KEY REFERENCES people (id) ON DELETE CASCADE,
  text TEXT NOT NULL DEFAULT ''
);

-- price_cents is the price of 1000 g, 1000 ml or 1 un.
CREATE TABLE ingredients (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL UNIQUE,
  unit TEXT NOT NULL CHECK (unit IN ('g', 'ml', 'un')),
  price_cents INTEGER CHECK (price_cents >= 0),
  price_source TEXT NOT NULL DEFAULT 'estimated',
  price_updated_at TEXT
);

CREATE TABLE ingredient_restrictions (
  ingredient_id INTEGER NOT NULL REFERENCES ingredients (id) ON DELETE CASCADE,
  restriction_id INTEGER NOT NULL REFERENCES restrictions (id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('safe', 'forbidden', 'unknown')),
  PRIMARY KEY (ingredient_id, restriction_id)
);

CREATE TABLE dishes (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  portions INTEGER NOT NULL CHECK (portions > 0),
  repeat_interval_days INTEGER NOT NULL CHECK (repeat_interval_days >= 0),
  status TEXT NOT NULL CHECK (status IN ('pending', 'validated', 'archived')),
  created_by TEXT NOT NULL CHECK (created_by IN ('person', 'claude')),
  created_at TEXT NOT NULL
);

CREATE TABLE dish_ingredients (
  dish_id INTEGER NOT NULL REFERENCES dishes (id) ON DELETE CASCADE,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients (id),
  quantity REAL NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (dish_id, ingredient_id)
);

CREATE TABLE dish_tags (
  dish_id INTEGER NOT NULL REFERENCES dishes (id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  PRIMARY KEY (dish_id, tag)
);

CREATE TABLE plans (
  id INTEGER PRIMARY KEY,
  week_start TEXT NOT NULL UNIQUE,
  budget_cents INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

-- 'done' is not stored: a 'planned' cooking whose cook_date is before today.
CREATE TABLE cookings (
  id INTEGER PRIMARY KEY,
  plan_id INTEGER NOT NULL REFERENCES plans (id) ON DELETE CASCADE,
  dish_id INTEGER NOT NULL REFERENCES dishes (id),
  cook_date TEXT NOT NULL,
  portions INTEGER NOT NULL CHECK (portions > 0),
  cost_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'skipped', 'replaced')),
  replaced_by_dish_id INTEGER REFERENCES dishes (id),
  replaced_by_text TEXT
);

CREATE INDEX cookings_dish_date ON cookings (dish_id, cook_date);
CREATE INDEX cookings_plan ON cookings (plan_id);

CREATE TABLE meals (
  date TEXT NOT NULL,
  slot TEXT NOT NULL CHECK (slot IN ('lunch', 'dinner')),
  cooking_id INTEGER NOT NULL REFERENCES cookings (id) ON DELETE CASCADE,
  PRIMARY KEY (date, slot)
);

CREATE INDEX meals_cooking ON meals (cooking_id);

CREATE TABLE feedback (
  cooking_id INTEGER NOT NULL REFERENCES cookings (id) ON DELETE CASCADE,
  person_id INTEGER NOT NULL REFERENCES people (id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (cooking_id, person_id)
);

CREATE TABLE settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  weekly_budget_cents INTEGER NOT NULL,
  lunches_per_week INTEGER NOT NULL
);

INSERT INTO restrictions (name) VALUES ('gluten');
INSERT INTO settings (id, weekly_budget_cents, lunches_per_week) VALUES (1, 6000, 5);
