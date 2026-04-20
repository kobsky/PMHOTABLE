# Hotable Compass

Internal PM tool for **Hotable Sp. z o.o.** — a 3-person tech startup building a hotel management SaaS.

Combines daily task execution, strategic decision tracking, and grant compliance reporting into a single async-first workspace.

---

## What It Does

| View | Purpose |
|------|---------|
| **My Day** | Personal focus board — active tasks, daily progress |
| **Sprint Board** | Kanban with drag-and-drop, WIP limits, realtime sync |
| **Backlog** | All tasks, filterable, assignable to sprints |
| **Team** | Per-member workload, AI balancing suggestions |
| **Goals** | OKR tree (Objectives → Key Results) + Grant PARP milestone tracker with budget |
| **Ideas** | Idea Inbox with ICE scoring (Impact/Confidence/Ease), promote to task |
| **Decisions** | ADR/RFC/Spec document browser with Accept/Deprecate workflow |
| **Weekly** | Auto-generated weekly summaries (manual trigger or Friday 17:00 cron) |
| **Gantt** | Timeline view of sprints and grant milestones |

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15.1 (App Router, Server Components) |
| Language | TypeScript 5.7 (`strict: true`) |
| Styling | Tailwind CSS 3.4 + custom `compass-*` design tokens |
| Components | shadcn/ui (Radix primitives) |
| Drag & Drop | @hello-pangea/dnd |
| Backend / DB | Supabase (PostgreSQL + Auth + Realtime + RLS + Edge Functions) |
| AI | Anthropic Claude API (assignee recommender) |
| Deployment | Vercel Hobby |

---

## Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)
- Supabase CLI (`brew install supabase/tap/supabase` or see [docs](https://supabase.com/docs/guides/cli))
- A Supabase project (free tier works)

---

## Local Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd hotable-compass
pnpm install
```

### 2. Environment variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# AI features (optional — app works without this)
ANTHROPIC_API_KEY=sk-ant-...
```

Get your Supabase URL and anon key from: **Project Settings → API**.

### 3. Apply database migrations

```bash
supabase login
supabase link --project-ref your-project-ref

# Apply all migrations
supabase db push
```

Migrations are in `supabase/migrations/`:
- `001_initial_schema.sql` — 6 core tables, enums, RLS policies
- `002_enhance_schema.sql` — task_type, doc_status, goal_status enums
- `003_indexes.sql` — performance indexes
- `004_soft_delete.sql` — deleted_at, ai_suggested, ai_feedback table

### 4. Run development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). You'll be redirected to `/login`.

### 5. First login

The app uses **magic link auth** (passwordless). Enter your email — Supabase sends a one-time code. A user profile is created automatically on first sign-in.

For local dev without Supabase configured, the app falls back to mock data automatically.

---

## Database Schema

Six core tables: `profiles`, `projects`, `cycles`, `tasks`, `documents`, `goals`, `ideas` + `ai_feedback` for AI metrics.

All tables use Row Level Security (RLS) — authenticated users have full CRUD access. Profile updates are self-only.

See `ARCHITECTURE_DECISIONS.md` for schema design rationale.

---

## AI Features

Three AI capabilities, all opt-in and gracefully degraded (work without `ANTHROPIC_API_KEY`):

1. **Auto-categorization** — keyword heuristics infer task type (bug/feature/chore/etc.) from title
2. **Workload balancing** — rule-based suggestions on Team page when load diff ≥ 2 tasks
3. **Assignee recommender** — Claude Haiku API call, analyzes team task history to suggest best assignee

See `docs/AI_FEATURES.md` for prompts, accuracy expectations, and metrics.

---

## Key Commands

```bash
pnpm dev              # Start dev server (localhost:3000)
pnpm build            # Production build
pnpm lint             # ESLint
pnpm tsc --noEmit     # Type check

# Supabase
supabase start                    # Start local Supabase instance
supabase db reset                 # Reset to migrations
supabase db push                  # Apply new migrations
supabase gen types typescript --local > lib/supabase/types.ts
supabase functions serve          # Local edge function testing
supabase functions deploy generate-weekly-summary
```

---

## Project Structure

```
app/
  (auth)/login/          ← Magic link OTP
  (dashboard)/           ← All 9 views, auth-guarded
  actions/               ← Server Actions (tasks, goals, ideas, documents, ai…)
  auth/                  ← OAuth callback + signout routes
components/
  compass/               ← All feature components
  ui/                    ← shadcn/ui primitives (don't edit)
lib/
  supabase/              ← Client, server, types
  utils.ts               ← inferTaskType(), calculateICE(), cn(), formatters
  mock-data.ts           ← Dev fallback when not authenticated
supabase/
  migrations/            ← SQL migrations (run in order)
  functions/             ← Deno edge functions
docs/
  ARCHITECTURE_AUDIT.md
  AI_FEATURES.md
  FEATURES_STATUS.md
  SECURITY_REVIEW.md
  ROADMAP.md
```

---

## Edge Function: Weekly Summary

Deno edge function at `supabase/functions/generate-weekly-summary/`:

- Reads last 7 days of tasks, documents, and ideas
- Builds a Markdown summary and saves it as a `weekly_summary` document
- Triggered automatically every **Friday at 17:00** (configure in `supabase/config.toml`)
- Also callable manually from the `/weekly` page

Deploy:
```bash
supabase functions deploy generate-weekly-summary
```

---

## Design System

Dark mode, high-contrast. Design tokens in `app/globals.css`:

| Token | Value | Use |
|-------|-------|-----|
| `--compass-bg` | `#0F0F0E` | Canvas |
| `--compass-surface` | `#171715` | Cards |
| `--compass-accent` | `#E8622A` | Primary actions |
| `--compass-success` | `#4BAF87` | Done / positive |
| `--compass-warning` | `#F5A83A` | At-risk / budget |
| `--compass-danger` | `#DE4040` | Errors / overdue |
| `--compass-text` | `#EAE8DF` | Body text |
| `--compass-muted` | `#848179` | Secondary text |

Fonts: **Fraunces** (display), **Plus Jakarta Sans** (body), **JetBrains Mono** (labels/code).

---

## Security Notes

- No passwords — magic link only (no credential leak risk)
- Sessions via HttpOnly cookies (`@supabase/ssr`)
- RLS enforced on all 7 tables
- Parameterized queries via Supabase SDK
- `ANTHROPIC_API_KEY` is server-only — never exposed to client

---

## Out of Scope

Per the project spec, the following are intentionally excluded:
- Time tracking
- Comments / mentions (GitHub Issues in future)
- Custom fields
- Admin/manager roles (3 people = equal rights)
- Zustand / Redux (Server Components + URL state suffice)
