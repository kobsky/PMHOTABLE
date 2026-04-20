import type { DbUser, DbCycle } from '@/lib/supabase/types'
import type { TaskWithRelations } from '@/lib/supabase/types'

export const SIZE_POINTS: Record<string, number> = {
  XS: 0.5,
  S: 1,
  M: 2,
  L: 3,
  XL: 5,
  XXL: 8,
}

export function calculateUsedCapacity(tasks: TaskWithRelations[]): number {
  return tasks.reduce((sum, task) => sum + (SIZE_POINTS[task.size ?? 'M'] ?? 2), 0)
}

export function calculateEffectiveCapacity(profile: DbUser, cycle: DbCycle): number {
  const base = profile.base_capacity ?? 20
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

export function getLoadStatus(used: number, capacity: number): 'ok' | 'warning' | 'danger' {
  if (capacity <= 0) return 'ok'
  const ratio = used / capacity
  if (ratio > 1) return 'danger'
  if (ratio >= 0.8) return 'warning'
  return 'ok'
}
