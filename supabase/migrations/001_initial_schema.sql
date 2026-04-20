-- ============================================================
-- Hotable Compass — Schemat bazy danych (migracja 001)
-- ============================================================

-- Włącz UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- TYPY ENUM
-- ============================================================

create type task_status as enum ('todo', 'in_progress', 'done', 'cancelled');
create type task_priority as enum ('low', 'medium', 'high', 'urgent');
create type scope_tag as enum ('scope_1.0', 'scope_1.5', 'scope_2.0', 'grant_parp', 'marketing', 'ops');
create type document_type as enum ('adr', 'rfc', 'spec', 'weekly_summary');
create type goal_type as enum ('objective', 'key_result', 'grant_milestone');
create type idea_status as enum ('inbox', 'accepted', 'rejected', 'converted');

-- ============================================================
-- PROFILES (rozszerzenie auth.users)
-- ============================================================

create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

-- Automatycznie utwórz profil po rejestracji
create or replace function handle_new_user()
returns trigger
language plpgsql security definer
as $$
begin
  insert into profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- PROJECTS
-- ============================================================

create table projects (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  scope_tag   scope_tag not null,
  description text,
  color       text not null default '#848179',
  is_archived boolean not null default false,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

-- ============================================================
-- CYCLES (sprinty)
-- ============================================================

create table cycles (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  start_date  date not null,
  end_date    date not null,
  goal        text,
  is_active   boolean not null default false,
  created_at  timestamptz default now() not null,

  constraint cycles_dates_check check (end_date > start_date)
);

-- Gwarantuj jeden aktywny cykl na raz
create unique index cycles_single_active_idx
  on cycles (is_active)
  where is_active = true;

-- ============================================================
-- TASKS
-- ============================================================

create table tasks (
  id              uuid primary key default uuid_generate_v4(),
  title           text not null,
  description     text,
  status          task_status not null default 'todo',
  priority        task_priority not null default 'medium',
  project_id      uuid not null references projects(id) on delete cascade,
  assignee_id     uuid references profiles(id) on delete set null,
  parent_task_id  uuid references tasks(id) on delete cascade,
  cycle_id        uuid references cycles(id) on delete set null,
  due_date        date,
  position        integer not null default 0,
  created_at      timestamptz default now() not null,
  updated_at      timestamptz default now() not null
);

create index tasks_project_idx   on tasks (project_id);
create index tasks_assignee_idx  on tasks (assignee_id);
create index tasks_cycle_idx     on tasks (cycle_id);
create index tasks_status_idx    on tasks (status);
create index tasks_parent_idx    on tasks (parent_task_id);

-- Max głębokość 1: subtask nie może mieć subtasków
-- Trigger zamiast CHECK (PostgreSQL nie pozwala na subquery w CHECK)
create or replace function check_task_nesting()
returns trigger
language plpgsql
as $$
begin
  if new.parent_task_id is not null then
    if exists (
      select 1 from tasks where id = new.parent_task_id and parent_task_id is not null
    ) then
      raise exception 'Niedozwolone zagnieżdżenie: subtask nie może mieć subtasków (max głębokość = 1)';
    end if;
  end if;
  return new;
end;
$$;

create trigger tasks_no_deep_nesting
  before insert or update on tasks
  for each row execute function check_task_nesting();

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tasks_updated_at
  before update on tasks
  for each row execute function update_updated_at();

-- ============================================================
-- DOCUMENTS
-- ============================================================

create table documents (
  id          uuid primary key default uuid_generate_v4(),
  title       text not null,
  type        document_type not null,
  content     text not null default '',
  project_id  uuid references projects(id) on delete set null,
  author_id   uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

create trigger documents_updated_at
  before update on documents
  for each row execute function update_updated_at();

-- ============================================================
-- GOALS (OKR + milestony PARP)
-- ============================================================

create table goals (
  id              uuid primary key default uuid_generate_v4(),
  title           text not null,
  type            goal_type not null,
  description     text,
  progress        integer not null default 0 check (progress between 0 and 100),
  parent_goal_id  uuid references goals(id) on delete cascade,
  due_date        date,
  created_at      timestamptz default now() not null,
  updated_at      timestamptz default now() not null
);

create trigger goals_updated_at
  before update on goals
  for each row execute function update_updated_at();

-- ============================================================
-- IDEAS (Idea Inbox z ICE scoring)
-- ============================================================

create table ideas (
  id                uuid primary key default uuid_generate_v4(),
  title             text not null,
  description       text,
  status            idea_status not null default 'inbox',
  ice_impact        integer not null check (ice_impact between 1 and 10),
  ice_confidence    integer not null check (ice_confidence between 1 and 10),
  ice_ease          integer not null check (ice_ease between 1 and 10),
  ice_score         numeric(4,1) generated always as (
                      round((ice_impact + ice_confidence + ice_ease) / 3.0, 1)
                    ) stored,
  rejection_reason  text,
  author_id         uuid not null references profiles(id) on delete cascade,
  created_at        timestamptz default now() not null,
  updated_at        timestamptz default now() not null,

  -- rejection_reason wymagany przy odrzucaniu
  constraint ideas_rejection_reason_check check (
    status != 'rejected' or rejection_reason is not null
  )
);

create trigger ideas_updated_at
  before update on ideas
  for each row execute function update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Włącz RLS na wszystkich tabelach
alter table profiles   enable row level security;
alter table projects   enable row level security;
alter table cycles     enable row level security;
alter table tasks      enable row level security;
alter table documents  enable row level security;
alter table goals      enable row level security;
alter table ideas      enable row level security;

-- Helper: czy user jest zalogowany
create or replace function auth_uid()
returns uuid
language sql stable
as $$ select auth.uid() $$;

-- PROFILES — każdy widzi wszystkich (3-osobowy zespół)
create policy "profiles_select" on profiles for select using (true);
create policy "profiles_update" on profiles for update using (auth.uid() = id);

-- PROJECTS — wszyscy zalogowani
create policy "projects_all" on projects for all using (auth.uid() is not null);

-- CYCLES — wszyscy zalogowani
create policy "cycles_all" on cycles for all using (auth.uid() is not null);

-- TASKS — wszyscy zalogowani
create policy "tasks_all" on tasks for all using (auth.uid() is not null);

-- DOCUMENTS — wszyscy zalogowani
create policy "documents_all" on documents for all using (auth.uid() is not null);

-- GOALS — wszyscy zalogowani
create policy "goals_all" on goals for all using (auth.uid() is not null);

-- IDEAS — wszyscy zalogowani
create policy "ideas_all" on ideas for all using (auth.uid() is not null);

-- ============================================================
-- REALTIME (dla Sprint Board)
-- ============================================================

-- Włącz Realtime na tabeli tasks (filtrowane po cycle_id)
alter publication supabase_realtime add table tasks;

-- ============================================================
-- DANE TESTOWE (development)
-- ============================================================

-- Uruchom tylko lokalnie (supabase db reset)
do $$
begin
  if current_database() = 'postgres' then

    insert into projects (name, scope_tag, color) values
      ('Hotable MVP',     'scope_1.0',  '#4BAF87'),
      ('Grant PARP FEPW', 'grant_parp', '#F5A83A'),
      ('Marketing Q1',    'marketing',  '#E8622A');

  end if;
end $$;
