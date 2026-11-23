-- A deleted dish that was eaten before stays as a row so the history keeps its name; it leaves
-- every list. Dishes never cooked are deleted outright.
ALTER TABLE dishes ADD COLUMN deleted_at TEXT;
