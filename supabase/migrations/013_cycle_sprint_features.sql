-- Sprint Notes
ALTER TABLE cycles
  ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL;

-- Sprint Links: [{ "id": "uuid", "title": "...", "url": "...", "label": "blocker|info|doc" }]
ALTER TABLE cycles
  ADD COLUMN IF NOT EXISTS sprint_links JSONB DEFAULT '[]'::jsonb;

-- Team Unavailability: { "user_id": [{ "date": "2026-04-25", "reason": "wakacje" }] }
ALTER TABLE cycles
  ADD COLUMN IF NOT EXISTS unavailability JSONB DEFAULT '{}'::jsonb;
