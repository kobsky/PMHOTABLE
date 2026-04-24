ALTER TABLE cycles
ADD COLUMN tolerance_percent INTEGER NOT NULL DEFAULT 20;

ALTER TABLE cycles
ADD CONSTRAINT tolerance_percent_range
CHECK (tolerance_percent BETWEEN 0 AND 100);
