-- ============================================================
-- Hotable Compass — Migracja 019: Tier 1 — poprawność i atomowość
-- ============================================================
-- Forward-only. Nie edytuje migracji 001–018.
-- Adresuje findingi: LOG-003, LOG-004, LOG-005.
--
-- Wszystkie RPC poniżej zastępują wzorzec read-modify-write z Server Actions
-- pojedynczym, atomowym UPDATE/funkcją plpgsql (jedna transakcja na wywołanie),
-- aby współbieżne edycje nie nadpisywały się nawzajem (lost update) i aby
-- niezmienniki ("jeden aktywny sprint", "promote tylko raz") były wymuszane
-- po stronie bazy, a nie przez nieświeże odczyty w aplikacji.
--
-- Konwencje: nazwy kolumn/kształty JSONB zgodne z app/actions/cycles.ts oraz
-- app/actions/ideas.ts (sprint_links: [{id,title,url,label}], unavailability:
-- { "<user_id>": [{date,reason}] }).
-- ============================================================

-- ------------------------------------------------------------
-- LOG-003 — Nieatomowy „jeden aktywny sprint"
-- ------------------------------------------------------------
-- (a) Partial unique index "co najwyżej jeden aktywny cykl" już ISTNIEJE
--     z migracji 001 (`cycles_single_active_idx` on cycles(is_active) where
--     is_active = true). NIE tworzymy duplikatu — activate_cycle (poniżej) oraz
--     obsługa błędu 23505 w createCycle polegają na tym istniejącym indeksie.

-- (b) Atomowa aktywacja cyklu w jednym ciele funkcji (jedna transakcja):
--     najpierw deaktywuj wszystkie, potem aktywuj wybrany. Dzięki temu nie ma
--     okna, w którym dwa cykle mają is_active=true (kolizja z partial-unique),
--     ani w którym żaden nie jest aktywny po awarii drugiego UPDATE.
create or replace function activate_cycle(p_cycle_id uuid)
returns void
language plpgsql
as $$
begin
  -- Wymuś istnienie celu, aby nie „wygasić" wszystkich cykli bez aktywacji.
  if not exists (select 1 from cycles where id = p_cycle_id) then
    raise exception 'Sprint nie istnieje: %', p_cycle_id;
  end if;

  update cycles set is_active = false where is_active = true;
  update cycles set is_active = true  where id = p_cycle_id;
end;
$$;

-- ------------------------------------------------------------
-- LOG-004 — Read-modify-write na JSONB (lost update)
-- ------------------------------------------------------------
-- Atomowe operacje na cycles.sprint_links (tablica) i cycles.unavailability
-- (obiekt user_id -> tablica). Każda to pojedynczy UPDATE, więc dwie równoległe
-- edycje nie gubią się nawzajem.

-- Dopnij link do sprint_links. p_link to gotowy obiekt {id,title,url,label}
-- (id generuje warstwa aplikacji, zgodnie z dotychczasowym addCycleLink).
create or replace function add_cycle_link(p_cycle_id uuid, p_link jsonb)
returns void
language sql
as $$
  update cycles
  set sprint_links = coalesce(sprint_links, '[]'::jsonb) || jsonb_build_array(p_link)
  where id = p_cycle_id;
$$;

-- Usuń link o danym id, przebudowując tablicę bez pasującego elementu.
create or replace function remove_cycle_link(p_cycle_id uuid, p_link_id text)
returns void
language sql
as $$
  update cycles
  set sprint_links = coalesce((
    select jsonb_agg(elem)
    from jsonb_array_elements(coalesce(sprint_links, '[]'::jsonb)) as elem
    where elem->>'id' is distinct from p_link_id
  ), '[]'::jsonb)
  where id = p_cycle_id;
$$;

-- Dopnij wpis niedostępności dla użytkownika. Kształt:
--   unavailability = { "<user_id>": [{ "date": "...", "reason": "..." }] }
-- De-duplikacja po dacie (jak w addUnavailableDate: jeśli data już jest, no-op).
create or replace function add_unavailable_date(
  p_cycle_id uuid,
  p_user_id  text,
  p_date     text,
  p_reason   text
)
returns void
language sql
as $$
  update cycles
  set unavailability = jsonb_set(
    coalesce(unavailability, '{}'::jsonb),
    array[p_user_id],
    (
      -- istniejące wpisy użytkownika z usuniętą ewentualną kolizją po dacie...
      coalesce((
        select jsonb_agg(elem)
        from jsonb_array_elements(
          coalesce(unavailability->p_user_id, '[]'::jsonb)
        ) as elem
        where elem->>'date' is distinct from p_date
      ), '[]'::jsonb)
      -- ...plus nowy wpis (idempotentnie zastępuje ten z tą samą datą).
      || jsonb_build_array(jsonb_build_object('date', p_date, 'reason', p_reason))
    ),
    true
  )
  where id = p_cycle_id;
$$;

-- Usuń wpis niedostępności użytkownika dla danej daty.
create or replace function remove_unavailable_date(
  p_cycle_id uuid,
  p_user_id  text,
  p_date     text
)
returns void
language sql
as $$
  update cycles
  set unavailability = jsonb_set(
    coalesce(unavailability, '{}'::jsonb),
    array[p_user_id],
    coalesce((
      select jsonb_agg(elem)
      from jsonb_array_elements(
        coalesce(unavailability->p_user_id, '[]'::jsonb)
      ) as elem
      where elem->>'date' is distinct from p_date
    ), '[]'::jsonb),
    true
  )
  where id = p_cycle_id;
$$;

-- ------------------------------------------------------------
-- LOG-005 — Nieatomowy promote pomysłu + utracony link FK
-- ------------------------------------------------------------
-- W jednym ciele funkcji (jedna transakcja):
--   (a) wstaw zadanie z pomysłu,
--   (b) oznacz pomysł jako 'converted' i ustaw promoted_to_task_id na nowy task,
--   (c) zwróć id nowego zadania.
-- Guard przed podwójnym promote: tylko gdy pomysł istnieje, nie jest jeszcze
-- 'converted' i nie ma ustawionego promoted_to_task_id. W przeciwnym razie
-- zwracamy NULL (brak side-effectów) — wywołujący traktuje to jako „już
-- przeniesiony".
create or replace function promote_idea_to_task(
  p_idea_id     uuid,
  p_title       text,
  p_project_id  uuid,
  p_priority    task_priority,
  p_assignee_id uuid
)
returns uuid
language plpgsql
as $$
declare
  v_task_id uuid;
  v_locked  ideas%rowtype;
begin
  -- Zablokuj wiersz pomysłu, aby dwa równoległe promote nie przeszły obu guardów.
  select * into v_locked
  from ideas
  where id = p_idea_id
  for update;

  if not found then
    return null; -- pomysł nie istnieje
  end if;

  -- Guard podwójnego promote.
  if v_locked.status = 'converted' or v_locked.promoted_to_task_id is not null then
    return null;
  end if;

  insert into tasks (title, project_id, priority, status, assignee_id)
  values (
    p_title,
    p_project_id,
    coalesce(p_priority, 'medium'),
    'todo',
    p_assignee_id
  )
  returning id into v_task_id;

  update ideas
  set status = 'converted',
      promoted_to_task_id = v_task_id
  where id = p_idea_id;

  return v_task_id;
end;
$$;
