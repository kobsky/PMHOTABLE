-- ============================================================
-- Hotable Compass — Migracja 004: Soft Delete + uzupełnienie schematu
-- Dodaje: deleted_at (soft delete), ai_suggested, brakujące enum values,
--         tabelę ai_feedback
-- ============================================================

-- ============================================================
-- BRAKUJĄCE WARTOŚCI ENUM
-- PostgreSQL 12+ pozwala ADD VALUE wewnątrz transakcji
-- ============================================================

-- task_status: dodaj 'in_review' (między in_progress a done)
alter type task_status add value if not exists 'in_review' after 'in_progress';

-- document_type: dodaj 'brief' (między spec a weekly_summary)
alter type document_type add value if not exists 'brief' after 'spec';

-- ============================================================
-- TASKS — soft delete + AI flag
-- ============================================================

-- Soft delete: zamiast usuwać wiersz, ustaw znacznik czasu
alter table tasks
  add column if not exists deleted_at timestamptz;

-- Flaga: czy zadanie zostało zasugerowane przez AI
alter table tasks
  add column if not exists ai_suggested boolean not null default false;

-- Indeks do filtrowania aktywnych zadań
create index if not exists tasks_deleted_at_idx on tasks (deleted_at)
  where deleted_at is null;

-- ============================================================
-- AI_FEEDBACK — śledzenie skuteczności funkcji AI
-- ============================================================

create table if not exists ai_feedback (
  id              uuid primary key default uuid_generate_v4(),
  feature         text not null
                  check (feature in (
                    'assignee_recommender',
                    'workload_balancing',
                    'auto_categorization'
                  )),
  task_id         uuid references tasks(id) on delete set null,
  suggestion      jsonb,
  accepted        boolean,
  override_value  jsonb,
  created_at      timestamptz default now() not null
);

alter table ai_feedback enable row level security;

create policy "ai_feedback_all" on ai_feedback
  for all
  using (auth.uid() is not null);

create index if not exists ai_feedback_feature_idx on ai_feedback (feature);
create index if not exists ai_feedback_task_idx    on ai_feedback (task_id);
