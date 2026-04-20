# PHASE 2: RACI Matrix, Team Availability, Move Tasks Between Sprints
**Implementation Guide for Claude Code**

> Last updated: 2026-04-19 11:26 PM GMT+2  
> Status: Data model complete (Phase 1), UI/UX implementation ready

---

## 📋 OVERVIEW

Phase 2 extends Phase 1's foundation (T-Shirt sizing) with three interconnected features:

1. **RACI Matrix** — Clarify task ownership (Responsible, Accountable, Consulted, Informed)
2. **Team Availability** — Track unavailable dates per sprint (vacations, conferences, sick leave)
3. **Move Tasks Between Sprints** — Flexible sprint assignment without data loss

### Current Status
- ✅ Database schema (`lib/supabase/types.ts`) — All types defined
- ✅ Server actions — RACI, availability, move actions implemented
- ✅ Zod validation schemas — Ready to integrate
- ⏳ **TODO:** UI components, modal wiring, real-time subscriptions, mobile responsiveness

---

## 🗄️ SQL MIGRATIONS

### Migration 012: T-Shirt Sizing + RACI (Already Applied)
```sql
-- Existing from Phase 1
ALTER TABLE tasks
ADD COLUMN size VARCHAR(3) DEFAULT NULL,
ADD COLUMN raci JSONB DEFAULT NULL;

CREATE INDEX idx_tasks_size ON tasks(size);
CREATE INDEX idx_tasks_raci ON tasks USING gin(raci);
```

**Already in database.** No action needed.

### Migration 013: Sprint Notes, Links, Unavailability (Already Applied)
```sql
-- Existing from Phase 1
ALTER TABLE cycles
ADD COLUMN notes TEXT DEFAULT NULL,
ADD COLUMN sprint_links JSONB DEFAULT '[]'::jsonb,
ADD COLUMN unavailability JSONB DEFAULT '{}'::jsonb;

CREATE INDEX idx_cycles_sprint_links ON cycles USING gin(sprint_links);
CREATE INDEX idx_cycles_unavailability ON cycles USING gin(unavailability);
```

**Already in database.** No action needed.

### Verification Checklist
```bash
# From `supabase/migrations/`:
# Confirm both 012_*.sql and 013_*.sql are present and applied

supabase db list  # Check local DB state

# Verify columns exist:
supabase sql --command "SELECT column_name FROM information_schema.columns WHERE table_name='tasks' AND column_name IN ('size', 'raci')"

supabase sql --command "SELECT column_name FROM information_schema.columns WHERE table_name='cycles' AND column_name IN ('notes', 'sprint_links', 'unavailability')"
```

---

## ✅ VALIDATION SCHEMAS

### Zod Schemas for Phase 2

**Location:** `app/actions/tasks.ts` and `app/actions/cycles.ts`

#### RACI Matrix Validation
```typescript
// Add to app/actions/tasks.ts (after line 15)

const RaciMatrixSchema = z.object({
  responsible: z.string().uuid().nullable().optional(),
  accountable: z.array(z.string().uuid()).optional().default([]),
  consulted: z.array(z.string().uuid()).optional().default([]),
  informed: z.array(z.string().uuid()).optional().default([]),
}).refine((raci) => {
  // Prevent duplicates across categories
  const all = [
    ...(raci.responsible ? [raci.responsible] : []),
    ...raci.accountable,
    ...raci.consulted,
    ...raci.informed,
  ];
  return new Set(all).size === all.length;
}, {
  message: 'Ta sama osoba nie może być w wielu rolach RACI',
});

export type RaciMatrixInput = z.infer<typeof RaciMatrixSchema>;
```

#### Team Unavailability Validation
```typescript
// Add to app/actions/cycles.ts (after line 32)

const UnavailabilityReasonEnum = z.enum([
  'wakacje',
  'choroba',
  'konferencja',
  'szkolenie',
  'inne'
]);

const UnavailabilityEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Nieprawidłowy format daty (YYYY-MM-DD)'),
  reason: UnavailabilityReasonEnum,
});

const UnavailabilitySchema = z.record(
  z.string().uuid('Nieprawidłowy UUID użytkownika'),
  z.array(UnavailabilityEntrySchema)
);

export type UnavailabilityEntry = z.infer<typeof UnavailabilityEntrySchema>;
```

---

## 🛠️ SERVER ACTIONS (Already Implemented)

### Status Summary

| Action | File | Lines | Status | Notes |
|--------|------|-------|--------|-------|
| `updateTaskRaci()` | `tasks.ts` | 297–315 | ✅ Complete | Validates structure, updates DB |
| `moveTaskToCycle()` | `tasks.ts` | 253–272 | ✅ Complete | Handles cycle reassignment |
| `addUnavailableDate()` | `cycles.ts` | 373–410 | ✅ Complete | Appends to unavailability JSONB |
| `removeUnavailableDate()` | `cycles.ts` | 412–445 | ✅ Complete | Removes entry from JSONB |
| `updateCycleNotes()` | `cycles.ts` | 283–299 | ✅ Complete | For sprint goal/notes |

### Implementation Checklist
```
[x] updateTaskRaci(taskId, raci) — validates RACI structure, updates task.raci
[x] moveTaskToCycle(taskId, cycleId) — updates cycle_id, resets position
[x] addUnavailableDate(cycleId, userId, date, reason) — appends to unavailability[userId]
[x] removeUnavailableDate(cycleId, userId, date) — removes from unavailability[userId]
[x] updateCycleNotes(cycleId, notes) — updates cycle.notes for sprint goal
```

No server-side action work needed — proceed to UI.

---

## 🎨 UI COMPONENTS & WIRING

### 1. RACI Matrix UI

#### Component: `raci-section.tsx` (NEW)
**Location:** `components/compass/raci-section.tsx`

**Purpose:** Reusable RACI editor section for task modal

```typescript
// components/compass/raci-section.tsx
'use client'

import { useState } from 'react'
import { RaciMatrix, DbUser } from '@/lib/supabase/types'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { AlertCircle } from 'lucide-react'

interface RaciSectionProps {
  value: RaciMatrix | null
  users: DbUser[]
  onChange: (value: RaciMatrix | null) => void
  disabled?: boolean
}

export function RaciSection({ value, users, onChange, disabled = false }: RaciSectionProps) {
  const raci = value || { responsible: null, accountable: [], consulted: [], informed: [] };
  
  const handleResponsibleChange = (userId: string | null) => {
    onChange({ ...raci, responsible: userId });
  };
  
  const handleAddAccountable = (userId: string) => {
    if (!raci.accountable.includes(userId)) {
      onChange({ ...raci, accountable: [...raci.accountable, userId] });
    }
  };

  // Similar handlers for consulted, informed...
  
  return (
    <div className="space-y-4 compass-card p-4">
      <h3 className="text-sm font-semibold compass-text">RACI Assignment</h3>
      
      <div className="space-y-3">
        {/* Responsible: single select */}
        <div>
          <label className="text-xs compass-muted">Responsible</label>
          <Select value={raci.responsible || ''} onValueChange={handleResponsibleChange} disabled={disabled}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select person responsible" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {users.map(u => (
                <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Accountable, Consulted, Informed — multi-select chips */}
        {/* ... */}
      </div>
    </div>
  );
}
```

#### Integration Points: `task-detail-modal.tsx`
**Location:** `components/compass/task-detail-modal.tsx` (lines ~799–853)

**Add after Meta Strip section:**
```typescript
// Around line 830 in task-detail-modal.tsx

import { RaciSection } from './raci-section'

// In component JSX, add:
<RaciSection
  value={task?.raci || null}
  users={projectMembers || []}
  onChange={(raci) => {
    // Update local state
    setTask(t => ({ ...t, raci }));
  }}
/>

// In handleSave():
if (task.raci !== original.raci) {
  await updateTaskRaci(taskId, task.raci);
}
```

---

### 2. Team Availability UI

#### Component: `team-availability-section.tsx` (NEW)
**Location:** `components/compass/team-availability-section.tsx`

**Purpose:** Sprint board header section — manage unavailable dates

```typescript
// components/compass/team-availability-section.tsx
'use client'

import { useState } from 'react'
import { DbCycle, DbUser, UnavailabilityEntry } from '@/lib/supabase/types'
import { Button } from '@/components/ui/button'
import { Calendar, X } from 'lucide-react'
import { addUnavailableDate, removeUnavailableDate } from '@/app/actions/cycles'

interface TeamAvailabilitySectionProps {
  cycle: DbCycle
  users: DbUser[]
}

export function TeamAvailabilitySection({ cycle, users }: TeamAvailabilitySectionProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const unavailability = cycle.unavailability || {}

  const handleAddDate = async (userId: string, date: string, reason: string) => {
    await addUnavailableDate(cycle.id, userId, date, reason)
    // Toast feedback
  }

  const handleRemoveDate = async (userId: string, date: string) => {
    await removeUnavailableDate(cycle.id, userId, date)
  }

  return (
    <div className="compass-card p-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full"
      >
        <span className="text-sm font-semibold compass-text">
          Team Availability
        </span>
        <Calendar size={16} className="compass-muted" />
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-3 border-t border-compass-border pt-3">
          {users.map((user) => {
            const dates = unavailability[user.id] || []
            return (
              <div key={user.id} className="text-xs">
                <p className="font-semibold compass-text">{user.full_name}</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {dates.map((entry) => (
                    <Badge key={entry.date} variant="outline" className="text-xs">
                      {entry.date} ({entry.reason})
                      <button
                        onClick={() => handleRemoveDate(user.id, entry.date)}
                        className="ml-1 hover:text-compass-danger"
                      >
                        <X size={12} />
                      </button>
                    </Badge>
                  ))}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    // Open date picker modal
                  }}
                  className="mt-1 text-xs"
                >
                  + Add Unavailable Date
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

#### Integration: `sprint-board.tsx`
**Location:** `components/compass/sprint-board.tsx` (top section, before columns)

```typescript
// Add import:
import { TeamAvailabilitySection } from './team-availability-section'

// In component JSX (after page header, before columns):
<div className="mb-4">
  <TeamAvailabilitySection cycle={activeCycle} users={teamMembers} />
</div>
```

---

### 3. Move Task Between Sprints UI

#### Component: `move-task-modal.tsx` (NEW)
**Location:** `components/compass/move-task-modal.tsx`

**Purpose:** Modal for selecting target cycle

```typescript
// components/compass/move-task-modal.tsx
'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { DbCycle } from '@/lib/supabase/types'
import { moveTaskToCycle } from '@/app/actions/tasks'

interface MoveTaskModalProps {
  open: boolean
  taskId: string
  currentCycleId: string | null
  allCycles: DbCycle[]
  onClose: () => void
}

export function MoveTaskModal({
  open,
  taskId,
  currentCycleId,
  allCycles,
  onClose,
}: MoveTaskModalProps) {
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const availableCycles = allCycles.filter(
    (c) => c.id !== currentCycleId  // Hide current cycle
  )

  const handleMove = async () => {
    if (!selectedCycleId) return

    setLoading(true)
    const result = await moveTaskToCycle(taskId, selectedCycleId)
    setLoading(false)

    if (result.error) {
      // toast.error(result.error)
      return
    }

    // toast.success('Task moved')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move Task to Sprint</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {availableCycles.map((cycle) => (
            <button
              key={cycle.id}
              onClick={() => setSelectedCycleId(cycle.id)}
              className={`w-full p-3 text-left rounded border ${
                selectedCycleId === cycle.id
                  ? 'border-compass-accent bg-compass-surface-2'
                  : 'border-compass-border hover:bg-compass-surface'
              }`}
            >
              <p className="font-semibold text-sm compass-text">{cycle.name}</p>
              <p className="text-xs compass-muted">
                {cycle.start_date} → {cycle.end_date}
              </p>
            </button>
          ))}
        </div>

        <div className="flex gap-2 mt-4">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleMove}
            disabled={!selectedCycleId || loading}
            className="compass-btn-primary"
          >
            {loading ? 'Moving...' : 'Move Task'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

#### Integration: `task-detail-modal.tsx`
**Location:** `components/compass/task-detail-modal.tsx` (action buttons section)

```typescript
// Add import:
import { MoveTaskModal } from './move-task-modal'

// Add state:
const [moveModalOpen, setMoveModalOpen] = useState(false)

// In button section (around line 750):
<Button
  variant="outline"
  size="sm"
  onClick={() => setMoveModalOpen(true)}
>
  Move to Sprint
</Button>

// Add modal component:
<MoveTaskModal
  open={moveModalOpen}
  taskId={taskId}
  currentCycleId={task?.cycle_id || null}
  allCycles={allCycles}
  onClose={() => setMoveModalOpen(false)}
/>
```

---

### 4. RACI Visualization on Sprint Board

#### Update: `task-card.tsx`
**Location:** `components/compass/task-card.tsx`

**Add RACI tooltip on hover:**
```typescript
// After line ~45 (meta badges section)

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

// In component JSX:
{task.raci && (
  <Tooltip>
    <TooltipTrigger asChild>
      <div className="text-xs compass-muted">R/A</div>
    </TooltipTrigger>
    <TooltipContent side="top" className="text-xs">
      <div>
        {task.raci.responsible && <p>Responsible: {assigneeNames[task.raci.responsible]}</p>}
        {task.raci.accountable.length > 0 && (
          <p>Accountable: {task.raci.accountable.map(id => assigneeNames[id]).join(', ')}</p>
        )}
      </div>
    </TooltipContent>
  </Tooltip>
)}
```

#### Update: Task Card Styling for Unavailability
**Location:** `components/compass/task-card.tsx` (avatar section)

```typescript
// When rendering assignee avatar, check if unavailable this sprint:
const isUnavailable = activeCycle?.unavailability?.[task.assignee_id]?.length > 0

return (
  <div className={`compass-card p-3 ${isUnavailable ? 'opacity-60 border-compass-warning' : ''}`}>
    {/* ... */}
  </div>
)
```

---

## 📁 FILE-BY-FILE IMPLEMENTATION CHECKLIST

### NEW FILES (Create)
```
[ ] components/compass/raci-section.tsx
[ ] components/compass/team-availability-section.tsx
[ ] components/compass/move-task-modal.tsx
```

### EXISTING FILES (Edit)
```
[ ] components/compass/task-detail-modal.tsx
    └─ Add RaciSection import + integration
    └─ Wire updateTaskRaci() to handleSave()
    └─ Add MoveTaskModal import + state
    └─ Add "Move to Sprint" button

[ ] components/compass/task-card.tsx
    └─ Add RACI tooltip on hover
    └─ Add unavailability styling (opacity/border)
    
[ ] components/compass/sprint-board.tsx
    └─ Import TeamAvailabilitySection
    └─ Add section to top of board
    
[ ] app/actions/tasks.ts
    └─ Already complete (updateTaskRaci exists)
    └─ Verify moveTaskToCycle signature matches (lines 253–272)
    
[ ] app/actions/cycles.ts
    └─ Already complete (addUnavailableDate, removeUnavailableDate exist)
    
[ ] lib/supabase/types.ts
    └─ Already complete (RaciMatrix, UnavailabilityEntry, SprintLink types exist)
```

---

## 🧪 TESTING CHECKLIST

### Unit Tests
```bash
# Server actions
[ ] updateTaskRaci() — validate RACI structure, prevent duplicates
[ ] moveTaskToCycle() — prevent move to same cycle, handle null cycle_id
[ ] addUnavailableDate() — prevent duplicate dates
[ ] removeUnavailableDate() — handle missing entries gracefully
```

### Integration Tests (Browser)
```
[ ] Task Modal: Open → RACI Section Rendered
    [ ] Select responsible person
    [ ] Add accountable multi-select
    [ ] Save → updateTaskRaci called
    [ ] Page reload → RACI persists

[ ] Sprint Board: Team Availability Section
    [ ] Expand/collapse section
    [ ] Add unavailable date → date picker appears
    [ ] Select date + reason → saved to DB
    [ ] Task card gray out when assignee unavailable

[ ] Task Card: Move Action
    [ ] Click "Move to Sprint" → modal opens
    [ ] Select cycle → button enables
    [ ] Click Move → cycle_id updated
    [ ] Realtime: task moves in other browser tabs

[ ] Mobile (375px)
    [ ] RACI selects don't overflow
    [ ] Availability dates wrap correctly
    [ ] Move modal fits screen
```

### Realtime Updates
```
[ ] Two browsers, same sprint:
    [ ] Add availability in browser A → appears in B
    [ ] Update RACI in A → reflects in B
    [ ] Move task in A → updates position in B

[ ] Verify no console errors during realtime updates
```

### Edge Cases
```
[ ] RACI: Same person in responsible + accountable → prevent (Zod validation)
[ ] Availability: Duplicate date for same user → prevent (server action check)
[ ] Move Task: Target cycle deleted mid-action → graceful error
[ ] Unavailability: User ID doesn't exist → skip silently
```

---

## 📊 METRICS & VALIDATION

### Type Safety
```bash
# Verify no TypeScript errors:
pnpm tsc --noEmit
```

**Expected output:** Zero errors (all Phase 2 types already in types.ts)

### Database Integrity
```bash
# Verify indexes exist:
supabase sql --command "
SELECT indexname FROM pg_indexes
WHERE schemaname='public' AND tablename IN ('tasks', 'cycles')
AND indexname LIKE '%raci%' OR indexname LIKE '%unavailability%'
"
```

### Performance
```bash
# Measure query time for unavailability fetch:
EXPLAIN ANALYZE
SELECT unavailability FROM cycles WHERE id = 'xxx'
  -- Expected: Seq Scan on cycles ~0.1ms (small JSONB)

# Measure RACI query on tasks:
EXPLAIN ANALYZE
SELECT raci FROM tasks WHERE cycle_id = 'xxx'
  -- Expected: Index Scan on idx_tasks_raci ~0.1ms per task
```

---

## 🚀 ROLLOUT PLAN

### Sprint 1: Core Implementation (2 days)
```
Day 1:
  [ ] Create raci-section.tsx component
  [ ] Create team-availability-section.tsx component
  [ ] Create move-task-modal.tsx component
  [ ] Wire to task-detail-modal.tsx
  [ ] Wire to sprint-board.tsx
  
Day 2:
  [ ] Add RACI tooltip to task-card.tsx
  [ ] Add unavailability visual indicators
  [ ] Integration testing across 3 features
  [ ] Realtime validation (2-browser test)
```

### Sprint 2: Polish & Mobile (1 day)
```
[ ] Responsive layout testing (375px, 768px, 1920px)
[ ] Error handling for edge cases
[ ] Toast/notification feedback
[ ] Final type-checking & linting
[ ] Build verification: pnpm build
```

### Rollout
```
[✅ Data Model] lib/supabase/types.ts + migrations
[⏳ Server] app/actions/tasks.ts + cycles.ts
[⏳ UI] components/compass/* (new 3 + updates to 2)
[⏳ Testing] Browser integration + mobile
[⏳ Deploy] Vercel push on feature branch
```

---

## ⚠️ KNOWN CONSTRAINTS

### Browser Support
- **Tested:** Chrome 120+, Safari 17+, Firefox 121+
- **Date picker:** Requires `<input type="date">` support (all modern browsers)

### JSONB Size Limits
- **Unavailability:** Max 365 entries per user per cycle = ~15 KB (safe)
- **RACI:** Max 3 users per role × 12 roles = minimal size (safe)

### Realtime Subscriptions
- Currently active on `tasks` and `cycles` tables
- Ensure filter includes `cycle_id` for task updates to show in correct sprint

---

## 📚 REFERENCE DOCUMENTATION

- **Database Schema:** [CLAUDE.md](../CLAUDE.md) → Database Schema section
- **Type Definitions:** [lib/supabase/types.ts](../lib/supabase/types.ts) → Lines 26–43
- **Server Actions (Tasks):** [app/actions/tasks.ts](../app/actions/tasks.ts) → Lines 297–315
- **Server Actions (Cycles):** [app/actions/cycles.ts](../app/actions/cycles.ts) → Lines 373–445
- **Phase 1 Audit:** [implementation_19_04.md](./implementation_19_04.md)

---

**Implementation ready. Estimated effort: 2 full dev days (16h) for UI + testing.**
