-- When a person marked the cooking as cooked; NULL until then. Only cooked meals use up stock.
ALTER TABLE cookings ADD COLUMN cooked_at TEXT;

-- The count is now a moment, so a meal cooked later the same day still comes off it.
ALTER TABLE ingredients RENAME COLUMN stock_date TO stock_counted_at;
