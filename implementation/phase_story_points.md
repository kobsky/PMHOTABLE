# Implementation Plan: Story Points System

## Goal
Transition from T-shirt sizing (XS-XXL) to a unified Story Points system across the application.

## 1. Data Modeling & Migration

### SQL Migration
Create a new migration file (e.g., `supabase/migrations/016_story_points.sql`):

```sql
-- 1. Add story_points column
ALTER TABLE tasks 
ADD COLUMN story_points INTEGER;

-- 2. Add constraint for allowed values
ALTER TABLE tasks 
ADD CONSTRAINT tasks_story_points_check 
CHECK (story_points IN (1, 2, 3, 5, 8, 13));

-- 3. Migrate data from size to story_points
UPDATE tasks 
SET story_points = CASE 
    WHEN size = 'XS' THEN 1
    WHEN size = 'S' THEN 2
    WHEN size = 'M' THEN 3
    WHEN size = 'L' THEN 5
    WHEN size = 'XL' THEN 8
    WHEN size = 'XXL' THEN 13
    ELSE 3 -- Default to M (3) if null or unknown
END;

-- 4. Ensure no nulls for existing tasks
UPDATE tasks SET story_points = 3 WHERE story_points IS NULL;
```

### Type Updates
Update `lib/supabase/types.ts`:
- Add `story_points?: number | null` to `DbTask` interface.
- Keep `size` for audit purposes but mark as deprecated in comments.

## 2. Server Actions & Validation

### Zod Schemas
Define a shared validation for story points:
`const StoryPointsSchema = z.number().int().refine(val => [1, 2, 3, 5, 8, 13].includes(val), { message: "Invalid story points value" });`

### New/Updated Actions

#### `app/actions/tasks.ts`
- **`updateTaskStoryPoints(taskId: string, points: number)`**:
    - Validate `points` using `StoryPointsSchema`.
    - Reject `13` (XXL) for new assignments to sprints.
    - Update `tasks` table.
- **`assignTaskToSprint(taskId: string, cycleId: string, assigneeId: string)`**:
    - Calculate current sum of `story_points` for `assigneeId` in `cycleId`.
    - If `sum + newTaskPoints > 12`, return a warning but allow override.
    - Update `tasks` table.

#### `app/actions/cycles.ts`
- **`createCycleWithCapacity(input: CreateCycleInput)`**:
    - Update `CycleSchema` to validate `velocity_planned` is between 20 and 50.
    - Label in UI: "PLANOWANA POJEMNOŚĆ (STORY POINTS)".

## 3. UI/UX Implementation

### Task Detail Modal (`components/compass/task-detail-modal.tsx`)
- **Remove**: T-shirt size dropdown.
- **Add**: A button group for story points: `[1, 2, 3, 5, 8]`.
- **Logic**: 
    - When a point value is selected, call `updateTaskStoryPoints`.
    - If `assignee_id` is set, check capacity and show warning if `> 12`.
    - Prevent selection of `13` (XXL) in the UI.

### Sprint Creation (`components/compass/new-sprint-modal.tsx`)
- Update label to "PLANOWANA POJEMNOŚĆ (STORY POINTS)".
- Add client-side validation for range 20–50.

### Sprint Summary & Capacity (`components/compass/team-capacity-view.tsx` & new `components/sprint-capacity-bar.tsx`)
- **New Component `SprintCapacityBar`**:
    - Visual bar: `████░░░░░░ X pkt / 12 pkt`.
    - Colors: Green (<=12), Yellow (12-15), Red (>15).
- **Update `TeamCapacityView`**:
    - Replace `calculateUsedCapacity` logic to use `story_points` instead of `SIZE_POINTS` mapping.
    - Show per-person breakdown.
    - Show team total: `X pkt / 36 pkt` (assuming 3 people * 12).
    - Implement realtime updates via Supabase subscription on `tasks` table.

## 4. Queries (`lib/supabase/queries.ts` - to be created/updated)
- **`getTaskStoryPointsSumByPerson(personId, cycleId)`**:
    - `SELECT sum(story_points) FROM tasks WHERE assignee_id = personId AND cycle_id = cycleId AND deleted_at IS NULL`
- **`getSprintCapacityBreakdown(cycleId)`**:
    - Join `profiles` and `tasks` to get `sum(story_points)` per person for the given `cycleId`.

## 5. Definition of Done Checklist
- [ ] Migration executed and verified.
- [ ] `story_points` column exists and has check constraint.
- [ ] T-shirt size removed from all UI components.
- [ ] Sprint creation validates 20-50 range.
- [ ] Task modal uses 1, 2, 3, 5, 8 buttons and rejects 13.
- [ ] Capacity warnings (Yellow > 12, Red > 15) appear on assignment.
- [ ] Realtime capacity bars update when story points change.
- [ ] RLS and `deleted_at IS NULL` filters applied to all new queries.
- [ ] Mobile responsive layout for capacity bars.
