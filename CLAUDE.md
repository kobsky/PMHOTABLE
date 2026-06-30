# CLAUDE.md — Hotable Compass Development Guide
> Last updated: 2026-06-30 (after remediation tiers 0–3 + improvements U1–U5; schema synced to migration 020)
> This is a development playbook. For thesis/project specs, see docs/ folder.
> ⚠️ Runtime accuracy depends on migrations **001–020** being applied (`supabase db push`) and `lib/supabase/types.ts` regenerated.

---

## 🎯 CZYM JEST TEN PROJEKT

**Hotable Compass** to wewnętrzne narzędzie PM dla 3-osobowego startupu technologicznego **Hotable Sp. z o.o.**

Łączy trzy rzeczy:
1. **Codzienną egzekucję** (sprinty 2-tygodniowe, Kanban board, backlog)
2. **Decyzje strategiczne** (OKR, Architecture Decision Records, Requests for Comments)
3. **Compliance grantowy** (milestony, budget tracking, quarterly reporting)

To opiniotwórcze, minimalne, WIP-limited, async-first narzędzie dla małych teamów.

---

## 🏗️ STACK TECHNOLOGICZNY

| Layer | Technology | Version | Why |
|-------|-----------|---------|-----|
| Framework | Next.js | 15.5.15 | App Router, RSC, Server Actions, Suspense streaming |
| Language | TypeScript | 5.7 | strict: true — type safety |
| Runtime | React | 19.2 | RSC + Suspense (React Compiler **wyłączony**) |
| Styling | Tailwind CSS | 3.4.17 | Utility-first, `.compass-*` tokens |
| UI prymitywy | Radix (`Dialog`, `DropdownMenu`) | — | **shadcn/ui NIE jest zainstalowany** — UI to surowy Tailwind + autorskie klasy `.compass-*` (większość `@radix-ui/*` w `package.json` nieużywana) |
| Icons | lucide-react | 0.469 | |
| Drag & Drop | @hello-pangea/dnd | 18 | główny ciężar bundla `/board` |
| Backend / DB | Supabase (`supabase-js` ^2.47 → lock 2.103, `@supabase/ssr` ^0.5) | — | PostgreSQL + Auth + Realtime + RLS + Edge Fn |
| Walidacja | zod | 4 | walidacja wejścia w Server Actions |
| Email | resend | 6 | maile invite / reset hasła |
| „AI" → ML + heurystyki | — | — | **U1** = lokalny sentence-transformer (offline eval w `ml/`, serwowanie odłożone); **U2–U5** = deterministyczne **wspomaganie decyzji**. **BRAK zewnętrznego LLM w produkcji** (`@anthropic-ai/sdk` w deps, ale **niewywoływany** — żywe wywołanie Claude usunięto w U3). |
| Toast | sonner | 1.7 | Notifications |
| Deployment | Netlify | — | `@netlify/plugin-nextjs`, HTTPS, Git auto-deploy |

---

## 📁 STRUKTURA PROJEKTU

> ⚠️ **shadcn/ui NIE jest zainstalowany** — `components/ui/` NIE istnieje. UI to surowy Tailwind + autorskie klasy `.compass-*`. Jedyne realnie używane prymitywy Radix to `Dialog` (w `task-detail-modal`) i `DropdownMenu`.

```
hotable-compass/
├── app/
│   ├── layout.tsx                     ← Root: fonts (Fraunces, Plus Jakarta, JetBrains)
│   ├── globals.css                    ← Design tokens (compass-bg, compass-accent, etc.)
│   ├── page.tsx                       ← Redirect → /my-day
│   ├── (auth)/                        ← trasy publiczne (layout = siatka)
│   │   ├── login/page.tsx             ← Magic link / OTP / hasło
│   │   ├── reset-password/page.tsx    ← Reset hasła
│   │   └── invite/[token]/page.tsx    ← Akceptacja zaproszenia (ustaw hasło)
│   ├── auth/
│   │   ├── callback/route.ts          ← OAuth/OTP code exchange
│   │   └── signout/route.ts           ← POST → clear session
│   ├── (dashboard)/                   ← trasy chronione (guard w layout.tsx) — ~17 realnych
│   │   ├── layout.tsx                 ← Auth guard + Sidebar
│   │   ├── my-day/page.tsx            ← Focus Mode (RSC)
│   │   ├── board/page.tsx             ← Sprint Board (Kanban + realtime, RSC+Suspense) — wzorcowa
│   │   ├── backlog/page.tsx           ← Wszystkie zadania, przypisanie do cyklu (RSC+Suspense)
│   │   ├── sprints/page.tsx           ← Lista/zarządzanie cyklami (RSC)
│   │   ├── team/page.tsx              ← Workload per członek + sugestie (RSC)
│   │   ├── team/members/page.tsx      ← Lista członków (Client/useEffect)
│   │   ├── team/invite/page.tsx       ← Zapraszanie członków (Client)
│   │   ├── capacity/page.tsx          ← redirect → /team
│   │   ├── ideas/page.tsx             ← Idea Inbox, ICE scoring (RSC)
│   │   ├── goals/page.tsx             ← OKR tree + grant milestones (RSC)
│   │   ├── goals/[id]/page.tsx        ← Szczegóły celu (Client/useEffect)
│   │   ├── gantt/page.tsx             ← Timeline (RSC, revalidate=60)
│   │   ├── wsjf/page.tsx              ← Priorytetyzacja SAFe WSJF (U5, deterministyczna)
│   │   ├── ai-metrics/page.tsx        ← Statystyki ai_feedback (adopcja)
│   │   ├── ai-testing/page.tsx        ← Narzędzie deweloperskie (Client)
│   │   ├── settings/account/page.tsx  ← Ustawienia konta (Client)
│   │   └── settings/team/page.tsx     ← Ustawienia zespołu (Client/useEffect)
│   ├── actions/                       ← Server Actions ('use server')
│   │   ├── auth.ts                    ← login, reset hasła, signout helpers
│   │   ├── tasks.ts                   ← CRUD: tasks (+ getProjects — DUBLET, patrz STRUKT-002)
│   │   ├── cycles.ts                  ← CRUD: cycles; RPC: activate_cycle, add/remove link+date
│   │   ├── projects.ts                ← CRUD: projects
│   │   ├── users.ts                   ← READ: profiles (cache)
│   │   ├── team.ts                    ← Zarządzanie członkami zespołu (profiles)
│   │   ├── invites.ts                 ← invite_tokens: tworzenie + akceptacja
│   │   ├── goals.ts                   ← CRUD: goals
│   │   ├── ideas.ts                   ← CRUD: ideas, ICE; RPC promote_idea_to_task
│   │   ├── estimation.ts             ← U2: baseline estymacji story points (median, BEZ ML/LLM)
│   │   ├── wsjf.ts                    ← U5: persystencja wejść + ranking WSJF (deterministyczny)
│   │   ├── documents.ts               ← CRUD: ADR/RFC/spec/weekly — ZAIMPLEMENTOWANE, BRAK UI (FUNC-004)
│   │   ├── weekly.ts                  ← Ręczna generacja weekly summary — ZAIMPLEMENTOWANE, BRAK UI (FUNC-004)
│   │   └── ai.ts                      ← Heurystyki DETERMINISTYCZNE (BEZ Claude): getWorkloadSuggestions,
│   │                                     categorizeTask (regex), getAIFeedbackStats, logAIFeedback
├── components/
│   └── compass/                       ← WSZYSTKIE komponenty UI (BRAK components/ui — shadcn nieobecny)
│       ├── sidebar.tsx                ← Fixed left nav
│       ├── login-form.tsx            ← formularz logowania
│       ├── page-header.tsx            ← Reusable title
│       ├── task-card.tsx              ← Task display
│       ├── task-detail-modal.tsx      ← Full editor + subtaski + SP + RACI (Radix Dialog)
│       ├── quick-add-task.tsx         ← Inline task creation
│       ├── sprint-board.tsx           ← Kanban z DnD + jedyny kanał Realtime
│       ├── backlog-view.tsx           ← Filterable table (BacklogRow memo + profilesById Map — Tier 3)
│       ├── team-view.tsx              ← Workload grid + sugestie
│       ├── team-capacity-view.tsx     ← Pojemność zespołu (Server Component)
│       ├── workload-suggestions.tsx   ← Chipy sugestii balansu obciążenia
│       ├── assignee-suggestions.tsx   ← Rekomendacje przydziału (deterministyczne)
│       ├── ideas-view.tsx             ← ICE scoring board
│       ├── idea-card.tsx              ← Idea display card
│       ├── goals-view.tsx             ← OKR tree + grant tracker
│       ├── gantt-view.tsx             ← Timeline visualization
│       ├── cycle-selector.tsx         ← Wybór cyklu
│       ├── wip-warning.tsx            ← >3 in-progress banner
│       ├── close-sprint-button.tsx    ← End sprint action
│       ├── skeletons.tsx              ← Loading skeletons
│       └── ai-badge.tsx               ← "✦ AI" label
│   (Uwaga: BRAK decisions-view.tsx / weekly-view.tsx — moduły bez UI, patrz FUNC-004)
├── lib/
│   ├── supabase/
│   │   ├── client.ts                  ← Browser Supabase client
│   │   ├── server.ts                  ← createClient() + getAuthenticatedClient()
│   │   └── types.ts                   ← Generated types (don't edit manually)
│   ├── utils.ts                       ← cn(), formatery PL, calculateICE(), inferTaskType() (regex)
│   ├── velocity/
│   │   └── tolerance.ts               ← strefy tolerancji velocity (zielona/żółta/czerwona)
│   ├── capacity.ts                    ← obliczenia pojemności (story points / sprint)
│   ├── team-constants.ts              ← stałe zespołu (role, presety)
│   ├── estimation.ts                  ← U2: median baseline story points (czysta funkcja)
│   ├── wsjf.ts                        ← U5: computeWsjf(), WSJF_FIBONACCI (czysta funkcja)
│   └── mock-data.ts                   ← Dev fallback (gdy brak auth/ENV)
├── ml/                                ← U1: OFFLINE eval klasyfikatora typu zadania (Python)
│   ├── baseline.py / embed.py / dataset.py / train_eval.py
│   ├── data/labeled.csv              ← zbiór treningowy/ewaluacyjny
│   ├── models/clf.joblib            ← wytrenowany klasyfikator (offline)
│   ├── requirements.txt              ← sentence-transformers + sklearn
│   └── README.md / REPORT.md         ← metodyka + wyniki (serwowanie w produkcji ODŁOŻONE)
├── supabase/
│   ├── migrations/                    ← 001–020 (20 migracji, forward-only)
│   │   ├── 001_initial_schema.sql     ← 6 tabel core, enumy, RLS, cycles_single_active_idx
│   │   ├── 002–005                    ← task_type/doc_status/goal_status, indeksy, soft delete, ai_feedback
│   │   ├── 006_invite_system.sql      ← tabela invite_tokens
│   │   ├── 007–011                    ← fix handle_new_user, extend profiles, team redesign (role→text[]), goals.project_id
│   │   ├── 012_task_size_raci.sql     ← tasks.size (T-shirt) + tasks.raci (jsonb)
│   │   ├── 013_cycle_sprint_features  ← cycles.notes/sprint_links/unavailability (jsonb)
│   │   ├── 014_team_skills_capacity   ← profiles.base_capacity
│   │   ├── 015_task_type_refactor.sql ← nowy enum task_type (research/development/outreach/…)
│   │   ├── 016_story_points.sql       ← tasks.story_points (Fibonacci)
│   │   ├── 017_add_cycle_tolerance.sql← cycles.tolerance_percent (NOT NULL DEFAULT 20)
│   │   ├── 018_tier0_security.sql     ← RLS WITH CHECK, profiles SELECT auth-only, FK indexy, self-parent guard
│   │   ├── 019_tier1_atomicity.sql    ← RPC: activate_cycle, promote_idea_to_task, add/remove link+date
│   │   └── 020_tier2_schema.sql       ← tasks.wsjf_* (4 kolumny), rozszerzenie ai_feedback.feature CHECK
│   └── functions/
│       └── generate-weekly-summary/
│           └── index.ts               ← Deno edge fn (cron) — WYMAGA nagłówka CRON_SECRET (401 bez)
├── docs/                              ← audyty, roadmap, security review (część nieaktualna)
├── __tests__/                        ← testy (Vitest): actions + lib/utils
├── .env.local.example                 ← Copy this to .env.local
├── .gitignore                         ← VERIFY .env.local is ignored
├── package.json                       ← Dependencies
├── tsconfig.json                      ← TypeScript strict: true
├── tailwind.config.js                 ← compass-* tokens
├── next.config.ts                     ← nagłówki bezpieczeństwa + CSP, optimizePackageImports
└── README.md                          ← Setup instructions
```

---

## 📊 DATABASE SCHEMA

> Stan po migracji **020**. 8 tabel (6 core + `ai_feedback` + `invite_tokens`). RLS włączone na wszystkich; po 018 polityki `*_all` mają jawny `USING` **i** `WITH CHECK (auth.uid() is not null)`.

### CORE TABLES

#### `profiles`
```
id            UUID PK (NIE jest już FK → auth.users; 010 zdjęło fkey)
email         TEXT UNIQUE  (NULLABLE od 009 — profile placeholder bez maila)
full_name     TEXT
avatar_url    TEXT
role          TEXT[]   DEFAULT '{}'        (008: text → 009: text[]; GIN index; NIE jest to TEXT)
skills        JSONB    DEFAULT '[]'        (008; np. ["React","PostgreSQL"])
bio           TEXT                         (008)
base_capacity INTEGER  DEFAULT 20          (014; story points / sprint)
profile_type  TEXT     DEFAULT 'active'    (009; 'active'|'placeholder'|'invited')
linked_user_id UUID FK → auth.users ON DELETE SET NULL  (009; placeholder → konto po akceptacji)
created_at    TIMESTAMP DEFAULT now()
updated_at    TIMESTAMP DEFAULT now()

RLS: SELECT — TYLKO authenticated (018; wcześniej `using(true)` = PII dla anon, naprawione)
     UPDATE/INSERT — authenticated (zarządzanie zespołem, 009)
     DELETE — authenticated AND profile_type IN ('placeholder','invited') (009)
Trigger: handle_new_user() — auto-creates profile on signup (fix w 007)
Index: GIN(role)
```

#### `projects`
```
id          UUID PK
name        TEXT NOT NULL
scope_tag   ENUM (scope_1.0, scope_1.5, scope_2.0, grant_parp, marketing, ops)
description TEXT
color       TEXT DEFAULT '#848179'
is_archived BOOLEAN DEFAULT false
created_at  TIMESTAMP
updated_at  TIMESTAMP

RLS: CRUD all authenticated
```

#### `cycles` (2-week sprints)
```
id                UUID PK
name              TEXT NOT NULL
start_date        DATE NOT NULL
end_date          DATE NOT NULL  CHECK(end_date > start_date)
goal              TEXT  (sprint goal)
is_active         BOOLEAN DEFAULT false
velocity_planned  INTEGER
velocity_actual   INTEGER
tolerance_percent INTEGER NOT NULL DEFAULT 20  CHECK(0–100)  (017; strefy velocity)
notes             TEXT                          (013)
sprint_links      JSONB DEFAULT '[]'            (013; [{id,title,url,label}])
unavailability    JSONB DEFAULT '{}'            (013; { "<user_id>": [{date,reason}] })
created_at        TIMESTAMP
updated_at        TIMESTAMP

RLS: CRUD all authenticated (WITH CHECK od 018)
Index: cycles_single_active_idx — PARTIAL UNIQUE on (is_active) WHERE is_active = true
       (co najwyżej jeden aktywny cykl; aktywacja przez RPC activate_cycle, patrz niżej)
Atomowość: aktywacja i edycje JSONB przez RPC z migracji 019 (NIE read-modify-write w JS)
```

#### `tasks`
```
id              UUID PK
title           TEXT NOT NULL
description     TEXT  (Markdown)
status          ENUM (todo, in_progress, in_review, done, cancelled)
priority        ENUM (low, medium, high, urgent) DEFAULT 'medium'
type            ENUM task_type — po 015: research | development | outreach | design
                                 | marketing | support | ops   (DEFAULT 'development')
                                 (stare feature/bug/chore USUNIĘTE w 015)
size            VARCHAR(4) DEFAULT 'M'  CHECK IN ('XS','S','M','L','XL','XXL')  (012; T-shirt)
story_points    INTEGER  CHECK IN (1,2,3,5,8,13)  (016; Fibonacci — wyparł T-shirt)
raci            JSONB DEFAULT NULL  (012; {responsible, accountable[], consulted[], informed[]})
wsjf_user_value       INTEGER  CHECK IN (1,2,3,5,8,13,20) OR NULL  (020; U5 SAFe)
wsjf_time_criticality INTEGER  CHECK IN (1,2,3,5,8,13,20) OR NULL  (020)
wsjf_risk_reduction   INTEGER  CHECK IN (1,2,3,5,8,13,20) OR NULL  (020)
wsjf_job_size         INTEGER  CHECK (>0 AND IN (...)) OR NULL      (020; mianownik)
project_id      UUID FK → projects.id ON DELETE SET NULL
assignee_id     UUID FK → profiles.id ON DELETE SET NULL
parent_task_id  UUID FK → tasks.id ON DELETE CASCADE  (subtask, max głębokość 1)
cycle_id        UUID FK → cycles.id ON DELETE SET NULL
due_date        DATE
position        INTEGER DEFAULT 0  (for column ordering)
ai_suggested    BOOLEAN DEFAULT false
deleted_at      TIMESTAMP  (soft delete)
created_at      TIMESTAMP
updated_at      TIMESTAMP

Indexes: project_id, assignee_id, cycle_id, status, parent_task_id
RLS: CRUD all authenticated (WITH CHECK od 018)
Triggers: check_task_nesting() — blokuje głębokość >1 ORAZ self-parent
          (new.parent_task_id = new.id), rozszerzony w 018.
          NIE istnieje żaden `check_parent_is_not_self()` — to ta sama funkcja.
          + update_updated_at()
WSJF: 4 kolumny nullowalne, liczone deterministycznie w lib/wsjf.ts (BEZ ML/LLM)
```

#### `documents` (ADR, RFC, specs, weekly summaries)
```
id              UUID PK
title           TEXT NOT NULL
type            ENUM (adr, rfc, spec, brief, weekly_summary)
status          ENUM (draft, review, accepted, deprecated, superseded)
content         TEXT  (Markdown)
project_id      UUID FK → projects.id ON DELETE SET NULL
author_id       UUID FK → profiles.id ON DELETE SET NULL
created_at      TIMESTAMP
updated_at      TIMESTAMP

Indexes: type (filtrowanie); author_id, project_id (FK, dodane w 018)
RLS: CRUD all authenticated (WITH CHECK od 018)
⚠️ ZAIMPLEMENTOWANE w app/actions/documents.ts, ale BRAK UI (/decisions nie istnieje) — FUNC-004.
```

#### `goals` (OKR + grant milestones)
```
id              UUID PK
title           TEXT NOT NULL
type            ENUM (objective, key_result, grant_milestone)
status          ENUM (on_track, at_risk, off_track, achieved)
description     TEXT
progress        INTEGER DEFAULT 0  CHECK(0-100)
target_value    NUMERIC
current_value   NUMERIC
unit            TEXT  ("hours", "users", "%", etc.)
quarter         TEXT  ("2026-Q2")
budget_planned_pln    NUMERIC
budget_actual_pln     NUMERIC
parent_goal_id  UUID FK → goals.id ON DELETE SET NULL
due_date        DATE
created_at      TIMESTAMP
updated_at      TIMESTAMP

Hierarchy: Objective → Key Results (max 1 level)
project_id      UUID FK → projects.id ON DELETE SET NULL  (011)
RLS: CRUD all authenticated (WITH CHECK od 018)
```

#### `ideas` (Idea Inbox with ICE scoring)
```
id                  UUID PK
title               TEXT NOT NULL
description         TEXT
status              ENUM (inbox, accepted, rejected, converted)
source              ENUM (founders_meeting, user_feedback, competitor, market, other)
ice_impact          INTEGER CHECK(1-10)
ice_confidence      INTEGER CHECK(1-10)
ice_ease            INTEGER CHECK(1-10)
ice_score           NUMERIC GENERATED AS ((ice_impact+ice_confidence+ice_ease)/3.0)
rejection_reason    TEXT  (REQUIRED if status='rejected')
promoted_to_task_id UUID FK → tasks.id ON DELETE SET NULL
author_id           UUID FK → profiles.id ON DELETE SET NULL
created_at          TIMESTAMP
updated_at          TIMESTAMP

Constraint: CHECK(status != 'rejected' OR rejection_reason IS NOT NULL)
RLS: CRUD all authenticated (WITH CHECK od 018)
Index: status (filtrowanie); promoted_to_task_id (FK, dodane w 018)
RPC: promote_idea_to_task() ustawia status='converted' + promoted_to_task_id atomowo (019)
```

#### `ai_feedback` (rejestr interakcji — ADOPCJA, nie „skuteczność")
```
id              UUID PK
feature         TEXT NOT NULL  CHECK IN (po 020):
                  'auto_categorization' | 'assignee_recommender' | 'workload_balancing'
                  | 'sp_estimation_baseline' (U2) | 'wsjf_prioritization' (U5)
                  | 'task_type_classifier_ml' (U1)
task_id         UUID FK → tasks.id ON DELETE SET NULL
suggestion      JSONB  (np. {"assignee_id": "...", "score": 0.85, "reason": "..."})
accepted        BOOLEAN  (czy użytkownik zaakceptował?)
override_value  JSONB  (co wybrał zamiast)
created_at      TIMESTAMP

RLS: CRUD all authenticated (jedna kanoniczna polityka po 018; wcześniej DWIE z 004+005)
Cel: liczenie współczynnika adopcji sugestii (getAIFeedbackStats → /ai-metrics).
     Rejestruje WYŁĄCZNIE surowe interakcje (accept/reject/apply/dismiss), nie metryki jakości.
```

#### `invite_tokens` (zaproszenia do zespołu — 006)
```
token       UUID PK DEFAULT gen_random_uuid()
email       TEXT NOT NULL
created_by  UUID FK → profiles.id ON DELETE SET NULL
expires_at  TIMESTAMP NOT NULL  (7-dniowa ważność)
accepted_at TIMESTAMP
created_at  TIMESTAMP DEFAULT now()

RLS: CRUD all authenticated (WITH CHECK od 018)
Index: (created_by, accepted_at) — lista oczekujących. Redundantny indeks na (token)
       usunięty w 018 (token jest PK).
```

### RPC (PostgreSQL functions, migracja 019 — atomowe operacje)
```
activate_cycle(p_cycle_id)                         → deaktywuj wszystkie + aktywuj jeden (1 tx)
promote_idea_to_task(idea, title, project,         → wstaw task + oznacz idea 'converted'
                     priority, assignee)              + ustaw promoted_to_task_id; zwraca task_id
                                                       (guard podwójnego promote, FOR UPDATE)
add_cycle_link(cycle, link_jsonb)                  → atomowy append do sprint_links (`||`)
remove_cycle_link(cycle, link_id)                  → atomowe usunięcie po id
add_unavailable_date(cycle, user, date, reason)    → atomowy jsonb_set niedostępności (dedup po dacie)
remove_unavailable_date(cycle, user, date)         → atomowe usunięcie wpisu
```

---

## 🎨 DESIGN SYSTEM

### Color Tokens (dark mode, high-contrast)
```css
--compass-bg:        #0F0F0E    (canvas)
--compass-surface:   #171715    (card level 1)
--compass-surface-2: #1E1E1C    (card level 2)
--compass-surface-3: #262623    (card level 3)
--compass-border:    #2A2A27
--compass-text:      #EAE8DF    (cream white)
--compass-muted:     #848179    (taupe)
--compass-accent:    #E8622A    (orange — primary action)
--compass-success:   #4BAF87    (green)
--compass-warning:   #F5A83A    (gold)
--compass-danger:    #DE4040    (red)
```

### Typography
```
Display:   Fraunces (serif) — page titles, brand
Body:      Plus Jakarta Sans (sans-serif) — UI text
Monospace: JetBrains Mono — labels, code, IDs
```

### Component Classes (Tailwind + custom)
```css
.compass-card              /* Surface + border + padding */
.compass-btn-primary       /* Accent background, hover states */
.compass-badge-*           /* Status badges (success, warning, danger) */
.priority-dot-*            /* Task priority indicators */
.compass-input             /* Form fields */
.compass-sidebar           /* Sidebar styling */
```

---

## 📋 STAN FUNKCJI (po tierach 0–3 + U1–U5)

> Plan tygodniowy z wiosny został zrealizowany i zweryfikowany audytem (AUDIT.md).
> Poniżej rzeczywisty stan, NIE backlog. Dla pełnej diagnozy → AUDIT.md.

### Zrealizowane tiery remediacji
- **Tier 0 — bezpieczeństwo (018):** profiles SELECT auth-only, jawny `WITH CHECK` na RLS,
  konsolidacja `ai_feedback`, FK-indexy, guard self-parent. Fail-closed middleware.
- **Tier 1 — atomowość (019):** RPC `activate_cycle`, `promote_idea_to_task`, atomowe
  operacje JSONB na `sprint_links`/`unavailability`. Koniec read-modify-write.
- **Tier 2 — schemat (020):** `tasks.wsjf_*`, rozszerzenie `ai_feedback.feature` CHECK.
- **Tier 3 — wydajność:** memoizacja `backlog-view` (`BacklogRow` memo + `useCallback`
  + `profilesById` Map), `cache()` na hot-queries, code-split modali.

### „AI" / wspomaganie decyzji — co jest czym
| ID | Funkcja | Natura |
|----|---------|--------|
| **U1** | Klasyfikator typu zadania | **Jedyny realny ML** — sentence-transformer trenowany OFFLINE w `ml/` (eval + `clf.joblib`). Serwowanie w produkcji ODŁOŻONE; w runtime nadal działa regex `inferTaskType()`. |
| **U2** | Baseline estymacji story points | **Deterministyczny** median baseline (`lib/estimation.ts`, `app/actions/estimation.ts`). BEZ ML/LLM. |
| **U3** | Rekomendacja przydziału / heurystyki w `ai.ts` | **Deterministyczne** scoringi (load + Gini + eksploracja). **Żywe wywołanie Claude USUNIĘTO** — `@anthropic-ai/sdk` jest w deps, ale niewywoływany. |
| **U4** | Balansowanie obciążenia | **Heurystyka** (`getWorkloadSuggestions`). |
| **U5** | Priorytetyzacja SAFe WSJF | **Deterministyczny** wzór `(UV+TC+RR)/JobSize` (`lib/wsjf.ts`, `/wsjf`). BEZ ML/LLM. |

Każda interakcja (accept/reject/apply/dismiss) logowana do `ai_feedback` → `/ai-metrics`
(współczynnik **adopcji**, nie „skuteczności").

### Znane braki (z AUDIT.md)
- **FUNC-004:** `app/actions/documents.ts` i `weekly.ts` są zaimplementowane, ale **nie mają UI**
  — strony `/decisions` i `/weekly` nigdy nie powstały (backend-ready, moduły ADR/RFC i Weekly
  Summary bez frontu). Edge fn `generate-weekly-summary` istnieje i pisze do `documents`.

---

## 🔐 SECURITY

### RLS Policy (all tables) — stan po migracji 018
```sql
-- Wszystkie tabele mają jawny USING + WITH CHECK (018):
CREATE POLICY "[table]_all" ON [table]
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- profiles: SELECT zawężone do zalogowanych (018 — wcześniej `using(true)` = wyciek PII dla anon):
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);
-- profiles UPDATE/INSERT: authenticated (zarządzanie zespołem, 009)
-- profiles DELETE: authenticated AND profile_type IN ('placeholder','invited') (009)
```

**Dla 3-osobowego zespołu** model „zalogowany = pełny CRUD" jest świadomie akceptowany
(brak ról admin/manager). Brak autoryzacji aplikacyjnej na invite/delete to znany kompromis
(BEZP-007 w AUDIT.md). Edge Function `generate-weekly-summary` używa `service_role` (omija RLS)
i **wymaga** nagłówka `CRON_SECRET` (`x-cron-secret` lub `Authorization: Bearer <CRON_SECRET>`);
brak/niezgodność → 401. Sekret ustawiany przez `supabase secrets set CRON_SECRET=...`.

### Security Checklist
```
[x] Auth (magic link / OTP / hasło)
[x] Session via HttpOnly cookies (@supabase/ssr)
[x] RLS enforced on all tables (jawny WITH CHECK od 018)
[x] profiles zablokowane do authenticated (018 — koniec wycieku PII dla anon)
[x] Parameterized queries (Supabase SDK)
[x] Environment variables in .env.local (not committed)
[x] Input validation (Zod w Server Actions — np. wsjf.ts, estimation.ts)
[x] Soft deletes (kolumna deleted_at)
[x] Fail-closed middleware (twarde odrzucanie przy braku ENV w produkcji)
[x] Edge fn wymaga CRON_SECRET (CORS zawężone, verify JWT)
[ ] XSS prevention (zweryfikować renderer Markdown)
[ ] Autoryzacja aplikacyjna na invite/destrukcyjne delete (BEZP-007 — świadomy kompromis)
```

---

## 📝 KONWENCJE KODOWANIA

### Components (React)
```typescript
// ✅ GOOD
export interface MyComponentProps {
  taskId: string;
  onUpdate: (id: string) => void;
}

export function MyComponent({ taskId, onUpdate }: MyComponentProps) {
  return <div>...</div>;
}

// ❌ BAD
export function MyComponent(props: { taskId: string }) {}
export function MyComponent({ taskId }: any) {}
```

**Files:** `kebab-case.tsx`, Components: `PascalCase`

### Server Actions
```typescript
'use server';

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const client = getAuthenticatedClient();
  if (!client) throw new Error('Not authenticated');
  
  // Validate input
  const validated = createTaskSchema.parse(input);
  
  const { data, error } = await client
    .from('tasks')
    .insert([validated])
    .select()
    .single();
  
  if (error) throw error;
  revalidatePath('/board');
  return data;
}
```

### CSS Classes
```
✅ .compass-card          /* Use custom compass classes */
✅ .compass-btn-primary
✅ .priority-dot-urgent
❌ .bg-[#F5A83A]          /* Don't use arbitrary colors */
```

### TypeScript
```typescript
// ✅ ALWAYS strict mode
"strict": true in tsconfig.json

// ✅ Use types for unions
type TaskStatus = 'todo' | 'in_progress' | 'done';

// ✅ Use enums for fixed sets
enum TaskPriority {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Urgent = 'urgent',
}

// ❌ NEVER
let x: any;
```

---

## 🔧 ÚTILNE KOMENDY

```bash
# Development
pnpm dev                          # Next.js dev server

# Supabase — migracje stosowane na ZDALNYM, podlinkowanym projekcie (nie local)
supabase link --project-ref bgiezcdacrxnpzvwpdzu   # jednorazowo / po reinstalacji
supabase db push                  # Zastosuj migracje 001–020 na zdalnej bazie
supabase gen types typescript --linked > lib/supabase/types.ts   # regeneruj typy po migracji

# ⚠️ `supabase db reset` na lokalnej bazie zostanie wywalony przez seed.sql/seed_history.sql
#    (wstawiają stare wartości enuma feature/bug/chore usunięte w 015 — STRUKT-007).

# Edge Function (cron weekly)
supabase secrets set CRON_SECRET=<losowy-długi-sekret>
supabase functions logs generate-weekly-summary

# Type checking
pnpm tsc --noEmit

# Linting
pnpm lint
pnpm lint --fix

# Testing
pnpm test
pnpm test --watch

# Production build
pnpm build
pnpm start
```

---

## 🐛 DEBUGGING

### Sprint Board nie aktualizuje się realtime
```
1. Supabase Dashboard → Realtime → Check 'tasks' table replication
2. Verify cycle_id filter is set correctly
3. Check browser console for subscription errors
```

### RLS blokuje zapytania
```
1. Supabase Studio → Table Editor → Select table → RLS
2. Verify policy allows authenticated users
3. Check column-level RLS
```

### Edge Function się nie odpala
```
supabase functions logs generate-weekly-summary
```

### Typy Supabase nieaktualne
```bash
# Po każdej migracji (projekt podlinkowany, baza zdalna):
supabase gen types typescript --linked > lib/supabase/types.ts
```

---

## ⚠️ CZEGO NIE RÓB

```
❌ Nie dodawaj time trackingu (out of scope)
❌ Nie dodawaj zewnętrznego LLM do rozwiązania produkcyjnego
   (decyzja: U3 jest deterministyczny; @anthropic-ai/sdk jest w deps, ale NIEWYWOŁYWANY)
❌ Nie twórz własnego systemu komentarzy (GitHub Issues w przyszłości)
❌ Nie dodawaj custom fields (predefiniowane wystarczą)
❌ Nie twórz ról admina/managera (3 osoby = równe prawa)
❌ Nie instaluj Zustand/Redux (Server Components + URL state wystarczają)
❌ Nie używaj 'any' / 'as any' w TypeScript (strict)
❌ Nie commituj .env.local
❌ Nie zmieniaj kolorów bez aktualizacji design tokens
❌ Nie instaluj shadcn/ui — UI to surowy Tailwind + klasy `.compass-*`
```

---

**For project specs, thesis info, architecture decisions → see docs/ folder**