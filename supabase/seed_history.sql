-- Seed: historical tasks for AI assignee recommender
-- Inserts 12 completed tasks per team member so Claude has context to work with.
-- Safe to re-run: skips users who already have 10+ tasks.
--
-- Usage (against remote Supabase):
--   psql "$DATABASE_URL" -f supabase/seed_history.sql
-- Or paste into Supabase Studio → SQL Editor and run.

DO $$
DECLARE
  rec       RECORD;
  proj_id   UUID;
BEGIN
  -- Use first available project (or NULL if none exist)
  SELECT id INTO proj_id FROM projects WHERE is_archived = false ORDER BY created_at LIMIT 1;

  FOR rec IN SELECT id FROM profiles ORDER BY full_name LOOP
    -- Skip if user already has enough task history
    IF (SELECT COUNT(*) FROM tasks WHERE assignee_id = rec.id AND deleted_at IS NULL) >= 10 THEN
      CONTINUE;
    END IF;

    -- task_type po migracji 015: research/development/outreach/design/marketing/support/ops
    -- (mapowanie ze starego enumu: feature->development, bug->support, chore->ops)
    INSERT INTO tasks (title, type, status, priority, assignee_id, project_id, ai_suggested, created_at, updated_at)
    VALUES
      ('Feature: onboarding wizard — step 1',  'development', 'done', 'high',   rec.id, proj_id, false, NOW() - INTERVAL '90 days', NOW() - INTERVAL '88 days'),
      ('Bug: fix race condition in auth flow',   'support',    'done', 'urgent', rec.id, proj_id, false, NOW() - INTERVAL '85 days', NOW() - INTERVAL '84 days'),
      ('Research: evaluate third-party APIs',    'research',   'done', 'medium', rec.id, proj_id, false, NOW() - INTERVAL '80 days', NOW() - INTERVAL '78 days'),
      ('Feature: dashboard KPI cards',           'development', 'done', 'high',   rec.id, proj_id, false, NOW() - INTERVAL '75 days', NOW() - INTERVAL '73 days'),
      ('Chore: upgrade Next.js to v15',          'ops',        'done', 'low',    rec.id, proj_id, false, NOW() - INTERVAL '70 days', NOW() - INTERVAL '70 days'),
      ('Bug: broken pagination on backlog view', 'support',    'done', 'high',   rec.id, proj_id, false, NOW() - INTERVAL '65 days', NOW() - INTERVAL '64 days'),
      ('Design: sprint board card redesign',     'design',     'done', 'medium', rec.id, proj_id, false, NOW() - INTERVAL '60 days', NOW() - INTERVAL '58 days'),
      ('Feature: CSV export for goals',          'development', 'done', 'medium', rec.id, proj_id, false, NOW() - INTERVAL '55 days', NOW() - INTERVAL '53 days'),
      ('Research: performance profiling',        'research',   'done', 'high',   rec.id, proj_id, false, NOW() - INTERVAL '50 days', NOW() - INTERVAL '48 days'),
      ('Chore: add ESLint strict rules',         'ops',        'done', 'low',    rec.id, proj_id, false, NOW() - INTERVAL '45 days', NOW() - INTERVAL '45 days'),
      ('Feature: email notification digest',     'development', 'done', 'high',   rec.id, proj_id, false, NOW() - INTERVAL '40 days', NOW() - INTERVAL '38 days'),
      ('Bug: fix Supabase realtime disconnect',  'support',    'done', 'urgent', rec.id, proj_id, false, NOW() - INTERVAL '35 days', NOW() - INTERVAL '34 days');

    RAISE NOTICE 'Seeded 12 tasks for profile %', rec.id;
  END LOOP;
END;
$$;
