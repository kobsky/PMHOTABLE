-- T-Shirt sizing
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS size VARCHAR(4) DEFAULT 'M'
    CONSTRAINT tasks_size_check CHECK (size IN ('XS','S','M','L','XL','XXL'));

UPDATE tasks SET size = 'M' WHERE size IS NULL;

-- RACI matrix
-- Schema: { "responsible": "uuid", "accountable": ["uuid"], "consulted": ["uuid"], "informed": ["uuid"] }
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS raci JSONB DEFAULT NULL;
