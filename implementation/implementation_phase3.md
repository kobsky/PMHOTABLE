# PHASE 3 — UX POLISH, PERFORMANCE, CAPACITY PLANNING & CLEANUP
**Implementation Plan for Claude Code**

> Last updated: 2026-04-19 23:40 GMT+2  
> Status: Ready for implementation  
> Scope: Final features, UX polish, performance optimization, code cleanup

---

## 📊 PHASE 3 OVERVIEW

Phase 3 completes the Hotable Compass MVP by:
1. **UX Polish** — Fix color contrast (WCAG AA), responsive Gantt, mobile card sizing
2. **Performance** — Lazy load Gantt, query optimization, caching strategy
3. **T-Shirt Size Visibility** — Add backlog column, Gantt visual indicator
4. **Team Settings** — New Team Skills/Roles management UI
5. **Capacity Planning** — Load balancing dashboard with size-based capacity
6. **Cleanup** — Remove Decisions/Weekly routes, fix remaining TypeScript errors

### Current Status Summary
| Feature | Phase | Status | Est. Work |
|---------|-------|--------|-----------|
| T-Shirt Sizing (core) | 1 | ✅ 100% | Done |
| RACI Matrix | 2 | ✅ 100% | Done |
| Team Availability | 2 | ✅ 100% | Done |
| Move Tasks Between Sprints | 2 | ✅ 100% | Done |
| Sprint Notes & Links | 2 | ✅ 100% | Done |
| **UX Contrast Fix** | **3** | **⏳ 80%** | **2h** |
| **Responsive Gantt** | **3** | **⏳ 0%** | **3h** |
| **Lazy Load Gantt** | **3** | **⏳ 0%** | **2h** |
| **Caching Strategy** | **3** | **⏳ 0%** | **3h** |
| **Size Column (Backlog)** | **3** | **⏳ 0%** | **2h** |
| **Size Indicator (Gantt)** | **3** | **⏳ 0%** | **1h** |
| **Team Settings Page** | **3** | **⏳ 0%** | **4h** |
| **Capacity Planning** | **3** | **⏳ 0%** | **5h** |
| **Remove Decisions/Weekly** | **3** | **⏳ 0%** | **1h** |
| **Mock Data Type Errors** | **3** | **⏳ 0%** | **0.5h** |
| **Total Phase 3 Scope** | | | **~23.5h** |

---

## 🎨 SECTION 1: UX POLISH & ACCESSIBILITY

### 1.1 Fix Color Contrast (WCAG AA ≥ 4.5:1)

**Status:** 80% done. Some edge cases remain.

**Target files:**
- `app/globals.css` — token definitions
- `tailwind.config.js` — color scale
- Component files using text-compass-muted

**Current issue:** `text-compass-muted` (#A8A49A) used in form labels, helper text. Needs verification on all backgrounds.

**Tasks:**

```typescript
// 1.1.1 — Audit all text-compass-muted usage
grep -r "text-compass-muted" components/ app/ --include="*.tsx"
grep -r "compass-dim" components/ app/ --include="*.tsx"

// Verify on:
// - Dark bg (compass-bg #0F0F0E)
// - Form labels
// - Helper text
// - Disabled states
// - Placeholder text
```

**Action items:**
- [ ] Verify `text-compass-muted` contrast on all backgrounds (use WebAIM contrast checker)
- [ ] If <4.5:1, switch to `text-gray-400` or `text-compass-text` with opacity
- [ ] Check form labels in task-detail-modal, quick-add-task, new-project-modal
- [ ] Check placeholder text in inputs
- [ ] Verify disabled button text contrast

**Files to check:**
- `components/compass/task-detail-modal.tsx` — Form labels, helpers
- `components/compass/quick-add-task.tsx` — Input labels
- `components/compass/new-project-modal.tsx` — Form labels
- `components/compass/backlog-view.tsx` — Table headers
- `components/ui/` — All shadcn inputs (check disabled states)

**Estimated effort:** 1.5 hours

---

### 1.2 Responsive Gantt Chart

**Status:** 0% done. Desktop-only layout breaks on mobile (<768px).

**Target file:** `components/compass/gantt-view.tsx` (currently 200+ lines)

**Current implementation issues:**
```typescript
// Line 8-14: Fixed constants, no responsiveness
const LEFT_W = 196; // Task list width, fixed
const PX_PER_DAY = 5; // Pixel per day, doesn't scale on mobile
// Layout assumes full desktop width, no horizontal scroll
```

**Design requirements:**
- Desktop (≥768px): Current layout preserved (task list + timeline side-by-side)
- Tablet (600px-767px): Horizontal scroll timeline, task list fixed left, min-width 600px
- Mobile (<600px): Timeline only (no task list), or stack vertically with collapse

**Tasks:**

**1.2.1 — Add responsive breakpoints**
```typescript
const [viewport, setViewport] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');

useEffect(() => {
  const handleResize = () => {
    if (window.innerWidth < 600) setViewport('mobile');
    else if (window.innerWidth < 768) setViewport('tablet');
    else setViewport('desktop');
  };
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);
```

**1.2.2 — Horizontal scroll container for tablet/mobile**
```tsx
// Wrap timeline in scrollable container on tablet/mobile
<div className={cn(
  'relative',
  viewport === 'desktop' ? 'overflow-visible' : 'overflow-x-auto min-w-[600px]'
)}>
  {/* Timeline grid */}
</div>
```

**1.2.3 — Responsive font sizes**
```css
/* Gantt labels: min 12px, scale with viewport */
@media (max-width: 768px) {
  .gantt-label { font-size: 11px; }
}
@media (max-width: 600px) {
  .gantt-label { font-size: 10px; }
  /* Reduce PX_PER_DAY for mobile */
}
```

**1.2.4 — Mobile-friendly day width**
```typescript
// Adjust PX_PER_DAY based on viewport
const PX_PER_DAY = viewport === 'desktop' ? 5 : viewport === 'tablet' ? 3 : 2;
```

**Files affected:**
- `components/compass/gantt-view.tsx` — Main refactor
- `app/(dashboard)/gantt/page.tsx` — May need layout adjustment

**Estimated effort:** 3 hours

---

### 1.3 Sprint Board Card Sizing (Mobile 375px)

**Status:** 95% done. Size badge readable on 375px.

**Verification needed:**
- Test on iPhone 12 mini (375px)
- Verify badge overflow, priority dot visibility
- Check RACI indicators (R/A badges) visibility on small screens

**Tasks:**
- [ ] Test task-card.tsx on 375px device
- [ ] Verify all badges (size, priority, RACI) don't overflow
- [ ] Check assignee avatar visibility
- [ ] Ensure link icon visible if task has sprint_links

**Estimated effort:** 0.5 hours (testing only, code likely OK)

---

## ⚡ SECTION 2: PERFORMANCE OPTIMIZATION

### 2.1 Lazy Load Gantt Chart

**Status:** 0% done.

**Target files:**
- `app/(dashboard)/gantt/page.tsx` — Currently loads GanttView directly
- `components/compass/gantt-view.tsx` — Target for lazy loading

**Current issue:**
```typescript
// Line 10: Synchronous import blocks page render
import { GanttView } from '@/components/compass/gantt-view';
// getAllCycles() and getGoals() block render
const cycles = await getAllCycles();
const goals = await getGoals();
```

**Implementation:**

**2.1.1 — Create lazy wrapper**
```typescript
// app/(dashboard)/gantt/page.tsx
'use client';

import React, { Suspense } from 'react';
import { GanttSkeleton } from '@/components/compass/gantt-skeleton'; // NEW

const GanttViewLazy = React.lazy(() =>
  import('@/components/compass/gantt-view').then(mod => ({ default: mod.GanttView }))
);

export default function GanttPage() {
  return (
    <Suspense fallback={<GanttSkeleton />}>
      <GanttViewLazy />
    </Suspense>
  );
}
```

**2.1.2 — Create Gantt skeleton loader**

NEW FILE: `components/compass/gantt-skeleton.tsx`
```typescript
export function GanttSkeleton() {
  return (
    <div className="p-4 space-y-4">
      <div className="h-8 bg-compass-surface rounded animate-pulse" />
      <div className="h-96 bg-compass-surface-2 rounded animate-pulse" />
    </div>
  );
}
```

**2.1.3 — Move server logic**

Keep `getAllCycles()` and `getGoals()` inside GanttView component (async after lazy load).

**Files affected:**
- `app/(dashboard)/gantt/page.tsx` — Convert to client component with Suspense
- `components/compass/gantt-view.tsx` — Extract async logic
- `components/compass/gantt-skeleton.tsx` — NEW file

**Estimated effort:** 2 hours

---

### 2.2 Query Optimization & Caching

**Status:** 30% done (SELECT all fields issue). No caching layer.

**Target files:**
- `app/actions/tasks.ts` — Main queries
- `app/actions/cycles.ts` — Cycle queries
- `app/(dashboard)/board/page.tsx` — Sprint Board (high-traffic)
- `app/(dashboard)/backlog/page.tsx` — Backlog (high-traffic)

**Strategy:**

**2.2.1 — Implement unstable_cache for high-traffic queries**

```typescript
// app/actions/tasks.ts
import { unstable_cache } from 'next/cache';

// Cache Sprint Board queries (30s revalidation)
export const getTasksForCycleCached = unstable_cache(
  async (cycleId: string) => {
    return getTasksForCycle(cycleId);
  },
  ['tasks-for-cycle'], // Cache key
  { revalidate: 30 } // 30 seconds
);

// Cache all tasks (60s revalidation)
export const getAllTasksWithRelationsCached = unstable_cache(
  async () => {
    return getAllTasksWithRelations();
  },
  ['all-tasks'],
  { revalidate: 60 }
);
```

**2.2.2 — Update page components to use cached versions**

```typescript
// app/(dashboard)/board/page.tsx
// Replace:
// const tasks = await getTasksForCycle(cycleId);
// With:
const tasks = await getTasksForCycleCached(cycleId);
```

**2.2.3 — Revalidate cache on mutations**

```typescript
// app/actions/tasks.ts
export async function updateTask(id: string, patch: UpdateTaskInput) {
  // ... mutation logic ...
  
  revalidatePath('/board');
  revalidatePath('/backlog');
  revalidateTag('tasks-for-cycle');
  revalidateTag('all-tasks');
}
```

**2.2.4 — SELECT field specificity (optional, low priority)**

Current: `SELECT *` in TASK_SELECT. For 3-person team, this is acceptable.  
If performance degrades later, selectively reduce to essential fields:
```typescript
const TASK_SELECT_MINIMAL = `
  id, title, status, priority, type, cycle_id, assignee_id,
  project_id, due_date, size, raci, created_at, updated_at,
  project:projects(id, name, scope_tag),
  assignee:profiles(id, full_name, avatar_url),
  subtasks!parent_task_id(id, title, status)
`;
```

**Files affected:**
- `app/actions/tasks.ts` — Add cached variants
- `app/actions/cycles.ts` — Add cached variants
- `app/(dashboard)/board/page.tsx` — Use cached functions
- `app/(dashboard)/backlog/page.tsx` — Use cached functions

**Estimated effort:** 3 hours (including testing revalidation)

---

### 2.3 Realtime Subscription Cleanup

**Status:** ✅ 100% done (already verified in sprint-board.tsx).

**No action needed.** Subscriptions properly cleaned on unmount.

---

## 📏 SECTION 3: T-SHIRT SIZE VISIBILITY

### 3.1 Add Size Column to Backlog View

**Status:** 0% done.

**Target file:** `components/compass/backlog-view.tsx` (currently ~200 lines)

**Current layout:** Columns: Project, Title, Priority, Assignee, Due Date

**New layout:** Add Size column (sortable, before Priority)

**Implementation:**

**3.1.1 — Add size to table headers**

```typescript
// components/compass/backlog-view.tsx
// Locate: Table header row (around line 80-100)

const columns = [
  { key: 'project', label: 'Project' },
  { key: 'title', label: 'Title' },
  { key: 'size', label: 'Size', sortable: true }, // NEW
  { key: 'priority', label: 'Priority' },
  { key: 'assignee', label: 'Assignee' },
  { key: 'dueDate', label: 'Due Date' },
];
```

**3.1.2 — Render size cell with badge**

```typescript
{task.size && (
  <span className="inline-block px-2 py-1 text-2xs font-mono bg-compass-surface-2 border border-compass-border rounded">
    {task.size}
  </span>
)}
```

**3.1.3 — Add size sorting**

```typescript
const sortedTasks = React.useMemo(() => {
  return [...tasks].sort((a, b) => {
    const sizeOrder = { 'XS': 1, 'S': 2, 'M': 3, 'L': 4, 'XL': 5, 'XXL': 6 };
    return sizeOrder[a.size] - sizeOrder[b.size];
  });
}, [tasks, sortBy]);
```

**Column width:** ~60px (size text + padding)

**Files affected:**
- `components/compass/backlog-view.tsx` — Add column, sorting

**Estimated effort:** 2 hours

---

### 3.2 Add Size Indicator to Gantt Chart

**Status:** 0% done.

**Target file:** `components/compass/gantt-view.tsx` (within task bars)

**Design options:**
1. **Opacity modifier:** XS=full opacity, XXL=lighter (opacity: 0.6)
2. **Height modifier:** XS=short bar, XXL=tall bar
3. **Color modifier:** Subtle color shift (e.g., tint)
4. **Icon badge:** Small badge on bar corner

**Recommended:** Option 1 (opacity) — simplest, non-breaking

**Implementation:**

**3.2.1 — Map size to opacity**

```typescript
const sizeOpacity = {
  'XS': 'opacity-50',
  'S': 'opacity-60',
  'M': 'opacity-100',
  'L': 'opacity-100',
  'XL': 'opacity-100',
  'XXL': 'opacity-100',
};

// Apply to task bar
<div className={cn(
  'bg-compass-accent rounded',
  sizeOpacity[task.size] || 'opacity-100'
)}>
  {task.title}
</div>
```

**3.2.2 — Add tooltip on hover**

```typescript
<div
  title={`${task.title} (${task.size})`}
  className={cn(/* ... */)}
>
  {task.title}
</div>
```

**Files affected:**
- `components/compass/gantt-view.tsx` — Add size styling, tooltip

**Estimated effort:** 1 hour

---

## 👥 SECTION 4: TEAM SETTINGS & SKILLS

### 4.1 New Team Settings Page

**Status:** 0% done.

**Route:** `/settings/team` (new)

**Purpose:** Manage team member roles, skills, capacity baseline

**Features:**
1. Team roster (read-only)
2. Skills per person (tags: Frontend, Backend, Design, PM, Ops, etc.)
3. Base capacity per person (story points per sprint, e.g., 20 pts)
4. Role (Designer, Developer, PM, etc.)

**Database additions:**

NEW MIGRATION: `014_team_skills_capacity.sql`
```sql
-- Add team_skills and base_capacity fields to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS base_capacity INTEGER DEFAULT 20,
ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'Developer',
ADD COLUMN IF NOT EXISTS skills JSONB DEFAULT '[]'::jsonb;

-- skills schema: ["Frontend", "Backend", "Design", "PM"]

CREATE INDEX idx_profiles_role ON profiles(role);
```

**Files structure:**

NEW FILES:
- `app/(dashboard)/settings/page.tsx` — Settings index/redirect
- `app/(dashboard)/settings/team/page.tsx` — Team roster + edit modal
- `components/compass/team-settings-modal.tsx` — Edit dialog (skills, role, capacity)
- `app/actions/team.ts` — Server actions (updateTeamMember)

**Implementation tasks:**

**4.1.1 — Create migration**
```bash
# File: supabase/migrations/014_team_skills_capacity.sql
# Columns: base_capacity (INT), role (VARCHAR), skills (JSONB)
```

**4.1.2 — Update types**
```typescript
// lib/supabase/types.ts (regenerate after migration)
export type DbProfile = {
  // ... existing ...
  base_capacity?: number;
  role?: string;
  skills?: string[];
};
```

**4.1.3 — Create settings layout**

NEW FILE: `app/(dashboard)/settings/layout.tsx`
```typescript
export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4 p-4">
      <nav className="w-40 space-y-2">
        <a href="/settings/team" className="block px-3 py-2 rounded hover:bg-compass-surface">
          Team Settings
        </a>
        {/* Future: /settings/project, /settings/profile */}
      </nav>
      <main className="flex-1">{children}</main>
    </div>
  );
}
```

**4.1.4 — Create team settings page**

NEW FILE: `app/(dashboard)/settings/team/page.tsx`
```typescript
'use client';

import { useEffect, useState } from 'react';
import { DbProfile } from '@/lib/supabase/types';
import { getAuthenticatedUsers } from '@/app/actions/users';
import { TeamSettingsModal } from '@/components/compass/team-settings-modal';

export default function TeamSettingsPage() {
  const [team, setTeam] = useState<DbProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<DbProfile | null>(null);

  useEffect(() => {
    getAuthenticatedUsers().then(setTeam);
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-serif font-bold">Team Settings</h1>
      
      <div className="grid gap-4">
        {team.map(user => (
          <div
            key={user.id}
            className="p-4 border border-compass-border rounded-lg cursor-pointer hover:bg-compass-surface-2"
            onClick={() => setSelectedUser(user)}
          >
            <div className="font-semibold">{user.full_name}</div>
            <div className="text-sm text-compass-muted">{user.role}</div>
            <div className="text-xs text-compass-muted mt-2">
              Capacity: {user.base_capacity || 20} pts/sprint
            </div>
            {user.skills && user.skills.length > 0 && (
              <div className="flex gap-1 mt-2">
                {user.skills.map(skill => (
                  <span key={skill} className="text-xs px-2 py-1 bg-compass-surface rounded">
                    {skill}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedUser && (
        <TeamSettingsModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onSave={(updated) => {
            setTeam(team.map(u => u.id === updated.id ? updated : u));
            setSelectedUser(null);
          }}
        />
      )}
    </div>
  );
}
```

**4.1.5 — Create edit modal**

NEW FILE: `components/compass/team-settings-modal.tsx`
```typescript
'use client';

import { useState } from 'react';
import { DbProfile } from '@/lib/supabase/types';
import { updateTeamMember } from '@/app/actions/team';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

const SKILL_OPTIONS = ['Frontend', 'Backend', 'Design', 'PM', 'DevOps', 'QA', 'Marketing'];
const ROLE_OPTIONS = ['Developer', 'Designer', 'Product Manager', 'Founder', 'Operations'];

export function TeamSettingsModal({
  user,
  onClose,
  onSave,
}: {
  user: DbProfile;
  onClose: () => void;
  onSave: (user: DbProfile) => void;
}) {
  const [role, setRole] = useState(user.role || 'Developer');
  const [baseCapacity, setBaseCapacity] = useState(user.base_capacity || 20);
  const [skills, setSkills] = useState<string[]>(user.skills || []);

  const handleSave = async () => {
    const updated = await updateTeamMember(user.id, {
      role,
      base_capacity: baseCapacity,
      skills,
    });
    onSave(updated);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogTitle>Edit {user.full_name}</DialogTitle>
        
        <div className="space-y-4">
          {/* Role */}
          <div>
            <label className="block text-sm font-semibold mb-2">Role</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              className="w-full px-3 py-2 border border-compass-border rounded"
            >
              {ROLE_OPTIONS.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Base Capacity */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Base Capacity (points/sprint)
            </label>
            <input
              type="number"
              value={baseCapacity}
              onChange={e => setBaseCapacity(parseInt(e.target.value))}
              min={5}
              max={50}
              className="w-full px-3 py-2 border border-compass-border rounded"
            />
          </div>

          {/* Skills */}
          <div>
            <label className="block text-sm font-semibold mb-2">Skills</label>
            <div className="flex flex-wrap gap-2">
              {SKILL_OPTIONS.map(skill => (
                <button
                  key={skill}
                  onClick={() => setSkills(
                    skills.includes(skill)
                      ? skills.filter(s => s !== skill)
                      : [...skills, skill]
                  )}
                  className={cn(
                    'px-3 py-1 rounded text-sm',
                    skills.includes(skill)
                      ? 'bg-compass-accent text-compass-bg'
                      : 'border border-compass-border text-compass-text'
                  )}
                >
                  {skill}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end mt-6">
          <button onClick={onClose} className="px-4 py-2 border border-compass-border rounded">
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-compass-accent text-compass-bg rounded"
          >
            Save
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**4.1.6 — Create server action**

NEW FILE: `app/actions/team.ts`
```typescript
'use server';

import { getAuthenticatedClient } from '@/lib/supabase/server';
import { DbProfile } from '@/lib/supabase/types';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const UpdateTeamMemberSchema = z.object({
  role: z.string().optional(),
  base_capacity: z.number().min(5).max(50).optional(),
  skills: z.array(z.string()).optional(),
});

export async function updateTeamMember(
  userId: string,
  input: z.infer<typeof UpdateTeamMemberSchema>
): Promise<DbProfile> {
  const client = getAuthenticatedClient();
  if (!client) throw new Error('Not authenticated');

  const validated = UpdateTeamMemberSchema.parse(input);

  const { data, error } = await client
    .from('profiles')
    .update(validated)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;

  revalidatePath('/settings/team');
  return data;
}
```

**4.1.7 — Update sidebar navigation**

Edit: `components/compass/sidebar.tsx`
```typescript
// Add to navigation menu:
<a href="/settings/team" className="nav-item">
  ⚙️ Team Settings
</a>
```

**Files affected:**
- `supabase/migrations/014_team_skills_capacity.sql` — NEW
- `lib/supabase/types.ts` — Regenerate (add base_capacity, role, skills)
- `app/(dashboard)/settings/layout.tsx` — NEW
- `app/(dashboard)/settings/team/page.tsx` — NEW
- `components/compass/team-settings-modal.tsx` — NEW
- `app/actions/team.ts` — NEW
- `components/compass/sidebar.tsx` — Add navigation link

**Estimated effort:** 4 hours

---

## 📊 SECTION 5: CAPACITY PLANNING DASHBOARD

### 5.1 Capacity Visualization & Load Balancing

**Status:** 0% done.

**Route:** `/capacity` (new page) or as tab in `/board`

**Purpose:** Show per-person workload, available capacity, and suggestions for load balancing

**Features:**

1. **Capacity Meter (per person)**
   - Base capacity (from settings, e.g., 20 pts)
   - Used capacity (sum of task sizes in current sprint)
   - Available capacity (base - used)
   - Available days (sprint days - unavailable days)
   - Effective capacity = base × (available_days / sprint_days)

2. **Load Status Color**
   - Green: <80% used
   - Yellow: 80-100% used
   - Red: >100% overbooked

3. **Team Total**
   - Total capacity, used, available
   - Utilization %

4. **Unassigned Pool**
   - Tasks in sprint but unassigned
   - Total points waiting for assignment

**Size Points Mapping:**
```typescript
const SIZE_POINTS = {
  'XS': 0.5,
  'S': 1,
  'M': 2,
  'L': 3,
  'XL': 5,
  'XXL': 8,
};
```

**Implementation:**

**5.1.1 — Create capacity calculation helper**

NEW FILE: `lib/capacity.ts`
```typescript
import { DbTask, DbProfile, DbCycle } from '@/lib/supabase/types';

const SIZE_POINTS = {
  'XS': 0.5, 'S': 1, 'M': 2, 'L': 3, 'XL': 5, 'XXL': 8
};

export function calculateUsedCapacity(tasks: DbTask[]): number {
  return tasks.reduce((sum, task) => {
    const points = SIZE_POINTS[task.size] || 2;
    return sum + points;
  }, 0);
}

export function calculateEffectiveCapacity(
  profile: DbProfile,
  cycle: DbCycle
): number {
  if (!profile.base_capacity) return 0;
  
  const cycleDays = Math.ceil(
    (new Date(cycle.end_date) - new Date(cycle.start_date)) / (1000 * 60 * 60 * 24)
  );
  
  const unavailable = cycle.unavailability?.[profile.id] || [];
  const availableDays = cycleDays - unavailable.length;
  
  return profile.base_capacity * (availableDays / cycleDays);
}

export function getLoadStatus(used: number, capacity: number): 'ok' | 'warning' | 'danger' {
  const ratio = used / capacity;
  if (ratio > 1) return 'danger';
  if (ratio >= 0.8) return 'warning';
  return 'ok';
}
```

**5.1.2 — Create capacity page**

NEW FILE: `app/(dashboard)/capacity/page.tsx`
```typescript
'use client';

import { useEffect, useState } from 'react';
import { DbTask, DbProfile, DbCycle } from '@/lib/supabase/types';
import { getActiveCycle } from '@/app/actions/cycles';
import { getTasksForCycle } from '@/app/actions/tasks';
import { getAuthenticatedUsers } from '@/app/actions/users';
import { calculateUsedCapacity, calculateEffectiveCapacity, getLoadStatus } from '@/lib/capacity';
import { cn } from '@/lib/utils';

export default function CapacityPage() {
  const [cycle, setCycle] = useState<DbCycle | null>(null);
  const [team, setTeam] = useState<DbProfile[]>([]);
  const [tasks, setTasks] = useState<DbTask[]>([]);

  useEffect(() => {
    Promise.all([
      getActiveCycle().then(setCycle),
      getAuthenticatedUsers().then(setTeam),
    ]).catch(console.error);
  }, []);

  useEffect(() => {
    if (cycle) {
      getTasksForCycle(cycle.id).then(setTasks);
    }
  }, [cycle]);

  if (!cycle) return <div className="p-4">No active sprint</div>;

  const unassignedTasks = tasks.filter(t => !t.assignee_id);
  const teamCapacities = team.map(profile => {
    const assignedTasks = tasks.filter(t => t.assignee_id === profile.id);
    const used = calculateUsedCapacity(assignedTasks);
    const effective = calculateEffectiveCapacity(profile, cycle);
    const status = getLoadStatus(used, effective);
    
    return { profile, used, effective, status, assignedTasks };
  });

  const totalCapacity = team.reduce((sum, p) => sum + (p.base_capacity || 20), 0);
  const totalUsed = calculateUsedCapacity(tasks.filter(t => t.assignee_id));
  const totalUnassigned = calculateUsedCapacity(unassignedTasks);

  return (
    <div className="p-4 space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold">Capacity Planning</h1>
        <p className="text-compass-muted">{cycle.name}</p>
      </div>

      {/* Team Total */}
      <div className="grid grid-cols-3 gap-4 p-4 border border-compass-border rounded-lg bg-compass-surface">
        <div>
          <div className="text-xs text-compass-muted">Total Capacity</div>
          <div className="text-2xl font-bold">{totalCapacity}</div>
        </div>
        <div>
          <div className="text-xs text-compass-muted">Used</div>
          <div className="text-2xl font-bold">{totalUsed.toFixed(1)}</div>
        </div>
        <div>
          <div className="text-xs text-compass-muted">Unassigned</div>
          <div className="text-2xl font-bold text-compass-warning">{totalUnassigned.toFixed(1)}</div>
        </div>
      </div>

      {/* Per-Person Load */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Team Workload</h2>
        {teamCapacities.map(({ profile, used, effective, status, assignedTasks }) => (
          <div key={profile.id} className="p-4 border border-compass-border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-semibold">{profile.full_name}</div>
                <div className="text-sm text-compass-muted">{profile.role}</div>
              </div>
              <div className={cn(
                'px-3 py-1 rounded text-xs font-semibold',
                status === 'ok' && 'bg-compass-success/20 text-compass-success',
                status === 'warning' && 'bg-compass-warning/20 text-compass-warning',
                status === 'danger' && 'bg-compass-danger/20 text-compass-danger'
              )}>
                {used.toFixed(1)} / {effective.toFixed(1)}
              </div>
            </div>

            {/* Capacity bar */}
            <div className="w-full h-2 bg-compass-surface-2 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full',
                  status === 'ok' && 'bg-compass-success',
                  status === 'warning' && 'bg-compass-warning',
                  status === 'danger' && 'bg-compass-danger'
                )}
                style={{ width: `${Math.min((used / effective) * 100, 100)}%` }}
              />
            </div>

            {/* Tasks assigned */}
            <div className="mt-2 text-xs text-compass-muted">
              {assignedTasks.length} tasks assigned
            </div>
          </div>
        ))}
      </div>

      {/* Unassigned Tasks */}
      {unassignedTasks.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Unassigned Tasks ({totalUnassigned.toFixed(1)} pts)</h2>
          <div className="grid gap-2">
            {unassignedTasks.map(task => (
              <div
                key={task.id}
                className="p-3 border border-compass-border rounded bg-compass-surface-2"
              >
                <div className="font-semibold">{task.title}</div>
                <div className="text-xs text-compass-muted">
                  {task.size || 'M'} • Priority: {task.priority}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

**5.1.3 — Add navigation link**

Edit: `components/compass/sidebar.tsx`
```typescript
<a href="/capacity" className="nav-item">
  📊 Capacity Planning
</a>
```

**Files affected:**
- `lib/capacity.ts` — NEW (calculation utilities)
- `app/(dashboard)/capacity/page.tsx` — NEW (capacity dashboard)
- `components/compass/sidebar.tsx` — Add navigation link

**Estimated effort:** 5 hours

---

## 🗑️ SECTION 6: CLEANUP & REMOVALS

### 6.1 Remove Decisions & Weekly Routes

**Status:** 0% done.

**Routes to delete:**
- `/decisions` — ADR/RFC browser
- `/weekly` — Weekly summary view

**Components to delete:**
- `components/compass/decisions-view.tsx`
- `components/compass/decisions-browser.tsx` (if exists)
- `components/compass/weekly-view.tsx`

**Database cleanup:**
- Documents table has `type` enum with 'adr', 'rfc', 'spec', 'brief', 'weekly_summary'
- **Decision:** Soft-delete documents where type IN ('adr', 'rfc', 'weekly_summary')
  - OR remove documents table entirely if ONLY used for Decisions/Weekly
  - Current inspection needed: check if 'spec' or 'brief' types are used

**Tasks:**

**6.1.1 — Audit documents table usage**
```sql
SELECT type, COUNT(*) FROM documents GROUP BY type;
-- If ONLY 'adr', 'rfc', 'weekly_summary' exist, safe to drop table
-- Otherwise, soft-delete records
```

**6.1.2 — Delete routes and components**
```bash
# Delete routes
rm app/(dashboard)/decisions/page.tsx
rm app/(dashboard)/weekly/page.tsx

# Delete components
rm components/compass/decisions-view.tsx
rm components/compass/weekly-view.tsx

# Search for imports and remove
grep -r "decisions-view\|weekly-view" components/ app/ --include="*.tsx"
```

**6.1.3 — Update sidebar**

Edit: `components/compass/sidebar.tsx`
```typescript
// Remove from navigation:
// <a href="/decisions" className="nav-item">ADRs & RFCs</a>
// <a href="/weekly" className="nav-item">Weekly</a>
```

**6.1.4 — Optional: Drop documents table migration**

NEW FILE: `supabase/migrations/015_remove_documents_table.sql` (if safe)
```sql
-- Only run if documents table ONLY contained decisions/weekly
DROP TABLE IF EXISTS documents CASCADE;
```

**Verification:** Check if any UI references documents (spec, brief).

**Files affected:**
- `app/(dashboard)/decisions/page.tsx` — DELETE
- `app/(dashboard)/weekly/page.tsx` — DELETE
- `components/compass/decisions-view.tsx` — DELETE
- `components/compass/weekly-view.tsx` — DELETE
- `components/compass/sidebar.tsx` — Update navigation
- `supabase/migrations/015_remove_documents_table.sql` — NEW (optional)

**Estimated effort:** 1 hour

---

### 6.2 Fix TypeScript Errors in Mock Data

**Status:** 7 TS errors in `lib/mock-data.ts`

**Issue:** DbCycle mock objects missing Phase 2 fields (notes, sprint_links, unavailability)

**Current errors:**
- Lines: 52, 65, 76, 87, 98, 109, 120

**Fix:**

Edit: `lib/mock-data.ts`

```typescript
// Every DbCycle object needs:
const MOCK_CYCLE = {
  id: 'cycle-1',
  name: 'Sprint 1',
  start_date: '2026-04-19',
  end_date: '2026-05-03',
  goal: 'Launch capacity planning',
  is_active: true,
  velocity_planned: 20,
  velocity_actual: null,
  notes: null, // NEW
  sprint_links: [], // NEW
  unavailability: {}, // NEW
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
```

**Estimated effort:** 0.5 hours

---

## 🎯 IMPLEMENTATION ROADMAP

### Timeline (estimated)

| Week | Focus | Key Files | Est. Time |
|------|-------|-----------|-----------|
| Week 1 | UX + Performance Foundations | globals.css, gantt-view.tsx, cache setup | 8h |
| Week 2 | Size Visibility + Capacity Prep | backlog-view.tsx, gantt-view.tsx, lib/capacity.ts | 6h |
| Week 3 | Team Settings + Capacity Dashboard | Team settings page, capacity page, sidebar | 9h |
| **Total** | | | **~23.5h** |

### Suggested Implementation Order (high-impact first)

1. **Fix TypeScript errors** (0.5h) — Unblocks tsc --noEmit
2. **Lazy Load Gantt** (2h) — Major performance win
3. **Add Size Column (Backlog)** (2h) — High visibility, low complexity
4. **Fix Color Contrast** (1.5h) — UX polish
5. **Responsive Gantt** (3h) — Mobile support
6. **Caching Strategy** (3h) — Performance optimization
7. **Size Indicator (Gantt)** (1h) — Visual enhancement
8. **Team Settings** (4h) — Feature addition
9. **Capacity Planning** (5h) — Complex dashboard
10. **Remove Decisions/Weekly** (1h) — Cleanup
11. **Sprint Board Mobile Testing** (0.5h) — Verification

---

## 📋 CHECKLIST

### Pre-Implementation
- [ ] Review CLAUDE.md for any changes
- [ ] Verify Phase 2 is fully merged/deployed
- [ ] Backup current database state
- [ ] Create feature branch for Phase 3

### Phase 3 Implementation
- [ ] Fix TypeScript errors
- [ ] Lazy load Gantt
- [ ] Add size column to backlog
- [ ] Fix color contrast
- [ ] Responsive Gantt (mobile)
- [ ] Query caching
- [ ] Size indicator in Gantt
- [ ] Team Settings page
- [ ] Capacity Planning dashboard
- [ ] Remove Decisions/Weekly
- [ ] Final pnpm tsc --noEmit check
- [ ] Test on mobile (375px, 1920px)
- [ ] Update README/docs

### Post-Implementation
- [ ] Code review
- [ ] Integration testing
- [ ] Load testing (cache effectiveness)
- [ ] Mobile responsiveness verification
- [ ] Create pull request
- [ ] Deploy to production

---

## 📞 NOTES FOR CLAUDE

**If implementing:** Each section is self-contained. Start with Section 1 (UX), then Section 2 (Performance), then Section 3-5.

**Testing priorities:**
1. Responsive Gantt: iPad (768px), iPhone (375px)
2. Caching: Verify revalidation on mutations (create/update/delete task)
3. Capacity calc: Verify math with manual examples
4. Team Settings: All CRUD operations on profiles

**Potential blockers:**
- Color contrast audit may reveal more work than estimated
- Caching revalidation requires careful testing (easy to introduce stale data bugs)
- Gantt responsive design — ensure timeline readability at small sizes

**Post-launch:**
- Monitor Lighthouse performance metrics
- Track cache hit rate (check Next.js logs)
- Gather team feedback on Team Settings UX
- Plan Phase 4: Advanced Gantt, Sprints, Capacity Planning refinements

---

**End of Phase 3 Implementation Plan**
