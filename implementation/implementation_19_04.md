# PHASE 1 AUDIT — UX, Performance, T-Shirt Sizing
**Date:** 2026-04-19, 23:10 GMT+2  
**Focus:** UX Contrast, Performance Optimization, T-Shirt Sizing Implementation

---

## STATUS TABELA — PHASE 1 ELEMENTS

| ELEMENT | STATUS % | NOTES | FILES |
|---------|----------|-------|-------|
| **UX — Color Contrast (WCAG AA ≥4.5:1)** | 80% | compass-muted (#A8A49A) and compass-dim (#7A766E) brightened Apr 19. Text readable on dark bg. Some edge cases in form labels remain untested. | `tailwind.config.ts:22-23`, `app/globals.css` |
| **UX — Responsive Gantt** | 0% | Gantt uses fixed LEFT_W=196px, PX_PER_DAY=5 constants. No horizontal scroll on mobile (<768px). Component assumes desktop-only layout. | `components/compass/gantt-view.tsx:8-14` |
| **UX — Responsive Sprint Board Cards** | 95% | Cards render correctly on 375px viewport. Size badge shown only when size ≠ 'M' (line 107). Project name displayed correctly (line 93-101). | `components/compass/task-card.tsx:107-111`, `93-101` |
| **UX — Responsive Backlog View** | 90% | Table layout, font sizes minimum 12px. Some column widths may compress <375px but readable. | `components/compass/backlog-view.tsx` |
| **Performance — Query Optimization (SELECT specific fields)** | 30% | TASK_SELECT uses `*` (all fields). Soft delete filter (WHERE deleted_at IS NULL) applied everywhere ✓. No SELECT * issue in individual queries, but wildcard join on subquery. Not blocking for 3-person team. | `app/actions/tasks.ts:35-40`, `62, 84, 104` |
| **Performance — Lazy Load Gantt** | 0% | Gantt page loads synchronously. No React.lazy + Suspense wrapper. getAllCycles() and getGoals() block page render. | `app/(dashboard)/gantt/page.tsx:10` |
| **Performance — Caching (unstable_cache)** | 0% | No caching layer. Every request hits Supabase directly. Should cache Sprint Board (30s) and Backlog (60s). | No files affected yet |
| **Performance — Realtime Cleanup** | 100% | Subscriptions properly cleaned on unmount (verified in sprint-board.tsx realtime listeners). | `components/compass/sprint-board.tsx` |
| **T-Shirt Sizing — Migration** | 100% | Migration 012 applied. ALTER TABLE tasks ADD COLUMN size VARCHAR(4) DEFAULT 'M' with CHECK constraint. Backfill to 'M' executed. | `supabase/migrations/012_task_size_raci.sql:1-6` |
| **T-Shirt Sizing — Type Definition** | 100% | TaskSize = 'XS' \| 'S' \| 'M' \| 'L' \| 'XL' \| 'XXL' defined. DbTask.size? field present in types. | `lib/supabase/types.ts:23`, `95` |
| **T-Shirt Sizing — Server Actions** | 100% | updateTaskSize() and updateTaskRaci() functions exist in tasks.ts. updateTask() patch includes size and raci fields. | `app/actions/tasks.ts:274-296`, `239-242` |
| **T-Shirt Sizing — Task Card Display** | 100% | Size badge rendered when size ≠ 'M'. Shown top-right with font-mono text-2xs styling. | `components/compass/task-card.tsx:107-111` |
| **T-Shirt Sizing — Task Modal UI** | 100% | SelectPill component for size selector (XS-XXL options) wired into meta strip. State initialized, handleSave includes size. | `components/compass/task-detail-modal.tsx:539-552`, `129`, `239` |
| **T-Shirt Sizing — Backlog Column** | 0% | No size column in backlog table view. Should show size (sortable) like priority. | `components/compass/backlog-view.tsx` |
| **T-Shirt Sizing — Gantt Indicator** | 0% | No visual indicator for task size in Gantt timeline (could use opacity, height, or color modifier). | `components/compass/gantt-view.tsx` |
| **scope_1.0 Hardcode Issue** | 100% RESOLVED | Verified: scope_1.0 appears only in new-project-modal.tsx as form default (line 42, 51). This is CORRECT — not a bug. Tasks correctly display project.name (line 93-101 task-card.tsx) and filter by project_id. No hardcoding in display logic. | `components/compass/new-project-modal.tsx:42,51` |
| **TypeScript Strict Mode** | 85% | pnpm tsc --noEmit reports 7 errors in lib/mock-data.ts. DbCycle objects missing Phase 2 fields (notes, sprint_links, unavailability). Mock data out of sync with schema after migration 013. | `lib/mock-data.ts:52, 65, 76, 87, 98, 109, 120` |
| **No Console Errors** | 95% | Build and dev mode clean except mock-data.ts type errors. Next.js TS strict: true enabled. | — |
| **Tested 375px + 1920px** | 60% | Sprint Board, task card, basic components tested on 375px (readable). Gantt not responsive. Full width (1920px) layout OK. Mobile sidebar breaks <768px. | `components/compass/` |

---

## LOKALIZACJA BŁĘDU scope_1.0

### VERDICT: ✅ NO BUG — Correct Implementation

**Where it appears:** `components/compass/new-project-modal.tsx` (FORM DEFAULTS ONLY)

```typescript
// Line 42: Default form state uses scope_1.0
setForm({ name: '', scope_tag: 'scope_1.0', description: '', color: '#4BAF87' })

// Line 51: Reset to same default when modal closes
setForm({ name: '', scope_tag: 'scope_1.0', description: '', color: '#4BAF87' })
```

**Root cause analysis:**
- ✅ **This is intentional.** New projects default to `scope_1.0` scope_tag.
- ✅ **Tasks correctly use project_id**, not hardcoded scope_tag.
- ✅ **Task display shows project.name**, not scope_tag.
- ✅ **Project selector dropdown works** (tasks.ts:181-198, project:projects(*) join).

**Confirmed working:**
- `task-card.tsx:93-101` displays project.name from relation
- `backlog-view.tsx` shows project name in column
- `task-detail-modal.tsx:489-496` project selector works with projectId

**No action needed** — this is correct behavior.

---

## LISTA BRAKUJĄCYCH ELEMENTÓW — PHASE 1 BLOCKERS & QUICK WINS

### 🔴 BLOCKERS (Must fix for Phase 1 completion)

1. **Gantt NOT Responsive** — Currently desktop-only, breaks <768px
   - **What to add:** Horizontal scroll container on mobile, min-width: 600px timeline
   - **File:** `components/compass/gantt-view.tsx`
   - **Impact:** Users on iPad/tablet see broken layout
   - **Est. effort:** 2 hours

2. **Mock Data Type Errors** — 7 TS errors blocking clean tsc --noEmit
   - **What to add:** Update DbCycle mock objects with notes, sprint_links, unavailability fields
   - **File:** `lib/mock-data.ts:52, 65, 76, 87, 98, 109, 120`
   - **Est. effort:** 30 minutes
   - **Note:** These are Phase 2 fields (migration 013), but needed for clean build

### 🟡 QUICK WINS (High ROI, <2h each)

3. **Size Column in Backlog** — Show T-Shirt size in backlog table
   - **What to add:** Add `size` column to backlog-view.tsx table, sortable
   - **Est. effort:** 1.5 hours

4. **Size Indicator in Gantt** — Visual size modifier (opacity, height, or badge)
   - **What to add:** Map TaskSize to visual style in gantt-view.tsx
   - **Est. effort:** 1 hour

5. **Lazy Load Gantt** — Wrap in React.lazy + Suspense
   - **What to add:** `React.lazy(() => import(...GanttView...))`, add loading.tsx skeleton
   - **Est. effort:** 1 hour

### 🟢 FUTURE OPTIMIZATIONS (Performance, post-Phase 1)

6. **Query Caching** — Add unstable_cache wrapper
   - **Current:** No caching. Every board load hits Supabase.
   - **What to add:** Cache getTasksForCycle (30s), getAllTasksWithRelations (60s)
   - **Est. effort:** 1 day (requires testing revalidation behavior)

7. **SELECT Field Specificity** — Replace TASK_SELECT `*` with explicit fields
   - **Current:** `SELECT *, project:projects(*), assignee:profiles(*), subtasks...`
   - **What to add:** List explicit columns instead of `*`
   - **Impact:** Minimal for 3-person team, good practice
   - **Est. effort:** 1 hour

---

## GOTOWE MIGRACJE SQL

### ✅ Already Applied (No action needed)

**Migration 012: T-Shirt Sizing + RACI Matrix**
```sql
-- ✅ APPLIED
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS size VARCHAR(4) DEFAULT 'M'
    CONSTRAINT tasks_size_check CHECK (size IN ('XS','S','M','L','XL','XXL'));

UPDATE tasks SET size = 'M' WHERE size IS NULL;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS raci JSONB DEFAULT NULL;
```

**Migration 013: Sprint Notes + Links + Unavailability**
```sql
-- ✅ APPLIED (causes mock-data.ts type errors)
ALTER TABLE cycles
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS sprint_links JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS unavailability TEXT;
```

### 📝 Additional Indexes to Consider

**For Gantt performance** (optional Phase 1):
```sql
CREATE INDEX idx_tasks_cycle_id_status ON tasks(cycle_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_due_date ON tasks(due_date) WHERE deleted_at IS NULL AND due_date IS NOT NULL;
```

**For Backlog filters:**
```sql
CREATE INDEX idx_tasks_project_id ON tasks(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_assignee_id ON tasks(assignee_id) WHERE deleted_at IS NULL;
```

These already exist (per migration 003), no action needed.

---

## SUMMARY

| Category | Complete? | Notes |
|----------|-----------|-------|
| **UX Contrast** | 80% | Colors brightened, edge cases untested |
| **Responsive Design** | 70% | Gantt broken on mobile, rest OK |
| **Performance** | 20% | No caching, no lazy load yet |
| **T-Shirt Sizing** | 95% | Full implementation except backlog/gantt display |
| **scope_1.0 Issue** | ✅ RESOLVED | Not a bug — form defaults only |
| **TypeScript Clean** | 85% | Mock data needs 7 field additions |
| **Mobile Testing** | 60% | 375px OK, <768px has issues |

**Phase 1 Ready for user testing?** — ~75% (Gantt responsiveness + mock-data.ts type errors block "shipping")

**Critical path to Phase 1 complete:**
1. Fix mock-data.ts (30min) → clean tsc --noEmit
2. Make Gantt responsive (2h) → works on all viewports
3. Add size column to backlog (1.5h) → T-shirt sizing visible everywhere
4. Add size indicator to Gantt (1h) → visual consistency

**Total critical path: ~4.5 hours**

---

**Generated:** 2026-04-19 23:10 GMT+2 by Phase 1 Audit
