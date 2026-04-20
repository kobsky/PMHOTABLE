# FEATURES STATUS MATRIX — Hotable Compass
> Generated: 2026-04-15

Legend: ✅ DONE | 🟡 PARTIAL | ❌ NOT STARTED | N/A = out of scope per CLAUDE.md

---

## TIER 1 — MUST HAVE (MVP / Phase 1)

| Feature | Status | % | Notes |
|---------|--------|---|-------|
| Sign up / Login | ✅ DONE | 90% | Magic link OTP works. No email/password, no Google OAuth. Missing: password reset UX (not needed for magic link), account deletion. |
| Auth callback & session | ✅ DONE | 100% | `/auth/callback` exchanges code, redirects correctly. Signout clears session. |
| Dashboard layout | ✅ DONE | 95% | Sidebar nav, 9 routes, responsive-ish. Missing: mobile hamburger. |
| Create/edit/delete tasks | ✅ DONE | 90% | Full CRUD via server actions. Task detail modal with title, description, status, priority, type, project, assignee, due date, subtasks. Missing: bulk delete, archive. |
| Task status workflow | ✅ DONE | 85% | todo → in_progress → done → cancelled. Drag-drop on board. Status picker in modal. Missing: keyboard shortcuts. |
| Task detail view | ✅ DONE | 85% | `task-detail-modal.tsx` (484 lines). Subtask creation inline. Missing: activity log, comments, file attachments. |
| Sprint Board (Kanban) | ✅ DONE | 90% | DnD via @hello-pangea/dnd. WIP limit (3 in_progress). Realtime sync. Optimistic updates. Active cycle display. Missing: velocity display on board. |
| Create/manage sprints (Cycles) | 🟡 PARTIAL | 65% | Close sprint button exists. Cycle creation form: MISSING from UI (must be done via Supabase Studio or seed data). `getAllCycles()` and `getActiveCycle()` implemented. |
| Sprint progress tracking | 🟡 PARTIAL | 50% | Board shows columns count implicitly. No velocity/burndown chart. velocity_planned/velocity_actual in schema but not displayed. |
| Backlog | ✅ DONE | 80% | `backlog-view.tsx` — all tasks, filter by project/status/assignee, assign to cycle. Missing: bulk operations, priority drag-reorder. |
| My Day / My Tasks | ✅ DONE | 85% | Greeting, progress bar, WIP warning, tasks by section (Active/Todo/Done), quick-add. Missing: focus timer, keyboard-only mode. |
| Create projects | 🟡 PARTIAL | 30% | Schema, types, and helpers exist. Project selector in task modal works. No "Create Project" UI — must be done in Supabase Studio. |
| Project overview | ❌ NOT STARTED | 0% | No `/projects/[id]` route. No project-level stats. |
| Team member profiles | 🟡 PARTIAL | 40% | Profiles in DB with auto-create trigger. `getProfiles()` server action exists. No `/profile/[id]` page. No edit profile UI. |
| Team visibility / workload | 🟡 PARTIAL | 60% | `team/page.tsx` shows in_progress/todo/done per member with WIP badges. Missing: capacity %, assignment history, load over time. |
| Activity log | ❌ NOT STARTED | 0% | No audit table in schema. No activity feed anywhere. |
| Global search | ❌ NOT STARTED | 0% | No search UI. No Supabase full-text search query. |
| Advanced filters | 🟡 PARTIAL | 40% | Backlog has project/status/assignee filters. No date-range filter, no multi-select, no saved filters. |
| Real-time collaboration | 🟡 PARTIAL | 50% | Sprint Board has realtime. Other views don't. No conflict detection. No presence indicators. |
| Comments & mentions | ❌ NOT STARTED | 0% | CLAUDE.md notes: "GitHub Issues in future". Out of scope for now. |
| Recurring tasks | ❌ NOT STARTED | 0% | Not in schema. Not planned in CLAUDE.md. |
| Organization setup | ❌ NOT STARTED | 0% | No multi-tenant/org concept. 3 people = flat structure. Workaround: seed data manually. |
| Add team members | ❌ NOT STARTED | 0% | No invite flow. No admin panel. Team configured via Supabase auth dashboard. |
| User roles | N/A | — | CLAUDE.md: "3 people = equal rights". No role system planned. |

---

## TIER 2 — SHOULD HAVE (Phase 2)

| Feature | Status | % | Notes |
|---------|--------|---|-------|
| My Day view | ✅ DONE | 85% | Implemented. See Tier 1 above. |
| Team Dashboard | 🟡 PARTIAL | 60% | Basic workload per person. Missing: trends, capacity, burnout indicators. |
| Decision Log view | ✅ DONE | 80% | `decisions-view.tsx` (409 lines). Filter by type/status, full viewer, inline editor, status transitions (draft→review→accepted). Missing: version history, linked tasks. |
| Ideas Inbox | ✅ DONE | 85% | `ideas-view.tsx` + `idea-card.tsx`. ICE scoring, auto-sort, status workflow, promote-to-task. Missing: bulk actions, idea voting (multi-user). |
| ICE Scoring | ✅ DONE | 95% | DB: computed column. UI: sliders for each dimension. Auto-sort by ICE score. `calculateICE()` utility. |
| Weekly Summary auto-generation | 🟡 PARTIAL | 70% | Edge function: 100% done (Deno, Friday 17:00 cron). Manual trigger: via `app/actions/weekly.ts`. Viewer: `weekly-view.tsx` with markdown render. Missing: cron schedule not verified deployed; no "trigger now" button in UI. |
| Daily async check-in UI | ❌ NOT STARTED | 0% | Not in current scope. Could be My Day + a standup form. |
| OKR/Goals module | 🟡 PARTIAL | 70% | `goals-view.tsx` (657 lines). OKR tree, progress sliders, parent-child, status (on_track/at_risk/off_track/achieved). Schema has target/current values, quarters, budget fields. Missing: key result auto-rollup from tasks. |
| Grant Milestone Tracker | 🟡 PARTIAL | 60% | Goals with type=grant_milestone render in goals view. budget_planned/budget_actual in schema. Missing: dedicated grant view, budget progress bar, reporting export. |

---

## TIER 3 — PHASE 3 (Planned)

| Feature | Status | % | Notes |
|---------|--------|---|-------|
| Goals/OKR module | 🟡 PARTIAL | 70% | See Tier 2. |
| Grant tracker | 🟡 PARTIAL | 60% | See Tier 2. |
| Gantt / Timeline | 🟡 PARTIAL | 65% | `gantt-view.tsx` (460 lines). Shows cycles and milestones on timeline. Missing: task-level granularity on gantt, zoom controls, export. |
| Weekly Summary auto-gen | 🟡 PARTIAL | 70% | See Tier 2. |

---

## AI FEATURES (Future)

| Feature | Status | % | Notes |
|---------|--------|---|-------|
| Task Recommender (assignee) | ❌ NOT STARTED | 0% | No backend. No UI. Integration point: task creation modal. |
| Workload Balancing | ❌ NOT STARTED | 0% | No backend. Team page shows load but no suggestions. |
| Auto-Categorization | ❌ NOT STARTED | 0% | No NLP. No API endpoint. Integration point: task creation. |

---

## VIEWS INVENTORY

| Route | Component | Status | Lines |
|-------|-----------|--------|-------|
| `/login` | login-form.tsx | ✅ Done | 104 |
| `/my-day` | inline page | ✅ Done | 168 |
| `/board` | sprint-board.tsx | ✅ Done | 248 |
| `/backlog` | backlog-view.tsx | ✅ Done | 308 |
| `/team` | inline page | 🟡 Partial | 93 |
| `/decisions` | decisions-view.tsx | ✅ Done | 409 |
| `/ideas` | ideas-view.tsx + idea-card.tsx | ✅ Done | 619 |
| `/goals` | goals-view.tsx | 🟡 Partial | 657 |
| `/weekly` | weekly-view.tsx | 🟡 Partial | 124 |
| `/gantt` | gantt-view.tsx | 🟡 Partial | 460 |

---

## OVERALL PHASE COMPLETION

| Phase | Target | Status | Est. % |
|-------|--------|--------|--------|
| Phase 1: MVP | my-day, board, backlog, auth | ✅ Functional | 82% |
| Phase 2: Team + Decisions + Ideas | team, decisions, ideas | 🟡 In progress | 68% |
| Phase 3: Reporting + OKR | weekly, goals, grant | 🟡 In progress | 65% |
| Phase 4: Gantt | gantt | 🟡 Scaffold | 65% |

**Estimated overall MVP completion: ~72%**

Critical missing for a usable v1:
- Sprint creation UI (currently zero UI to create a cycle)
- Project creation UI (same issue)
- Team invite/onboarding flow
