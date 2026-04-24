# Implementation Plan: Velocity Tolerance Bands


## Goal
Replace the binary "over/under" velocity warning with a three-zone tolerance system (Green, Yellow, Red) configurable per cycle.


## 1. Data Modeling & Backend


### Database Migration
Create a new migration file `supabase/migrations/[timestamp]_add_cycle_tolerance.sql`:
```sql
ALTER TABLE cycles
ADD COLUMN tolerance_percent INTEGER NOT NULL DEFAULT 20;


ALTER TABLE cycles
ADD CONSTRAINT tolerance_percent_range
CHECK (tolerance_percent BETWEEN 0 AND 100);
```


### Type Regeneration
Run: `supabase gen types typescript --local > lib/supabase/types.ts`


### Server Action Update
Modify `app/actions/cycles.ts`:
- Update `CycleBaseSchema` to include `tolerance_percent: z.coerce.number().int().min(0).max(100).optional().nullable()`.
- The `updateCycle` action already uses `CycleUpdateSchema` (which is `CycleBaseSchema.partial()`), so it will automatically support the new field.
- Ensure `revalidatePath('/board')` and `revalidatePath('/backlog')` are called (already present).


## 2. Core Logic (Shared Utility)


Create `lib/velocity/tolerance.ts`:
```typescript
export type VelocityZone = 'green' | 'yellow' | 'red';


export interface ToleranceBands {
  greenMin: number;
  greenMax: number;
  yellowMin: number;
  yellowMax: number;
}


export function calculateBands(target: number, tolerancePercent: number): ToleranceBands {
  const tolerance = target * (tolerancePercent / 100);
  return {
    greenMin: target - tolerance,
    greenMax: target + tolerance,
    yellowMin: target - 2 * tolerance,
    yellowMax: target + 2 * tolerance,
  };
}


export function getZone(actual: number, target: number, tolerancePercent: number): VelocityZone {
  const { greenMin, greenMax, yellowMin, yellowMax } = calculateBands(target, tolerancePercent);
 
  if (actual >= greenMin && actual <= greenMax) return 'green';
  if (actual >= yellowMin && actual <= yellowMax) return 'yellow';
  return 'red';
}


export function getZoneLabel(zone: VelocityZone): string {
  switch (zone) {
    case 'green': return 'W sam raz';
    case 'yellow': return 'Na granicy';
    case 'red': return 'Poza widełkami';
  }
}
```


## 3. UI/UX Implementation


### Edit Modal (`components/compass/edit-sprint-button.tsx`)
- Add state for `tolerance`.
- Add an input field (number or slider) for `tolerance_percent` (0-100).
- Add a live preview text: `"Przy velocity ${velocity} i tolerancji ${tolerance}%: zielona strefa ${calculateBands(velocity, tolerance).greenMin}-${calculateBands(velocity, tolerance).greenMax} pt"`.
- Update the `updateCycle` call to include `tolerance_percent`.


### Capacity Logic Refactor (`lib/capacity.ts`)
- Remove `STORY_POINTS_LIMIT` and `STORY_POINTS_DANGER` as global constants if they are being replaced by the dynamic tolerance system.
- Update `getLoadStatus` to accept `target` and `tolerancePercent` and call `getZone()`.


### Component Updates
- **`components/compass/team-capacity-view.tsx`**:
  - Pass `cycle.tolerance_percent` and `profile.base_capacity` (as target) to `getZone()`.
  - Map `green` -> `text-compass-success`, `yellow` -> `text-compass-warning`, `red` -> `text-compass-destructive`.
- **`components/compass/sprint-capacity-bar.tsx`**:
  - Update colors based on the zone.
- **`components/compass/task-detail-modal.tsx`**:
  - Update the capacity warning logic to use `getZone()`.
- **`components/compass/sprint-board.tsx`**:
  - Update the total sprint velocity indicator. Target = `velocity_planned * member_count`.


## 4. Definition of Done
- [ ] Migration applied and types updated.
- [ ] `updateCycle` successfully saves `tolerance_percent`.
- [ ] Edit modal allows changing tolerance with a live preview.
- [ ] Velocity indicators (per person and per sprint) show Green for $\pm 20\%$ (default).
- [ ] Velocity indicators show Yellow for $\pm 40\%$.
- [ ] Velocity indicators show Red for $> 40\%$ deviation.
- [ ] No TypeScript errors (`pnpm tsc --noEmit`).



