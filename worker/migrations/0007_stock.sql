-- How much of an ingredient is at home, in its unit, and the day it was counted. NULL: never counted.
ALTER TABLE ingredients ADD COLUMN stock_quantity REAL CHECK (stock_quantity IS NULL OR stock_quantity >= 0);
ALTER TABLE ingredients ADD COLUMN stock_date TEXT;
