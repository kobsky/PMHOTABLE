-- Migration 005: ai_feedback table for tracking AI feature effectiveness
-- Run after: 004_soft_delete.sql

CREATE TABLE IF NOT EXISTS ai_feedback (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature         TEXT NOT NULL CHECK (feature IN ('auto_categorization', 'assignee_recommender', 'workload_balancing')),
  task_id         UUID REFERENCES tasks(id) ON DELETE SET NULL,
  suggestion      JSONB,
  accepted        BOOLEAN,
  override_value  JSONB,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE ai_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_ai_feedback" ON ai_feedback
  FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_ai_feedback_feature  ON ai_feedback(feature);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_task_id  ON ai_feedback(task_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_accepted ON ai_feedback(accepted);
