-- Migration 008: Extend profiles with skills, role, department, bio
-- Purpose: enables AI to use member skills for better task assignment

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS skills JSONB DEFAULT '[]';
-- Example value: ["React", "TypeScript", "PostgreSQL"]

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'developer';
-- Values: pm, developer, designer, engineer, researcher, marketing

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS department TEXT;
-- Optional grouping: Engineering, Design, Product, Marketing

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;
-- Short member bio for profile page

-- Index for AI workload queries filtering by role
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Allow authenticated users to update profiles (needed for team management)
-- Existing policy only allows self-update; add a team-management policy
-- Note: for a 3-person team, equal access is acceptable per design decision
