# Implementation Plan: Data and Display Inconsistencies Fix

## Overview
This plan addresses three specific data/display inconsistencies related to sprint data filtering and workload calculations. The goal is to ensure that the "Active Cycle" is the primary source of truth for the Workload, My Tasks, and Backlog views.

## Technical Strategy

### 1. Team Workload Calculation
**Current Issue:** Points shown don't match actual task data.
**Analysis:** 
- `components/compass/team-capacity-view.tsx` filters `allTasks` by `activeCycle.id`.
- `lib/capacity.ts` -> `calculateUsedCapacity` uses a fallback of `3` points if `story_points` is null: `tasks.reduce((sum, task) => sum + (task.story_points ?? 3), 0)`.
- The mismatch (e.g., Kornel 12 vs 15) is likely due to this fallback or missing `deleted_at IS NULL` filters in the data fetching layer.

**Fix:**
- Ensure the data fetching for `allTasks` in the parent component of `TeamCapacityView` (likely `app/(dashboard)/team/page.tsx` or similar) includes `.is('deleted_at', null)`.
- Update `calculateUsedCapacity` to handle `story_points` strictly or ensure the fallback aligns with business requirements. (The task says "sum of story_points", implying we should be careful with fallbacks).

### 2. My Tasks View (`/my-day`)
**Current Issue:** Shows all tasks; header is generic "Na dziś".
**Fix:**
- **Data Fetching:** Modify `app/actions/tasks.ts` -> `getMyTasks`.
    - Currently, it fetches all tasks for the user.
    - Change: It must now accept an `activeCycleId` or internally fetch the active cycle and filter tasks by `cycle_id = activeCycleId AND deleted_at IS NULL`.
- **UI Changes in `app/(dashboard)/my-day/page.tsx`**:
    - Fetch the `activeCycle` object.
    - Replace the "Na dziś" section header with: `Zadania Sprint {activeCycle.name} · do {formatDate(activeCycle.end_date)}`.
    - Remove the "today" grouping logic. Display tasks flat or grouped only by status (Active, Todo, Done).

### 3. Backlog Default Filter
**Current Issue:** Defaults to "Wszystkie" (All) on mount.
**Fix:**
- **Component Logic in `components/compass/backlog-view.tsx`**:
    - The `filterCycle` state is initialized to `'all'`.
    - Change: Initialize `filterCycle` using the `activeCycle` ID passed from the server component `app/(dashboard)/backlog/page.tsx`.
    - If no active cycle is found, fallback to `'all'`.

## Step-by-Step Implementation

### Phase 1: Data Layer (`app/actions/tasks.ts` & `app/actions/cycles.ts`)
- [ ] Update `getMyTasks` to filter by the active cycle.
- [ ] Ensure all `supabase.from('tasks')` queries in `tasks.ts` include `.is('deleted_at', null)` unless explicitly fetching deleted tasks.

### Phase 2: My Tasks Page (`app/(dashboard)/my-day/page.tsx`)
- [ ] Update the page to fetch `activeCycle` via `getActiveCycle()`.
- [ ] Pass `activeCycle.id` to `getMyTasks()`.
- [ ] Update the JSX to change the "Na dziś" label to the dynamic sprint label.
- [ ] Remove the "today" date-based filtering logic.

### Phase 3: Team Workload (`components/compass/team-capacity-view.tsx`)
- [ ] Verify the `allTasks` prop contains only non-deleted tasks.
- [ ] Review `lib/capacity.ts` to ensure `calculateUsedCapacity` correctly sums `story_points`.

### Phase 4: Backlog View (`components/compass/backlog-view.tsx`)
- [ ] Update `BacklogView` props to accept `initialCycleId`.
- [ ] Initialize `useState<FilterCycle>(initialCycleId ?? 'all')`.

## Validation Criteria
- [ ] **Workload:** Sum of `story_points` for active sprint tasks matches the displayed value per user.
- [ ] **My Tasks:** Only tasks from the active cycle are visible. Header shows "Zadania Sprint X · do DD.MM.YYYY".
- [ ] **Backlog:** Page loads with the active sprint selected in the dropdown.
- [ ] **Global:** No deleted tasks (`deleted_at IS NOT NULL`) appear in any of these views.
