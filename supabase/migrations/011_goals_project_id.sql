-- Migration 011: link goals to projects
-- Adds nullable project_id FK to goals table so goals can be organized by project.

ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_goals_project_id ON goals(project_id);
