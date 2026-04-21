# Implementation Phase 21.04.A

## 1. Goal: Merge Team and Capacity into a Unified View
The goal is to combine the "Team" (activity/workload) and "Capacity" (planning/points) views into a single, cohesive dashboard to reduce navigation and provide a complete picture of team health.

### UI Changes
- **New Route**: `app/(dashboard)/team/page.tsx` will become the primary hub.
- **Integration**: 
    - Move the logic from `app/(dashboard)/capacity/page.tsx` into a new component `components/compass/team-capacity-view.tsx`.
    - The main Team page will now feature:
        1. **Workload Suggestions Panel** (Existing).
        2. **Unified Team Table/List**: Each member row will combine:
            - Basic info (Name, Role, Status).
            - Current Workload (Tasks in progress/todo - from existing Team page).
            - Capacity Status (Used vs Effective points - from Capacity page).
            - Progress bar (Done vs Total tasks).
        3. **Unassigned Tasks Section**: Moved from Capacity page to the bottom of the Team page.
- **Navigation**: Remove `/capacity` from the sidebar/navigation and redirect to `/team`.

### Server Actions & Logic
- No new SQL required for this merge.
- Update `app/actions/team.ts` if needed to provide a more aggregated data object for the unified view.

---

## 2. Goal: Synchronize Member Skills
Ensure that skills updated in `TeamSettingsModal` are immediately and consistently reflected in the `TeamMembersPage` and the new unified Team view.

### Analysis
- `TeamSettingsModal` uses `updateMember` action.
- `TeamMembersPage` and `TeamPage` use `getTeamMembers` / `getProfiles`.
- The current implementation already saves `skills` to the `profiles` table.

### Implementation
- **UI Update**: In `app/(dashboard)/team/members/page.tsx`, ensure the skills list is rendered clearly (already partially implemented, but will be polished).
- **Consistency**: Ensure `revalidatePath` in `updateMember` covers all relevant views:
    - `/team`
    - `/team/members`
    - `/capacity` (though this will be merged).

---

## 3. Goal: Remove Placeholder Question Marks in RACI & Sprint Board
Fix the issue where deleted placeholder accounts leave behind `?` or broken references in the RACI matrix and Sprint Board.

### Root Cause
When a placeholder profile is deleted, the `raci` JSONB field in the `tasks` table still contains the `id` of the deleted user. The UI tries to find the user in the `profiles` list, fails, and defaults to `?`.

### SQL Fix (Backward Compatible)
We need a script to scrub the `raci` column of any IDs that no longer exist in the `profiles` table.

```sql
-- Cleanup RACI matrix for deleted profiles
UPDATE tasks
SET raci = jsonb_set(
    raci, 
    '{responsible}', 
    (SELECT NULL WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE id = (raci->>'responsible')))
)
WHERE raci IS NOT NULL AND (raci->>'responsible') IS NOT NULL;

-- For arrays (accountable, consulted, informed), we need to filter out non-existent IDs
UPDATE tasks
SET raci = jsonb_set(
    jsonb_set(
        jsonb_set(
            raci, 
            '{accountable}', 
            (SELECT jsonb_agg(elem) FROM jsonb_array_elements(raci->'accountable') AS elem WHERE EXISTS (SELECT 1 FROM profiles WHERE id = elem#>>'{}'))
        ),
        '{consulted}', 
        (SELECT jsonb_agg(elem) FROM jsonb_array_elements(raci->'consulted') AS elem WHERE EXISTS (SELECT 1 FROM profiles WHERE id = elem#>>'{}'))
    ),
    '{informed}', 
    (SELECT jsonb_agg(elem) FROM jsonb_array_elements(raci->'informed') AS elem WHERE EXISTS (SELECT 1 FROM profiles WHERE id = elem#>>'{}'))
)
WHERE raci IS NOT NULL;
```

### UI Guard
Update `components/compass/task-card.tsx` and `components/compass/task-detail-modal.tsx` to gracefully handle missing profiles without showing `?`.

- **Change**: Instead of `user.full_name ?? '?'`, use a check: if the profile is not found in the provided `profiles` list, do not render the badge or render it as "Unknown/Deleted".

---

## Summary of Changes

### Database (SQL)
- Run the RACI cleanup script to remove orphaned IDs.

### Zod Schemas
- No changes required to `UpdateMemberSchema` or `CreatePlaceholderSchema`.

### Server Actions
- `app/actions/team.ts`: Ensure `updateMember` revalidates all team-related paths.

### UI Components
- `app/(dashboard)/team/page.tsx`: Refactor to include Capacity logic.
- `app/(dashboard)/capacity/page.tsx`: Deprecate/Remove.
- `components/compass/team-capacity-view.tsx`: New component for the merged view.
- `components/compass/task-card.tsx`: Fix `?` rendering for RACI.
- `components/compass/task-detail-modal.tsx`: Fix `?` rendering for RACI.
- `app/(dashboard)/team/members/page.tsx`: Polish skills display.
