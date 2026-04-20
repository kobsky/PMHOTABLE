# CLAUDE.md — Hotable Compass Development Guide
> Last updated: 2026-04-15
> This is a development playbook. For thesis/project specs, see docs/ folder.

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
| Framework | Next.js | 15.1.0 | Server Components, App Router, edge-ready |
| Language | TypeScript | 5.7 | strict: true — type safety |
| Runtime | Node.js / React | 19.0.0 | Modern, stable |
| Styling | Tailwind CSS | 3.4.17 | Utility-first, compass-* tokens |
| Components | shadcn/ui | latest | Radix primitives, customizable |
| Icons | lucide-react | 0.469.0 | Beautiful, consistent |
| Drag & Drop | @hello-pangea/dnd | 18.0.1 | React 18+ fork |
| Backend / DB | Supabase | 2.47.0 | PostgreSQL + Auth + Realtime + RLS + Edge Fn |
| Supabase SSR | @supabase/ssr | 0.5.2 | Cookie-based server auth |
| AI | @anthropic-ai/sdk | latest | Claude API (assignee recommender) |
| Markdown | react-markdown | latest | Summary rendering |
| Toast | sonner | 1.7.1 | Notifications |
| Deployment | Vercel Hobby | — | Free tier, HTTPS, Git auto-deploy |

---

## 📁 STRUKTURA PROJEKTU

```
hotable-compass/
├── app/
│   ├── layout.tsx                     ← Root: fonts (Fraunces, Plus Jakarta, JetBrains)
│   ├── globals.css                    ← Design tokens (compass-bg, compass-accent, etc.)
│   ├── page.tsx                       ← Redirect → /my-day
│   ├── (auth)/
│   │   ├── layout.tsx                 ← Grid background
│   │   └── login/page.tsx             ← Magic link OTP form
│   ├── auth/
│   │   ├── callback/route.ts          ← OAuth code exchange
│   │   └── signout/route.ts           ← POST → clear session
│   ├── (dashboard)/
│   │   ├── layout.tsx                 ← Auth guard, Sidebar (9 routes)
│   │   ├── my-day/page.tsx            ← Focus Mode
│   │   ├── board/page.tsx             ← Sprint Board (Kanban + realtime)
│   │   ├── backlog/page.tsx           ← All tasks, assign to cycle
│   │   ├── team/page.tsx              ← Workload per member + AI suggestions
│   │   ├── decisions/page.tsx         ← ADR/RFC browser + editor
│   │   ├── ideas/page.tsx             ← Idea Inbox, ICE scoring
│   │   ├── goals/page.tsx             ← OKR tree, grant milestones
│   │   ├── weekly/page.tsx            ← Auto-generated summaries
│   │   └── gantt/page.tsx             ← Timeline
│   ├── actions/
│   │   ├── tasks.ts                   ← CRUD: tasks
│   │   ├── cycles.ts                  ← CRUD: cycles (sprints)
│   │   ├── projects.ts                ← CRUD: projects (NEW)
│   │   ├── users.ts                   ← READ: profiles
│   │   ├── goals.ts                   ← CRUD: goals
│   │   ├── ideas.ts                   ← CRUD: ideas, ICE, promote
│   │   ├── documents.ts               ← CRUD: ADR/RFC/spec/weekly
│   │   ├── weekly.ts                  ← Manual weekly summary generation
│   │   └── ai.ts                      ← NEW: AI server actions
│   │       ├── getAssigneeRecommendation()
│   │       ├── getWorkloadSuggestions()
│   │       └── categorizeTask()
├── components/
│   ├── ui/                            ← shadcn/ui (don't edit)
│   └── compass/
│       ├── sidebar.tsx                ← Fixed left nav
│       ├── login-form.tsx             ← OTP input
│       ├── page-header.tsx            ← Reusable title
│       ├── task-card.tsx              ← Task display
│       ├── task-detail-modal.tsx      ← Full editor + subtasks
│       ├── quick-add-task.tsx         ← Inline task creation
│       ├── sprint-board.tsx           ← Kanban with DnD, realtime
│       ├── backlog-view.tsx           ← Filterable task table
│       ├── team-view.tsx              ← Workload grid + AI suggestions
│       ├── workload-suggestions.tsx   ← NEW: AI suggestion chips
│       ├── assignee-suggestions.tsx   ← NEW: AI assignee recommendations
│       ├── decisions-view.tsx         ← Document browser + editor
│       ├── ideas-view.tsx             ← ICE scoring board
│       ├── idea-card.tsx              ← Idea display card
│       ├── goals-view.tsx             ← OKR tree + grant tracker
│       ├── gantt-view.tsx             ← Timeline visualization
│       ├── weekly-view.tsx            ← Markdown summary viewer
│       ├── wip-warning.tsx            ← >3 in-progress banner
│       ├── close-sprint-button.tsx    ← End sprint action
│       └── ai-badge.tsx               ← "✦ AI" label
├── lib/
│   ├── supabase/
│   │   ├── client.ts                  ← Browser Supabase client
│   │   ├── server.ts                  ← Server client
│   │   └── types.ts                   ← Generated types (don't edit manually)
│   ├── utils.ts                       ← calculateICE(), cn(), formatters, inferTaskType()
│   └── mock-data.ts                   ← Dev fallback
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql     ← Core 6 tables, enums, RLS
│   │   ├── 002_enhance_schema.sql     ← task_type, doc_status, goal_status
│   │   ├── 003_indexes.sql            ← Performance indexes (NEW)
│   │   └── 004_soft_delete.sql        ← deleted_at column (NEW)
│   └── functions/
│       └── generate-weekly-summary/
│           └── index.ts               ← Deno edge function (Fri 17:00 cron)
├── docs/
│   ├── ARCHITECTURE_AUDIT.md          ← Tech deep-dive
│   ├── FEATURES_STATUS.md             ← Feature completion matrix
│   ├── GAPS_AND_ISSUES.md             ← Known gaps + priorities
│   ├── SECURITY_REVIEW.md             ← Auth, RLS, input validation
│   ├── AI_INTEGRATION_PLAN.md         ← Exact AI feature specs
│   └── ROADMAP.md                     ← Week-by-week plan
├── .env.local.example                 ← Copy this to .env.local
├── .gitignore                         ← VERIFY .env.local is ignored
├── package.json                       ← Dependencies
├── tsconfig.json                      ← TypeScript strict: true
├── tailwind.config.js                 ← compass-* tokens
├── next.config.js                     ← ESLint, performance
└── README.md                          ← Setup instructions
```

---

## 📊 DATABASE SCHEMA

### 6 CORE TABLES

#### `profiles`
```
id          UUID PK (FK → auth.users)
email       TEXT UNIQUE NOT NULL
full_name   TEXT
avatar_url  TEXT
created_at  TIMESTAMP DEFAULT now()
updated_at  TIMESTAMP DEFAULT now()

RLS: SELECT all authenticated | UPDATE own row only
Trigger: handle_new_user() — auto-creates profile on signup
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
id              UUID PK
name            TEXT NOT NULL
start_date      DATE NOT NULL
end_date        DATE NOT NULL  CHECK(end_date > start_date)
goal            TEXT  (sprint goal)
is_active       BOOLEAN DEFAULT false  UNIQUE (only one at a time)
velocity_planned INTEGER
velocity_actual INTEGER
created_at      TIMESTAMP
updated_at      TIMESTAMP

RLS: CRUD all authenticated
Index: is_active (for getActiveCycle)
```

#### `tasks`
```
id              UUID PK
title           TEXT NOT NULL
description     TEXT  (Markdown)
status          ENUM (todo, in_progress, in_review, done, cancelled)
priority        ENUM (low, medium, high, urgent) DEFAULT 'medium'
type            ENUM (feature, bug, chore, research, design, marketing)
project_id      UUID FK → projects.id ON DELETE SET NULL
assignee_id     UUID FK → profiles.id ON DELETE SET NULL
parent_task_id  UUID FK → tasks.id ON DELETE CASCADE  (subtask)
cycle_id        UUID FK → cycles.id ON DELETE SET NULL
due_date        DATE
position        INTEGER DEFAULT 0  (for column ordering)
ai_suggested    BOOLEAN DEFAULT false
deleted_at      TIMESTAMP  (soft delete) (NEW)
created_at      TIMESTAMP
updated_at      TIMESTAMP

Indexes: project_id, assignee_id, cycle_id, status, parent_task_id
RLS: CRUD all authenticated
Triggers: prevent_deep_nesting(), update_updated_at(), check_parent_is_not_self()
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

Indexes: type (for filtering decisions) (NEW)
RLS: CRUD all authenticated
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
RLS: CRUD all authenticated
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
RLS: CRUD all authenticated
Index: status (for filtering) (NEW)
```

### NEW TABLE: `ai_feedback` (AI metrics tracking)
```
id              UUID PK
feature         TEXT NOT NULL  ('assignee_recommender', 'workload_balancing', 'auto_categorization')
task_id         UUID FK → tasks.id ON DELETE SET NULL
suggestion      JSONB  ({"assignee_id": "...", "score": 0.85, "reason": "..."})
accepted        BOOLEAN  (did user accept?)
override_value  JSONB  (what did user pick instead?)
created_at      TIMESTAMP

Purpose: Track AI feature effectiveness for metrics
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

## 📋 FEATURES IMPLEMENTATION PLAN

### WEEK 1: Foundation Fixes (Apr 15-21)
- [ ] Create `createCycle()` server action (1h)
- [ ] Add "New Sprint" modal to `/board` (3h)
- [ ] Create `createProject()` server action (1h)
- [ ] Add "New Project" modal (3h)
- [ ] Add `loading.tsx` skeletons (2h)
- [ ] Add `error.tsx` for dashboard (1h)
- [ ] Fix dev mode bypass (30min)

**Deliverable:** Team can create sprints/projects without Supabase Studio.

### WEEK 2: Auto-Categorization (Apr 22-28)
- [ ] Add `inferTaskType()` heuristic in `lib/utils.ts` (2h)
- [ ] Wire to task-detail-modal + quick-add (3h)
- [ ] Add velocity display to Sprint Board (2h)
- [ ] Add "Generate" button to weekly view (2h)
- [ ] Create `ai_feedback` table in migrations (1h)

**Deliverable:** Task type auto-suggested based on title.

### WEEK 3: Workload Balancing (Apr 29-May 5)
- [ ] Create `getWorkloadSuggestions()` in `app/actions/ai.ts` (4h)
- [ ] Create `workload-suggestions.tsx` component (3h)
- [ ] Wire to Team page (2h)
- [ ] Add "Move task" quick action (2h)
- [ ] Log to `ai_feedback` table (1h)

**Deliverable:** Team view shows AI workload balancing suggestions.

### WEEK 4: Assignee Recommender (May 6-12)
- [ ] Set up Anthropic SDK (30min)
- [ ] Create `getAssigneeRecommendation()` with Claude API (4h)
- [ ] Create `assignee-suggestions.tsx` (3h)
- [ ] Wire to task-detail-modal (2h)
- [ ] Seed historical task data (2h)
- [ ] Track AI acceptance metrics (1h)

**Deliverable:** Task creation shows assignee recommendations.

### WEEK 5: Testing + Security (May 13-19)
- [ ] Install Vitest + testing-library (30min)
- [ ] Unit tests for lib/utils.ts (3h)
- [ ] Unit tests for server actions (4h)
- [ ] Integration tests for AI actions (2h)
- [ ] Add Zod validation (3h)
- [ ] Add soft deletes (2h)
- [ ] AI metrics dashboard (3h)

**Deliverable:** 30%+ test coverage. AI metrics visible.

### WEEK 6: Polish (May 20-27)
- [ ] Lighthouse audit + optimization (2h)
- [ ] Add empty states to views (3h)
- [ ] Update README (1h)
- [ ] Final type checking + linting (30min)

**Deliverable:** Demo-ready, clean, stable.

---

## 🔐 SECURITY

### RLS Policy (all tables)
```sql
CREATE POLICY "authenticated" ON [table]
  FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Except profiles (self-update only):
CREATE POLICY "users_can_update_own_profile" ON profiles
  FOR UPDATE
  USING (auth.uid() = id);
```

**For 3-person team:** This is acceptable. If scaling, tighten to per-user isolation.

### Security Checklist
```
[x] Auth via magic link (no password = no leak risk)
[x] Session via HttpOnly cookies (@supabase/ssr)
[x] RLS enforced on all tables
[x] Parameterized queries (Supabase SDK)
[x] Environment variables in .env.local (not committed)
[ ] Input validation (Zod schemas — WEEK 5)
[ ] XSS prevention (verify markdown renderer)
[ ] Soft deletes (deleted_at column — WEEK 5)
[ ] Error boundaries (React error wrapping — WEEK 5)
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

# Supabase (local)
supabase start                    # Start local Supabase
supabase db reset                 # Reset DB to initial state
supabase db push                  # Apply new migrations
supabase gen types typescript --local > lib/supabase/types.ts

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
# After each migration:
supabase gen types typescript --local > lib/supabase/types.ts
```

---

## ⚠️ CZEGO NIE RÓB

```
❌ Nie dodawaj time trackingu (out of scope)
❌ Nie buduj drugiego Gantt chart (phase 4, nie teraz)
❌ Nie twórz własnego systemu komentarzy (GitHub Issues w przyszłości)
❌ Nie dodawaj custom fields (predefiniowane wystarczą)
❌ Nie twórz ról admina/managera (3 osoby = równe prawa)
❌ Nie instaluj Zustand/Redux (Server Components + URL state wystarczają)
❌ Nie używaj 'any' w TypeScript
❌ Nie commituj .env.local
❌ Nie zmieniaj kolorów bez aktualizacji design tokens
```

---

**For project specs, thesis info, architecture decisions → see docs/ folder**