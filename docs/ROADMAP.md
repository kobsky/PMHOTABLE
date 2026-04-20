# IMPLEMENTATION ROADMAP — Hotable Compass
> Generated: 2026-04-15 | Horizon: 6 weeks (to 2026-05-27)

---

## CURRENT STATE (before Week 1)

**Completion: ~72%** of planned features

What's solid:
- ✅ Auth (magic link + session)
- ✅ Sprint Board (DnD, WIP limits, realtime)
- ✅ Backlog (filters, cycle assignment)
- ✅ My Day (daily focus, WIP warning)
- ✅ Decisions / Ideas / Goals / Gantt (UI done)
- ✅ Weekly summary (edge function + viewer)
- ✅ Design system (dark theme, tokens)

What's missing that blocks real usage:
- ❌ Sprint creation UI
- ❌ Project creation UI
- ❌ Team invite/onboarding
- ❌ Any tests
- ❌ AI features (thesis requirement)

---

## WEEK 1 (2026-04-15 → 2026-04-21): Foundation Fixes

**Goal:** Make the app usable end-to-end without touching Supabase Studio.

### Tasks

| Task | File(s) | Effort |
|------|---------|--------|
| Create `createCycle()` server action | `app/actions/cycles.ts` | 1h |
| Add "New Sprint" modal to `/board` | `app/(dashboard)/board/page.tsx` | 3h |
| Create `createProject()` server action | `app/actions/projects.ts` (NEW) | 1h |
| Add "New Project" modal accessible from sidebar or backlog | `components/compass/sidebar.tsx` or new modal | 3h |
| Add `loading.tsx` skeletons for all dashboard routes | 9 files in `app/(dashboard)/*/` | 2h |
| Add `error.tsx` for dashboard group | `app/(dashboard)/error.tsx` | 1h |
| Fix: move `getProjects()` from tasks.ts to projects.ts | `app/actions/tasks.ts` → `app/actions/projects.ts` | 30min |
| Verify `.env.local` in `.gitignore` | `.gitignore` | 5min |
| Fix dev mode bypass — add prod guard | `lib/supabase/server.ts` | 30min |

**Week 1 deliverable:** Any team member can create a sprint and project without Supabase Studio access.

---

## WEEK 2 (2026-04-22 → 2026-04-28): Polish + AI Feature 1

**Goal:** Ship Auto-Categorization + fix key UX gaps.

### Tasks

| Task | File(s) | Effort |
|------|---------|--------|
| Add `inferTaskType()` keyword heuristic | `lib/utils.ts` | 2h |
| Wire auto-type to task creation modal | `components/compass/task-detail-modal.tsx` | 2h |
| Wire auto-type to quick-add | `components/compass/quick-add-task.tsx` | 1h |
| Add "Generate" button to weekly view | `components/compass/weekly-view.tsx` | 2h |
| Fix: merge weekly generation logic (action calls edge function) | `app/actions/weekly.ts` | 2h |
| Add velocity display to Sprint Board header | `app/(dashboard)/board/page.tsx` | 2h |
| Add DB indexes for documents.type and ideas.status | `supabase/migrations/003_indexes.sql` | 30min |
| Add `ai_feedback` table migration | `supabase/migrations/003_indexes.sql` | 1h |

**Week 2 deliverable:** Auto-categorization live. Weekly generation one-click. Performance indexes applied.

---

## WEEK 3 (2026-04-29 → 2026-05-05): AI Feature 2 — Workload Balancing

**Goal:** AI suggestions live in Team Dashboard.

### Tasks

| Task | File(s) | Effort |
|------|---------|--------|
| Set up Anthropic SDK (optional for this feature) | `package.json`, `.env.local` | 30min |
| Create `app/actions/ai.ts` with `getWorkloadSuggestions()` | NEW | 4h |
| Create `components/compass/workload-suggestions.tsx` | NEW | 3h |
| Wire suggestions to Team page | `app/(dashboard)/team/page.tsx` | 2h |
| Add "Move task" action from suggestion (reassign without opening modal) | `app/actions/tasks.ts` | 2h |
| Log AI suggestions to `ai_feedback` table | `app/actions/ai.ts` | 1h |
| Add Zod validation to top 3 most-used server actions | `app/actions/tasks.ts`, `cycles.ts`, `ideas.ts` | 3h |

**Week 3 deliverable:** Team page shows AI workload suggestions. Foundation for tracking AI acceptance.

---

## WEEK 4 (2026-05-06 → 2026-05-12): AI Feature 3 — Assignee Recommender

**Goal:** Assignee recommendations in task creation. Thesis showcase piece.

### Tasks

| Task | File(s) | Effort |
|------|---------|--------|
| Add `getAssigneeRecommendation()` server action (Claude API) | `app/actions/ai.ts` | 4h |
| Create `components/compass/assignee-suggestions.tsx` | NEW | 3h |
| Wire to task-detail-modal (show after title input) | `components/compass/task-detail-modal.tsx` | 2h |
| Seed historical task data for demo | `supabase/seed.sql` or Supabase Studio | 2h |
| Track accepted/rejected suggestions in `ai_feedback` | `app/actions/ai.ts` | 1h |
| Add `NEXT_PUBLIC_AI_*` feature flags | `.env.local`, layout.tsx | 1h |

**Week 4 deliverable:** Full AI feature set complete. User can see and accept AI suggestions for assignee.

---

## WEEK 5 (2026-05-13 → 2026-05-19): Testing + Security + Metrics

**Goal:** Add test infrastructure and harden security for thesis submission.

### Tasks

| Task | File(s) | Effort |
|------|---------|--------|
| Install Vitest + testing-library | `package.json` | 30min |
| Write unit tests for `lib/utils.ts` (ICE, date formatters, inferTaskType) | `lib/utils.test.ts` | 3h |
| Write unit tests for server actions (mock Supabase client) | `app/actions/*.test.ts` | 4h |
| Write integration tests for AI actions (mock Anthropic client) | `app/actions/ai.test.ts` | 2h |
| Verify markdown renderer in weekly-view for XSS | `components/compass/weekly-view.tsx` | 1h |
| Add soft deletes for tasks (add `deleted_at` column) | `supabase/migrations/004_soft_delete.sql` | 2h |
| Add `pnpm audit` to CI / README | `package.json` or `README.md` | 30min |
| Add AI acceptance rate dashboard section | `app/(dashboard)/team/page.tsx` | 3h |

**Week 5 deliverable:** >30% test coverage on critical paths. Security holes closed. AI metrics visible.

---

## WEEK 6 (2026-05-20 → 2026-05-27): Polish + Thesis Docs

**Goal:** Thesis-ready state: stable, documented, demo-able.

### Tasks

| Task | File(s) | Effort |
|------|---------|--------|
| Run Lighthouse audit — optimize bundle size | `.next/`, `next.config.ts` | 2h |
| Add `not-found.tsx` global 404 page | `app/not-found.tsx` | 30min |
| Final UX sweep: empty states on all views | All view components | 3h |
| Document AI feature decisions in Decision Log | Supabase Studio / app | 2h |
| Write architecture ADR: "Why Claude API for recommender" | Decisions view in app | 1h |
| Record demo video (My Day → Board → AI suggestions → Team view) | Screen recording | 2h |
| Update README with setup instructions | `README.md` | 1h |
| Final `pnpm tsc --noEmit` + `pnpm lint` clean run | — | 30min |

**Week 6 deliverable:** Demo-ready. Thesis chapter on AI integration supported by real data from `ai_feedback` table.

---

## SUMMARY TIMELINE

```
Week 1 (Apr 15-21): Foundation — sprint/project creation UI, loading states, error pages
Week 2 (Apr 22-28): AI #1 — Auto-categorization + weekly gen fix + DB indexes
Week 3 (Apr 29-May 5): AI #2 — Workload balancing suggestions in Team view
Week 4 (May 6-12):  AI #3 — Assignee recommender via Claude API
Week 5 (May 13-19): Testing + security hardening + AI metrics dashboard
Week 6 (May 20-27): Polish + thesis documentation + demo recording
```

---

## RISK REGISTER

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Claude API costs exceed budget | LOW | MEDIUM | Use caching + only call on user action (not on every keystroke). Use keyword heuristics as fallback. |
| Supabase free tier limits hit | LOW | HIGH | Monitor at Supabase dashboard. Optimize queries (pagination). |
| Realtime subscription drops | MEDIUM | LOW | Sprint Board handles disconnect gracefully (page reload refreshes data). |
| Migration breaks existing data | LOW | HIGH | Always test migrations locally with `supabase db reset` before applying to prod. |
| `@hello-pangea/dnd` incompatible with React 19 | LOW | HIGH | Already in use and working. Keep version locked. |
| Thesis deadline creep | MEDIUM | HIGH | AI features are independent — can ship 1 or 2 of 3 if time runs short. Auto-categorization (Week 2) is the easiest — prioritize it first. |

---

## OPTIONAL / STRETCH GOALS (if ahead of schedule)

- Global search (Supabase full-text search on tasks + documents)
- Mobile-responsive layout (Tailwind breakpoints)
- Gantt: task-level granularity (currently only cycle/milestone)
- Export weekly summary as PDF
- Grant PARP dedicated budget view with bar charts
- Team invite UI (Supabase admin invite)
