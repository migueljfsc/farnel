-- Each ingredient belongs to a supermarket aisle, so the shopping list can be walked in order.
ALTER TABLE ingredients ADD COLUMN aisle TEXT NOT NULL DEFAULT 'misc'
  CHECK (aisle IN ('produce', 'bakery', 'butcher', 'fish', 'dairy', 'pantry', 'frozen', 'misc'));

-- A weekly budget for two people: 30 €, replacing the first default of 60 €.
UPDATE settings SET weekly_budget_cents = 3000 WHERE weekly_budget_cents = 6000;
