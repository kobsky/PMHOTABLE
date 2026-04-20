-- ============================================================
-- Hotable Compass — Migracja 002: Rozszerzenie schematu
-- Dodaje: task_type, document_status, goal_status, metryki OKR,
--         budget PARP, cycle velocity, idea source/tracking
-- ============================================================

-- ============================================================
-- NOWE TYPY ENUM
-- ============================================================

create type task_type as enum (
  'feature', 'bug', 'chore', 'research', 'design', 'marketing'
);

create type document_status as enum (
  'draft', 'review', 'accepted', 'deprecated', 'superseded'
);

create type goal_status as enum (
  'on_track', 'at_risk', 'off_track', 'achieved'
);

create type idea_source as enum (
  'founders_meeting', 'user_feedback', 'competitor', 'market', 'other'
);

-- ============================================================
-- TASKS — dodaj type
-- ============================================================

alter table tasks
  add column type task_type not null default 'feature';

-- ============================================================
-- DOCUMENTS — dodaj status
-- ============================================================

alter table documents
  add column status document_status not null default 'draft';

-- ============================================================
-- GOALS — dodaj status, metryki OKR, budget PARP
-- ============================================================

alter table goals
  add column status goal_status not null default 'on_track',
  add column target_value numeric,
  add column current_value numeric default 0,
  add column unit text,
  add column quarter text,
  add column budget_planned_pln numeric,
  add column budget_actual_pln numeric default 0;

-- ============================================================
-- CYCLES — dodaj velocity
-- ============================================================

alter table cycles
  add column velocity_planned integer,
  add column velocity_actual integer;

-- ============================================================
-- IDEAS — dodaj source i promoted_to_task_id
-- ============================================================

alter table ideas
  add column source idea_source not null default 'other',
  add column promoted_to_task_id uuid references tasks(id) on delete set null;
