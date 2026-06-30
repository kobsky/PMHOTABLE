-- ============================================================
-- Hotable Compass — Migracja 018: Tier 0 — naprawy bezpieczeństwa
-- ============================================================
-- Forward-only. Nie edytuje migracji 001–017.
-- Adresuje findingi: BEZP-001, BEZP-008, BEZP-011, BEZP-012, BEZP-013.
-- ============================================================

-- ------------------------------------------------------------
-- BEZP-001 (KRYTYCZNY) — `profiles` czytane bez logowania (PII dla anon)
-- ------------------------------------------------------------
-- Polityka z 001_initial_schema.sql używała `using (true)`, co pozwalało
-- roli `anon` (klucz w bundlu klienta) odczytać całą tabelę profiles
-- (email, full_name, role, skills, bio) bez sesji.
-- Zawężamy do zalogowanych — jak każda inna tabela.
-- Pre-auth ścieżki (login, reset hasła) nie czytają profiles; akceptacja
-- zaproszenia (acceptInviteWithPassword) czyta profiles dopiero PO
-- signInWithPassword, więc ma już ważną sesję (auth.uid() != null).

drop policy if exists "profiles_select" on profiles;

create policy "profiles_select" on profiles
  for select
  using (auth.uid() is not null);

-- ------------------------------------------------------------
-- BEZP-008 — Polityki RLS bez jawnego `WITH CHECK`
-- ------------------------------------------------------------
-- Polityki `*_all` (FOR ALL) miały tylko `USING` bez jawnego `WITH CHECK`.
-- INSERT/UPDATE dziedziczą warunek niejawnie — odtwarzamy je z jawnym
-- `WITH CHECK (auth.uid() is not null)`. Zachowanie dla zalogowanego
-- użytkownika produkcyjnego pozostaje bez zmian.

drop policy if exists "projects_all" on projects;
create policy "projects_all" on projects
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists "cycles_all" on cycles;
create policy "cycles_all" on cycles
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists "tasks_all" on tasks;
create policy "tasks_all" on tasks
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists "documents_all" on documents;
create policy "documents_all" on documents
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists "goals_all" on goals;
create policy "goals_all" on goals
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists "ideas_all" on ideas;
create policy "ideas_all" on ideas
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- invite_tokens (utworzone w 006) — również tylko USING; dodaj WITH CHECK.
drop policy if exists "authenticated_invite_tokens" on invite_tokens;
create policy "authenticated_invite_tokens" on invite_tokens
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- ------------------------------------------------------------
-- BEZP-011 — `ai_feedback` tworzone dwukrotnie (dwie polityki RLS)
-- ------------------------------------------------------------
-- Tabela ai_feedback powstała w 004 (polityka "ai_feedback_all") i ponownie
-- w 005 (polityka "authenticated_ai_feedback"). CREATE TABLE IF NOT EXISTS
-- był no-op w 005, ale obie polityki RLS pozostały nałożone na tabelę.
-- Usuwamy duplikat z 005 i odtwarzamy jedną kanoniczną politykę z WITH CHECK.
-- NIE ruszamy tabeli ani danych.

drop policy if exists "authenticated_ai_feedback" on ai_feedback;
drop policy if exists "ai_feedback_all" on ai_feedback;
create policy "ai_feedback_all" on ai_feedback
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- ------------------------------------------------------------
-- BEZP-012 — Redundantny indeks + braki indeksów FK
-- ------------------------------------------------------------
-- `invite_tokens (token)` duplikuje indeks klucza głównego (token jest PK).
-- Indeks utworzony bez nazwy w 006 → Postgres nazwał go invite_tokens_token_idx.
drop index if exists invite_tokens_token_idx;

-- Brakujące indeksy FK używane w filtrach.
create index if not exists ideas_promoted_to_task_idx
  on ideas (promoted_to_task_id);

create index if not exists documents_author_idx
  on documents (author_id);

create index if not exists documents_project_idx
  on documents (project_id);

-- ------------------------------------------------------------
-- BEZP-013 — `parent_task_id = id` (self-parent) możliwy
-- ------------------------------------------------------------
-- Trigger check_task_nesting (001) blokował głębokość >1, ale nie
-- samo-referencji. Rozszerzamy funkcję o jawny guard. CREATE OR REPLACE
-- zachowuje istniejący trigger tasks_no_deep_nesting (wskazuje na tę funkcję).

create or replace function check_task_nesting()
returns trigger
language plpgsql
as $$
begin
  if new.parent_task_id is not null then
    -- Zadanie nie może być swoim własnym rodzicem
    if new.parent_task_id = new.id then
      raise exception 'Niedozwolone: zadanie nie może być swoim własnym rodzicem (self-parent)';
    end if;

    -- Max głębokość 1: subtask nie może mieć subtasków
    if exists (
      select 1 from tasks where id = new.parent_task_id and parent_task_id is not null
    ) then
      raise exception 'Niedozwolone zagnieżdżenie: subtask nie może mieć subtasków (max głębokość = 1)';
    end if;
  end if;
  return new;
end;
$$;
