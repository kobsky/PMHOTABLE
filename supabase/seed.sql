-- ============================================================
-- Hotable Compass — seed.sql
-- Dane developerskie: 3 użytkowników + 10 zadań
-- Uruchamiane TYLKO przez: supabase db reset (nie przez db push)
-- ============================================================

-- ============================================================
-- UŻYTKOWNICY (auth.users → trigger auto-tworzy profiles)
-- Stałe UUID dla spójności między resetami bazy
-- ============================================================

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'authenticated', 'authenticated',
    'ania@hotable.pl',
    crypt('dev123', gen_salt('bf')),
    now(),
    '{"provider": "email", "providers": ["email"]}',
    '{"full_name": "Ania Kowalska"}',
    false, now(), now(),
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'aaaaaaaa-0000-0000-0000-000000000002',
    'authenticated', 'authenticated',
    'marek@hotable.pl',
    crypt('dev123', gen_salt('bf')),
    now(),
    '{"provider": "email", "providers": ["email"]}',
    '{"full_name": "Marek Nowak"}',
    false, now(), now(),
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'aaaaaaaa-0000-0000-0000-000000000003',
    'authenticated', 'authenticated',
    'kasia@hotable.pl',
    crypt('dev123', gen_salt('bf')),
    now(),
    '{"provider": "email", "providers": ["email"]}',
    '{"full_name": "Kasia Wiśniewska"}',
    false, now(), now(),
    '', '', '', ''
  )
on conflict (id) do nothing;

-- ============================================================
-- ZADANIA (10 szt., przypisane do projektów i aktywnego cyklu)
-- ============================================================

do $$
declare
  v_mvp   uuid;
  v_grant uuid;
  v_mkt   uuid;
  v_cycle uuid;
  v_ania  uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  v_marek uuid := 'aaaaaaaa-0000-0000-0000-000000000002';
  v_kasia uuid := 'aaaaaaaa-0000-0000-0000-000000000003';
begin
  select id into v_mvp   from projects where name = 'Hotable MVP'      limit 1;
  select id into v_grant from projects where name = 'Grant PARP FEPW'  limit 1;
  select id into v_mkt   from projects where name = 'Marketing Q1'     limit 1;
  select id into v_cycle from cycles   where is_active = true           limit 1;

  if v_mvp is null or v_cycle is null then
    raise notice 'Brak projektów/cyklu — pomiń seeding zadań';
    return;
  end if;

  insert into tasks (title, status, priority, type, project_id, cycle_id, assignee_id, position)
  values
    -- Hotable MVP — aktywny sprint
    ('Implementacja auth magic link',      'done',        'high',   'feature',   v_mvp,   v_cycle, v_ania,  10),
    ('Sprint Board — kolumny Kanban',      'done',        'high',   'feature',   v_mvp,   v_cycle, v_marek, 20),
    ('Drag-and-drop między kolumnami',     'in_progress', 'high',   'feature',   v_mvp,   v_cycle, v_marek, 10),
    ('Realtime subscriptions dla tasks',   'in_progress', 'medium', 'feature',   v_mvp,   v_cycle, v_kasia, 20),
    ('Naprawić WIP limit counter',         'in_review',   'medium', 'bug',       v_mvp,   v_cycle, v_ania,  10),
    ('Widok Backlog z filtrowaniem',       'todo',        'medium', 'feature',   v_mvp,   v_cycle, v_marek, 30),
    -- Grant PARP — aktywny sprint
    ('Raport kwartalny Q1 2026 (PARP)',    'todo',        'urgent', 'research',  v_grant, v_cycle, v_ania,  10),
    ('Dokumentacja milestones WP1',        'in_progress', 'high',   'feature',   v_grant, v_cycle, v_kasia, 10),
    -- Marketing — aktywny sprint + backlog
    ('Kampania Product Hunt launch',       'todo',        'medium', 'marketing', v_mkt,   v_cycle, v_kasia, 10),
    ('Analiza konkurencji Q2 2026',        'todo',        'low',    'research',  v_mkt,   null,    v_marek, 10);

end $$;

-- ============================================================
-- IDEE (3 szt. z ICE scoring)
-- ============================================================

do $$
declare
  v_ania  uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
begin
  insert into ideas (title, description, status, ice_impact, ice_confidence, ice_ease, source, author_id)
  values
    ('Integracja z GitHub Issues',
     'Synchronizacja tasków z GitHub Issues — eliminuje podwójny tracking.',
     'inbox', 8, 6, 5, 'founders_meeting', v_ania),

    ('Weekly digest email dla zespołu',
     'Automatyczny email co piątek z podsumowaniem sprintu i blockerami.',
     'inbox', 7, 8, 7, 'founders_meeting', v_ania),

    ('Dashboard metryk PARP (burn rate)',
     'Widok pokazujący aktualny burn rate budżetu vs plan grantowy.',
     'accepted', 9, 7, 4, 'founders_meeting', v_ania);
end $$;
