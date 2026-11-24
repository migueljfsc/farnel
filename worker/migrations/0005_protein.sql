-- protein_grams: raw protein weight in 1 g, 1 ml or 1 un of the ingredient; NULL when it is not a protein.
ALTER TABLE ingredients ADD COLUMN protein_grams REAL CHECK (protein_grams IS NULL OR protein_grams > 0);

-- Meat and fish weighed in grams start out as protein.
UPDATE ingredients SET protein_grams = 1 WHERE unit = 'g' AND aisle IN ('butcher', 'fish');

-- Raw protein weight every portion needs.
ALTER TABLE settings ADD COLUMN min_protein_grams INTEGER NOT NULL DEFAULT 200 CHECK (min_protein_grams >= 0);
