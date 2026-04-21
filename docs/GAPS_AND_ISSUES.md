# GAPS AND ISSUES — Hotable Compass
> Generated: 2026-04-15

---

## CRITICAL GAPS (Blocking MVP launch)

### GAP-01: No Sprint (Cycle) Creation UI
**Impact: HIGH**

There is zero UI to create a new cycle. `getAllCycles()` and `closeCycle()` server actions exist, but no "New Sprint" form or modal. Currently, sprints must be created directly via Supabase Studio or SQL seed data.

**Files affected:** `app/actions/cycles.ts`, `app/(dashboard)/board/page.tsx`
**Fix:** Add "New Sprint" modal in `/board` page. Form fields: name, start_date, end_date, goal. Server action: `createCycle()`.
**Effort:** 1 day

---

### GAP-02: No Project Creation UI
**Impact: HIGH**

Same problem as cycles. Projects are referenced everywhere (task cards, filters, sidebar counts) but there is no UI to create them. Must be done via Supabase Studio.

**Files affected:** `app/actions/tasks.ts` (getProjects exists), no create action
**Fix:** Settings page or modal with project name, color, scope_tag. Server action: `createProject()`, `archiveProject()`.
**Effort:** 1 day

---

### GAP-03: No Team Onboarding / Invite Flow
**Impact: HIGH**

No way for a user to be invited to the workspace. New team members must be added via Supabase Auth dashboard (email invite) and profiles are auto-created on first login. No "Team Settings" UI exists.

**Fix:** Admin settings page with member list, invite by email (uses Supabase `auth.admin.inviteUserByEmail()`), remove member.
**Effort:** 2 days

---

### GAP-04: No `loading.tsx` — No Streaming / Suspense
**Impact: MEDIUM**

No route has a `loading.tsx` file. Server Component pages block until all data is fetched. If Supabase is slow or unavailable, users see a blank screen with no feedback.

**Fix:** Add `loading.tsx` skeleton screens for each dashboard route.
**Effort:** 0.5 days

---

### GAP-05: No Error Pages
**Impact: MEDIUM**

No `error.tsx` or `not-found.tsx`. If a server action throws or a route doesn't exist, Next.js shows a generic unbranded error page.

**Fix:** Add `error.tsx` (with "Retry" button) and `not-found.tsx` for the dashboard group.
**Effort:** 0.5 days

---

## FUNCTIONAL GAPS (Not blocking but needed soon)

### GAP-06: Weekly Summary "Trigger Now" Button Missing
**Impact: MEDIUM**

`app/actions/weekly.ts` has `generateWeeklySummary()` but there's no button in the weekly view UI to trigger it manually. The edge function runs on cron (Friday 17:00) but manual generation for testing/demo is needed.

**Fix:** Add "Generate" button in `weekly-view.tsx` that calls the server action.
**Effort:** 2 hours

---

### GAP-07: Velocity Not Displayed on Sprint Board
**Impact: LOW**

`cycles` table has `velocity_planned` and `velocity_actual` fields (migration 002). Sprint Board shows the cycle name and goal but not planned vs. actual story points.

**Fix:** Add velocity display to board page header.
**Effort:** 2 hours

---

### GAP-08: No Pagination on Task Queries
**Impact: MEDIUM** (grows over time)

`getAllTasksWithRelations()` fetches all tasks with no LIMIT or pagination. At 200+ tasks this will be noticeably slow.

**Files affected:** `app/actions/tasks.ts` line ~60+
**Fix:** Add `range()` or cursor pagination. Backlog view should load 50 tasks at a time with a "Load more" button.
**Effort:** 1 day

---

### GAP-09: Documents Have No Index on `type` Column
**Impact: LOW** (small table now)

`decisions-view.tsx` filters by document type client-side after fetching all documents. Once there are 50+ documents this is inefficient.

**Fix:** Add migration: `CREATE INDEX idx_documents_type ON documents(type);` and filter server-side.
**Effort:** 30 minutes

---

### GAP-10: ideas Table Has No Index on `status`
**Impact: LOW**

Same issue as above — `getIdeas()` fetches all ideas regardless of status and filters client-side.

**Fix:** Index + server-side filter in `getIdeas()`.
**Effort:** 30 minutes

---

### GAP-11: Duplicate Weekly Generation Logic
**Impact: MEDIUM** (maintenance debt)

`app/actions/weekly.ts` (manual trigger, 221 lines) and `supabase/functions/generate-weekly-summary/index.ts` (cron, 195 lines) implement similar markdown-generation logic independently. They will diverge.

**Fix:** Either (a) make the manual trigger call the edge function via HTTP, or (b) extract shared logic to a shared module. Option (a) is simpler — server action calls `supabase.functions.invoke('generate-weekly-summary')`.
**Effort:** 2 hours

---

### GAP-12: Mock Data Can Drift from Real Schema
**Impact: MEDIUM**

`lib/mock-data.ts` constructs TypeScript objects manually. When migrations add new columns (e.g., `task.type`, `idea.source`), the mock data may be missing those fields. TypeScript `strict` mode catches most cases but the mock types use loose casting in places.

**Fix:** Run `pnpm tsc --noEmit` regularly and update mocks after each migration.
**Effort:** Ongoing discipline

---

### GAP-13: No `position` Rebalancing Strategy
**Impact: MEDIUM**

Tasks have a `position: integer` field for column ordering in the Sprint Board. When tasks are dragged, `position` is updated. Over time, gaps between positions grow and ordering may become unstable (integer overflow unlikely but ordering bugs possible).

**Fix:** Rebalance positions after each drag (e.g., reassign sequential integers to all tasks in the column after a move). Current implementation may only update the moved task's position.
**Effort:** 1 day

---

## CODE QUALITY ISSUES

### ISSUE-01: No Tests
**Impact: HIGH** (for thesis, for confidence)

Zero test files. No unit tests, no integration tests, no e2e tests. Every refactor is done blind.

**Priority fix areas:**
- Server actions (pure functions — easy to unit test)
- ICE score calculation (`lib/utils.ts:calculateICE`)
- Schema constraints (test RLS policies with Supabase local)
- Sprint Board drag-drop logic

---

### ISSUE-02: No React Error Boundaries
**Impact: MEDIUM**

Client components (`sprint-board.tsx`, `decisions-view.tsx`, etc.) have no error boundary wrappers. A runtime error in one component crashes the whole dashboard.

**Fix:** Wrap large client components with `<ErrorBoundary fallback={<CompassError />}>`.
**Effort:** 2 hours

---

### ISSUE-03: Console.error Only for Dev Errors
**Impact: LOW** (dev stage OK, prod problem)

Server actions log errors with `console.error()`. In production (Netlify), these appear in function logs but there's no structured logging or error aggregation service (Sentry, etc.).

**Fix (future):** Add Sentry or Axiom for production error tracking.
**Effort:** 2 hours

---

### ISSUE-04: No Input Sanitization Beyond TypeScript Types
**Impact: MEDIUM**

Form inputs are typed via TypeScript but there's no runtime validation library (Zod, Valibot). Supabase parameterized queries prevent SQL injection, but malformed data (e.g., negative ICE scores, future-only due dates) could be submitted.

**Fix:** Add Zod schemas for each server action's input and parse before DB write.
**Effort:** 1 day

---

### ISSUE-05: `getProjects` in `tasks.ts` — Naming Inconsistency
**Impact: LOW**

`app/actions/tasks.ts` exports a `getProjects()` function — this should be in `app/actions/projects.ts` (which doesn't exist). As the project grows, tasks.ts will bloat.

**Fix:** Create `app/actions/projects.ts`, move project-related actions there.
**Effort:** 30 minutes

---

### ISSUE-06: No Mobile Layout
**Impact: LOW** (internal tool, desktop-first)

The sidebar and kanban board are desktop-only. On screens <768px the layout breaks. For a 3-person internal tool this is low priority but worth noting.

---

## SUMMARY TABLE

| ID | Category | Impact | Effort | Priority |
|----|----------|--------|--------|----------|
| GAP-01 | Missing feature | HIGH | 1d | 🔴 P1 |
| GAP-02 | Missing feature | HIGH | 1d | 🔴 P1 |
| GAP-03 | Missing feature | HIGH | 2d | 🔴 P1 |
| GAP-04 | UX | MEDIUM | 0.5d | 🟡 P2 |
| GAP-05 | UX | MEDIUM | 0.5d | 🟡 P2 |
| GAP-06 | UX | MEDIUM | 2h | 🟡 P2 |
| GAP-07 | UX | LOW | 2h | 🟢 P3 |
| GAP-08 | Performance | MEDIUM | 1d | 🟡 P2 |
| GAP-09 | Performance | LOW | 0.5h | 🟢 P3 |
| GAP-10 | Performance | LOW | 0.5h | 🟢 P3 |
| GAP-11 | Maintenance | MEDIUM | 2h | 🟡 P2 |
| GAP-12 | Maintenance | MEDIUM | ongoing | 🟡 P2 |
| GAP-13 | Bug risk | MEDIUM | 1d | 🟡 P2 |
| ISSUE-01 | Testing | HIGH | 3d | 🔴 P1 |
| ISSUE-02 | Stability | MEDIUM | 2h | 🟡 P2 |
| ISSUE-03 | Observability | LOW | 2h | 🟢 P3 |
| ISSUE-04 | Security | MEDIUM | 1d | 🟡 P2 |
| ISSUE-05 | Code org | LOW | 0.5h | 🟢 P3 |
| ISSUE-06 | UX | LOW | 2d | 🟢 P3 |
