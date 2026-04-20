# ARCHITECTURE AUDIT — Hotable Compass
> Generated: 2026-04-15

---

## 1. TECH STACK (as-built)

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Framework | Next.js | 15.1.0 | App Router, Server Components |
| Language | TypeScript | 5.7 | Strict mode ON |
| Runtime | Node.js / React | 19.0.0 | |
| Styling | Tailwind CSS | 3.4.17 | Custom `compass-*` design tokens |
| Component library | shadcn/ui (Radix UI) | mixed | Avatar, Dialog, Dropdown, Select, Tooltip |
| Icons | lucide-react | 0.469.0 | |
| Toast | Sonner | 1.7.1 | |
| Drag & drop | @hello-pangea/dnd | 18.0.1 | Fork of react-beautiful-dnd, React 18+ compat |
| Backend / DB | Supabase | 2.47.0 | PostgreSQL + Auth + Realtime + Edge Functions |
| Supabase SSR | @supabase/ssr | 0.5.2 | Cookie-based server auth |
| Deployment | Vercel Hobby | — | |
| Linting | ESLint 9 | 9.x | next config |

---

## 2. PROJECT STRUCTURE

```
C:\Users\User\Desktop\PMHOTABLE/
├── app/
│   ├── layout.tsx                  ← Root layout: fonts (Fraunces/PlusJakarta/JetBrainsMono), Sonner
│   ├── page.tsx                    ← Redirect → /my-day
│   ├── globals.css                 ← Design system: compass-* tokens, component classes
│   ├── (auth)/
│   │   ├── layout.tsx              ← Grid-bg layout
│   │   └── login/page.tsx          ← Magic link form
│   ├── auth/
│   │   ├── callback/route.ts       ← OAuth code exchange → session
│   │   └── signout/route.ts        ← POST → clear session → /login
│   ├── (dashboard)/
│   │   ├── layout.tsx              ← Auth guard + Sidebar
│   │   ├── my-day/page.tsx         ← Daily focus view
│   │   ├── board/page.tsx          ← Sprint Kanban board
│   │   ├── backlog/page.tsx        ← All tasks + cycle assignment
│   │   ├── team/page.tsx           ← Workload per member
│   │   ├── decisions/page.tsx      ← Document (ADR/RFC) browser
│   │   ├── ideas/page.tsx          ← Idea Inbox + ICE scoring
│   │   ├── goals/page.tsx          ← OKR + grant milestones
│   │   ├── weekly/page.tsx         ← Auto-generated weekly summaries
│   │   └── gantt/page.tsx          ← Timeline (cycles + milestones)
│   └── actions/
│       ├── tasks.ts                ← CRUD: tasks
│       ├── users.ts                ← Read: profiles
│       ├── cycles.ts               ← CRUD: cycles, sprint management
│       ├── goals.ts                ← CRUD: goals
│       ├── ideas.ts                ← CRUD: ideas + promote-to-task
│       ├── documents.ts            ← CRUD: ADR/RFC/spec
│       └── weekly.ts               ← Manual weekly summary generation
├── components/
│   ├── ui/                         ← shadcn/ui primitives (do not edit)
│   └── compass/
│       ├── sidebar.tsx             ← Fixed left nav (9 items, phase-grouped)
│       ├── login-form.tsx          ← OTP flow
│       ├── task-card.tsx           ← Reusable task display
│       ├── sprint-board.tsx        ← DnD kanban + realtime subscription
│       ├── backlog-view.tsx        ← Filterable task table
│       ├── quick-add-task.tsx      ← Inline task creation
│       ├── task-detail-modal.tsx   ← Full task editor + subtasks
│       ├── page-header.tsx         ← Reusable page title
│       ├── close-sprint-button.tsx ← End sprint action
│       ├── wip-warning.tsx         ← >3 in-progress banner
│       ├── weekly-view.tsx         ← Summary markdown viewer
│       ├── decisions-view.tsx      ← Document browser + editor
│       ├── goals-view.tsx          ← OKR tree + milestone tracker
│       ├── ideas-view.tsx          ← Idea pipeline + ICE sort
│       ├── gantt-view.tsx          ← Timeline chart
│       └── idea-card.tsx           ← Idea display card
├── lib/
│   ├── supabase/
│   │   ├── client.ts               ← Browser Supabase client
│   │   ├── server.ts               ← Server client + getAuthenticatedClient()
│   │   └── types.ts                ← Enums + interfaces (127 lines)
│   ├── utils.ts                    ← cn(), ICE calc, date formatters, label helpers
│   └── mock-data.ts                ← Dev fallback: 3 users, 3 projects, 20+ tasks
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql  ← Core schema: 6 tables, enums, triggers, RLS
│   │   └── 002_enhance_schema.sql  ← Enhancements: task_type, doc_status, goal_status, velocities
│   └── functions/
│       └── generate-weekly-summary/
│           └── index.ts            ← Deno edge function (195 lines)
└── docs/                           ← compass-spec.md + this audit
```

---

## 3. ROUTING ARCHITECTURE

**Pattern:** Next.js 15 App Router with route groups.

| Group | Purpose | Auth Required |
|-------|---------|--------------|
| `(auth)` | Login, magic link | No |
| `/auth/*` | Callbacks, signout | No (system routes) |
| `(dashboard)` | All app views | Yes — layout guard redirects to /login |

**Auth guard mechanism:** `app/(dashboard)/layout.tsx` calls `createClient()` from server, checks `getUser()`. In dev mode (no Supabase keys), falls back to `MOCK_USERS[0]` — allowing local development without a Supabase instance.

---

## 4. DATA FLOW

```
User action (click / form / DnD)
     │
     ▼
Client Component (e.g., sprint-board.tsx)
     │  calls Server Action
     ▼
app/actions/*.ts
     │  calls getAuthenticatedClient()
     ├─ [prod] → Supabase query (RLS enforced)
     └─ [dev]  → MOCK_DATA fallback
     │
     ▼
revalidatePath() → Next.js cache invalidated
     │
     ▼
Server Component re-renders with fresh data
```

**Realtime path (Sprint Board only):**
```
Supabase postgres_changes channel (tasks table, filtered by cycle_id)
     │
     ▼
sprint-board.tsx useEffect subscription
     │
     ▼
setTasks() → local state update (no revalidatePath needed)
```

---

## 5. DATABASE SCHEMA

### Tables

```
TABLE: profiles
├─ id: UUID PK (FK → auth.users)
├─ email: text UNIQUE NOT NULL
├─ full_name: text
├─ avatar_url: text
├─ created_at: timestamptz DEFAULT now()
└─ updated_at: timestamptz DEFAULT now()
   Trigger: handle_new_user() — auto-creates profile on signup
   RLS: SELECT all authenticated | UPDATE own row only

TABLE: projects
├─ id: UUID PK DEFAULT gen_random_uuid()
├─ name: text NOT NULL
├─ scope_tag: scope_tag ENUM
├─ description: text
├─ color: text DEFAULT '#848179'
├─ is_archived: boolean DEFAULT false
├─ created_at, updated_at: timestamptz
   RLS: CRUD all authenticated

TABLE: cycles
├─ id: UUID PK
├─ name: text NOT NULL
├─ start_date: date NOT NULL
├─ end_date: date NOT NULL  CHECK(end_date > start_date)
├─ goal: text
├─ is_active: boolean DEFAULT false
│   UNIQUE INDEX: only one active cycle at a time
├─ velocity_planned: integer   ← added in migration 002
├─ velocity_actual: integer    ← added in migration 002
├─ created_at, updated_at: timestamptz
   RLS: CRUD all authenticated

TABLE: tasks
├─ id: UUID PK
├─ title: text NOT NULL
├─ description: text
├─ status: task_status ENUM (todo, in_progress, done, cancelled)
├─ priority: task_priority ENUM (low, medium, high, urgent) DEFAULT 'medium'
├─ type: task_type ENUM (feature, bug, chore, research, design, marketing) DEFAULT 'feature'
├─ project_id: UUID FK → projects.id ON DELETE SET NULL
├─ assignee_id: UUID FK → profiles.id ON DELETE SET NULL
├─ parent_task_id: UUID FK → tasks.id ON DELETE CASCADE (max depth=1)
├─ cycle_id: UUID FK → cycles.id ON DELETE SET NULL
├─ due_date: date
├─ position: integer DEFAULT 0  (for ordering in columns)
├─ created_at, updated_at: timestamptz
   Indexes: project_id, assignee_id, cycle_id, status, parent_task_id
   Trigger: prevent_deep_nesting() — blocks subtask of subtask
   Trigger: update_updated_at() — auto-update timestamp
   RLS: CRUD all authenticated

TABLE: documents
├─ id: UUID PK
├─ title: text NOT NULL
├─ type: document_type ENUM (adr, rfc, spec, weekly_summary)
├─ status: document_status ENUM (draft, review, accepted, deprecated, superseded) DEFAULT 'draft'
├─ content: text
├─ project_id: UUID FK → projects.id ON DELETE SET NULL
├─ author_id: UUID FK → profiles.id ON DELETE SET NULL
├─ created_at, updated_at: timestamptz
   RLS: CRUD all authenticated

TABLE: goals
├─ id: UUID PK
├─ title: text NOT NULL
├─ type: goal_type ENUM (objective, key_result, grant_milestone)
├─ status: goal_status ENUM (on_track, at_risk, off_track, achieved) DEFAULT 'on_track'
├─ description: text
├─ progress: integer DEFAULT 0  CHECK(0-100)
├─ target_value: numeric
├─ current_value: numeric
├─ unit: text
├─ quarter: text
├─ budget_planned_pln: numeric
├─ budget_actual_pln: numeric
├─ parent_goal_id: UUID FK → goals.id ON DELETE SET NULL
├─ due_date: date
├─ created_at, updated_at: timestamptz
   RLS: CRUD all authenticated

TABLE: ideas
├─ id: UUID PK
├─ title: text NOT NULL
├─ description: text
├─ status: idea_status ENUM (inbox, accepted, rejected, converted)
├─ source: idea_source ENUM (founders_meeting, user_feedback, competitor, market, other)
├─ ice_impact: integer CHECK(1-10)
├─ ice_confidence: integer CHECK(1-10)
├─ ice_ease: integer CHECK(1-10)
├─ ice_score: numeric GENERATED ALWAYS AS ((ice_impact+ice_confidence+ice_ease)/3.0) STORED
├─ rejection_reason: text  (REQUIRED if status='rejected')
├─ promoted_to_task_id: UUID FK → tasks.id ON DELETE SET NULL
├─ author_id: UUID FK → profiles.id ON DELETE SET NULL
├─ created_at, updated_at: timestamptz
   Constraint: CHECK(status != 'rejected' OR rejection_reason IS NOT NULL)
   RLS: CRUD all authenticated
```

### Schema quality assessment

| Criterion | Status | Notes |
|-----------|--------|-------|
| Normalized | ✅ | No obvious redundancy |
| Foreign keys | ✅ | All relationships declared |
| Indexes on FK columns | ✅ | tasks: project_id, assignee_id, cycle_id, status, parent_task_id |
| Index on frequently queried | 🟡 | ideas: no index on status; documents: no index on type |
| Constraints | ✅ | ICE 1-10, rejection_reason required, cycle end>start |
| Triggers | ✅ | Anti-nesting, auto-timestamps, auto-profile |
| RLS | 🟡 | All "authenticated = full access" — no per-user isolation |
| Audit trail | ❌ | No history/audit log table |
| Soft deletes | ❌ | Hard deletes only (except is_archived on projects) |
| ENUM migration safety | 🟡 | Adding values to PG enums requires careful migration ordering |

---

## 6. DESIGN SYSTEM

**Color palette (dark, high-contrast):**
```
compass-bg:        #0F0F0E  (canvas)
compass-surface:   #171715  (card level 1)
compass-surface-2: #1E1E1C  (card level 2)
compass-surface-3: #262623  (card level 3)
compass-border:    #2A2A27
compass-text:      #EAE8DF  (cream white)
compass-muted:     #848179  (taupe)
compass-accent:    #E8622A  (orange — primary action)
compass-success:   #4BAF87  (green)
compass-warning:   #F5A83A  (gold)
compass-danger:    #DE4040  (red)
```

**Typography hierarchy:**
- Display headings: Fraunces (serif) — used for page titles, brand
- Body: Plus Jakarta Sans — used for all UI text
- Code/mono: JetBrains Mono — labels, IDs, tech notation

**Component token system:** `.compass-card`, `.compass-btn-primary`, `.compass-badge-*`, `.priority-dot-*`, `.compass-input` — consistent class names across all components.

---

## 7. ARCHITECTURE STRENGTHS

1. **Server-first data fetching** — pages fetch data in Server Components, no waterfall client fetches
2. **Clean action layer** — `app/actions/` isolates all DB logic; components never import Supabase directly
3. **Graceful dev fallback** — mock data enables work without a live Supabase instance
4. **Type safety end-to-end** — `lib/supabase/types.ts` covers all DB entities; strict TS enabled
5. **Realtime scoped correctly** — only Sprint Board subscribes to live updates (appropriate, not over-engineered)
6. **Design system** — consistent color tokens and component classes; not relying on arbitrary Tailwind values
7. **Schema constraints** — DB-level validation (ICE range, rejection_reason, depth limit) not just UI validation

## 8. ARCHITECTURE WEAKNESSES

1. **RLS = "logged in = all access"** — No tenant/team isolation at DB level; risky if multi-tenant in future
2. **No optimistic updates except DnD** — Status changes outside Sprint Board feel slow (full server round-trip)
3. **No pagination** — `getAllTasksWithRelations()` fetches all tasks; will degrade at scale
4. **No error boundaries** — Client components have no React Error Boundary wrappers
5. **Weekly action duplicates edge function** — `app/actions/weekly.ts` and `supabase/functions/generate-weekly-summary` do similar things; risk of divergence
6. **Mock data and real data diverge** — `mock-data.ts` can drift from real schema; no type check enforces alignment
7. **No loading states** — Server Component pages have no `loading.tsx` for streaming/suspense
8. **ESLint but no Prettier** — Code style consistency relies on author discipline
9. **No testing infrastructure** — Zero test files in the codebase
