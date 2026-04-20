-- Migration 014: Add base_capacity to profiles for capacity planning
-- skills and role already exist from migrations 008/009

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS base_capacity INTEGER DEFAULT 20;

COMMENT ON COLUMN profiles.base_capacity IS 'Story points capacity per sprint (default 20)';
