import type { DbUser, DbCycle } from '@/lib/supabase/types'
import type { TaskWithRelations } from '@/lib/supabase/types'

export const STORY_POINTS_VALUES = [1, 2, 3, 5, 8] as const
export type StoryPointsValue = typeof STORY_POINTS_VALUES[number]

export const STORY_POINTS_LIMIT = 12   // per-person warning threshold
export const STORY_POINTS_DANGER = 15  // per-person danger threshold

export function calculateUsedCapacity(tasks: TaskWithRelations[]): number {
  return tasks.reduce((sum, task) => sum + (task.story_points ?? 0), 0)
}

export function calculateEffectiveCapacity(profile: DbUser, cycle: DbCycle): number {
  const base = profile.base_capacity ?? STORY_POINTS_LIMIT
  const cycleDays = Math.max(
    1,
    Math.ceil(
      (new Date(cycle.end_date).getTime() - new Date(cycle.start_date).getTime()) /
        (1000 * 60 * 60 * 24)
    )
  )
  const unavailable = (cycle.unavailability as Record<string, unknown[]> | null)?.[profile.id] ?? []
  const availableDays = Math.max(0, cycleDays - unavailable.length)
  return base * (availableDays / cycleDays)
}

export function getLoadStatus(used: number, _capacity?: number): 'ok' | 'warning' | 'danger' {
  if (used > STORY_POINTS_DANGER) return 'danger'
  if (used > STORY_POINTS_LIMIT) return 'warning'
  return 'ok'
}
