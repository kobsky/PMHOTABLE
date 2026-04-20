'use server'

import { z } from 'zod'
import { getAuthenticatedClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { DbCycle, SprintLink, SprintLinkLabel, UnavailabilityEntry } from '@/lib/supabase/types'
import { MOCK_CYCLE, MOCK_CYCLES } from '@/lib/mock-data'

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

// Base schema without refine — allows .partial() in update operations
const CycleBaseSchema = z.object({
  name: z.string().min(1, 'Nazwa jest wymagana').max(100),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Nieprawidłowy format daty'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Nieprawidłowy format daty'),
  goal: z.string().max(500).optional().nullable(),
  velocity_planned: z.coerce.number().int().positive().optional().nullable(),
})

// Full create schema with cross-field date validation
const CycleSchema = CycleBaseSchema.refine((d) => d.end_date > d.start_date, {
  message: 'Data końca musi być po dacie początku',
  path: ['end_date'],
})

// Partial update schema — Zod v4 requires .partial() before .refine()
const CycleUpdateSchema = CycleBaseSchema.partial().refine(
  (d) => !d.start_date || !d.end_date || d.end_date > d.start_date,
  { message: 'Data końca musi być po dacie początku', path: ['end_date'] }
)

export type CreateCycleInput = z.infer<typeof CycleSchema>

// ---------------------------------------------------------------------------
// QUERIES
// ---------------------------------------------------------------------------

export async function getActiveCycle(): Promise<DbCycle | null> {
  const auth = await getAuthenticatedClient()

  if (!auth) return MOCK_CYCLE

  const { data, error } = await auth.supabase
    .from('cycles')
    .select('*')
    .eq('is_active', true)
    .maybeSingle()

  if (error) { console.error('getActiveCycle:', error.message); return null }

  return data as DbCycle | null
}

export async function getAllCycles(): Promise<DbCycle[]> {
  const auth = await getAuthenticatedClient()

  if (!auth) return MOCK_CYCLES

  const { data, error } = await auth.supabase
    .from('cycles')
    .select('*')
    .order('start_date', { ascending: false })

  if (error) { console.error('getAllCycles:', error.message); return [] }

  return (data ?? []) as DbCycle[]
}

export async function getCycleById(id: string): Promise<DbCycle | null> {
  const auth = await getAuthenticatedClient()

  if (!auth) return MOCK_CYCLES.find((c) => c.id === id) ?? null

  const { data, error } = await auth.supabase
    .from('cycles')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) { console.error('getCycleById:', error.message); return null }
  return data as DbCycle | null
}

// ---------------------------------------------------------------------------
// MUTATIONS
// ---------------------------------------------------------------------------

export async function createCycle(
  input: CreateCycleInput
): Promise<{ error: string | null; cycle?: DbCycle }> {
  const auth = await getAuthenticatedClient()
  if (!auth) return { error: 'Brak autoryzacji' }

  const parsed = CycleSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { data } = parsed

  // If no active cycle exists, new sprint becomes active automatically
  const { data: existing } = await auth.supabase
    .from('cycles')
    .select('id')
    .eq('is_active', true)
    .maybeSingle()

  const isActive = !existing

  const { data: cycle, error } = await auth.supabase
    .from('cycles')
    .insert({
      name: data.name,
      start_date: data.start_date,
      end_date: data.end_date,
      goal: data.goal ?? null,
      velocity_planned: data.velocity_planned ?? null,
      is_active: isActive,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/board')
  revalidatePath('/backlog')
  revalidatePath('/my-day')
  return { error: null, cycle: cycle as DbCycle }
}

export async function updateCycle(
  cycleId: string,
  input: Partial<CreateCycleInput>
): Promise<{ error: string | null }> {
  const auth = await getAuthenticatedClient()
  if (!auth) return { error: 'Brak autoryzacji' }

  const parsed = CycleUpdateSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { error } = await auth.supabase
    .from('cycles')
    .update(parsed.data)
    .eq('id', cycleId)

  if (error) return { error: error.message }

  revalidatePath('/board')
  revalidatePath('/backlog')
  return { error: null }
}

export async function activateCycle(cycleId: string): Promise<{ error: string | null }> {
  const auth = await getAuthenticatedClient()
  if (!auth) return { error: 'Brak autoryzacji' }

  // Deactivate all, then activate the chosen one
  const { error: deactivateErr } = await auth.supabase
    .from('cycles')
    .update({ is_active: false })
    .neq('id', cycleId)

  if (deactivateErr) return { error: deactivateErr.message }

  const { error } = await auth.supabase
    .from('cycles')
    .update({ is_active: true })
    .eq('id', cycleId)

  if (error) return { error: error.message }

  revalidatePath('/board')
  revalidatePath('/backlog')
  revalidatePath('/my-day')
  return { error: null }
}

export async function closeCycle(
  cycleId: string,
  options: { moveIncompleteToBacklog: boolean } = { moveIncompleteToBacklog: true }
): Promise<{ error: string | null }> {
  const auth = await getAuthenticatedClient()
  if (!auth) return { error: 'Brak autoryzacji' }

  // Count done tasks → record as velocity_actual
  const { count: doneCount } = await auth.supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('cycle_id', cycleId)
    .eq('status', 'done')
    .is('deleted_at', null)

  // Move incomplete tasks to backlog (cycle_id = null) if requested
  if (options.moveIncompleteToBacklog) {
    const { error: moveErr } = await auth.supabase
      .from('tasks')
      .update({ cycle_id: null })
      .eq('cycle_id', cycleId)
      .in('status', ['todo', 'in_progress', 'in_review'])
      .is('deleted_at', null)

    if (moveErr) return { error: moveErr.message }
  }

  // Close cycle and record velocity_actual
  const { error } = await auth.supabase
    .from('cycles')
    .update({
      is_active: false,
      velocity_actual: doneCount ?? 0,
    })
    .eq('id', cycleId)

  if (error) return { error: error.message }

  revalidatePath('/board')
  revalidatePath('/backlog')
  revalidatePath('/my-day')
  return { error: null }
}

export async function deleteCycle(cycleId: string): Promise<{ error: string | null }> {
  const auth = await getAuthenticatedClient()
  if (!auth) return { error: 'Brak autoryzacji' }

  // Safety: cannot delete an active cycle
  const { data: cycle } = await auth.supabase
    .from('cycles')
    .select('is_active')
    .eq('id', cycleId)
    .single()

  if (!cycle) return { error: 'Sprint nie istnieje.' }
  if (cycle.is_active) {
    return { error: 'Nie można usunąć aktywnego sprintu. Najpierw go zamknij.' }
  }

  // Safety: cannot delete a cycle that still has tasks
  const { count: taskCount } = await auth.supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('cycle_id', cycleId)
    .is('deleted_at', null)

  if (taskCount && taskCount > 0) {
    return {
      error: `Nie można usunąć sprintu z ${taskCount} zadaniem/zadaniami. Przenieś lub usuń zadania.`,
    }
  }

  const { error } = await auth.supabase
    .from('cycles')
    .delete()
    .eq('id', cycleId)

  if (error) return { error: error.message }

  revalidatePath('/board')
  revalidatePath('/backlog')
  revalidatePath('/sprints')
  return { error: null }
}

export async function getNextSprintNumber(): Promise<number> {
  const auth = await getAuthenticatedClient()
  if (!auth) return 1

  const { count } = await auth.supabase
    .from('cycles')
    .select('id', { count: 'exact', head: true })

  return (count ?? 0) + 1
}

// ---------------------------------------------------------------------------
// SPRINT NOTES
// ---------------------------------------------------------------------------

export async function updateCycleNotes(
  cycleId: string,
  notes: string
): Promise<{ error: string | null }> {
  const auth = await getAuthenticatedClient()
  if (!auth) return { error: 'Brak autoryzacji' }

  const { error } = await auth.supabase
    .from('cycles')
    .update({ notes })
    .eq('id', cycleId)

  if (error) return { error: error.message }

  revalidatePath('/board')
  return { error: null }
}

// ---------------------------------------------------------------------------
// SPRINT LINKS
// ---------------------------------------------------------------------------

export async function addCycleLink(
  cycleId: string,
  link: Omit<SprintLink, 'id'>
): Promise<{ error: string | null }> {
  const auth = await getAuthenticatedClient()
  if (!auth) return { error: 'Brak autoryzacji' }

  const { data: cycle, error: fetchErr } = await auth.supabase
    .from('cycles')
    .select('sprint_links')
    .eq('id', cycleId)
    .single()

  if (fetchErr) return { error: fetchErr.message }

  const existing: SprintLink[] = (cycle?.sprint_links as SprintLink[] | null) ?? []
  const newLink: SprintLink = {
    id: crypto.randomUUID(),
    title: link.title,
    url: link.url,
    label: link.label as SprintLinkLabel,
  }

  const { error } = await auth.supabase
    .from('cycles')
    .update({ sprint_links: [...existing, newLink] })
    .eq('id', cycleId)

  if (error) return { error: error.message }

  revalidatePath('/board')
  return { error: null }
}

export async function removeCycleLink(
  cycleId: string,
  linkId: string
): Promise<{ error: string | null }> {
  const auth = await getAuthenticatedClient()
  if (!auth) return { error: 'Brak autoryzacji' }

  const { data: cycle, error: fetchErr } = await auth.supabase
    .from('cycles')
    .select('sprint_links')
    .eq('id', cycleId)
    .single()

  if (fetchErr) return { error: fetchErr.message }

  const updated = ((cycle?.sprint_links as SprintLink[] | null) ?? []).filter(
    (l) => l.id !== linkId
  )

  const { error } = await auth.supabase
    .from('cycles')
    .update({ sprint_links: updated })
    .eq('id', cycleId)

  if (error) return { error: error.message }

  revalidatePath('/board')
  return { error: null }
}

// ---------------------------------------------------------------------------
// TEAM UNAVAILABILITY
// ---------------------------------------------------------------------------

export async function addUnavailableDate(
  cycleId: string,
  userId: string,
  date: string,
  reason: string
): Promise<{ error: string | null }> {
  const auth = await getAuthenticatedClient()
  if (!auth) return { error: 'Brak autoryzacji' }

  const { data: cycle, error: fetchErr } = await auth.supabase
    .from('cycles')
    .select('unavailability')
    .eq('id', cycleId)
    .single()

  if (fetchErr) return { error: fetchErr.message }

  const unavailability: Record<string, UnavailabilityEntry[]> =
    (cycle?.unavailability as Record<string, UnavailabilityEntry[]> | null) ?? {}

  const userEntries = unavailability[userId] ?? []
  if (userEntries.some((e) => e.date === date)) return { error: null } // already set

  const updated = {
    ...unavailability,
    [userId]: [...userEntries, { date, reason }],
  }

  const { error } = await auth.supabase
    .from('cycles')
    .update({ unavailability: updated })
    .eq('id', cycleId)

  if (error) return { error: error.message }

  revalidatePath('/board')
  return { error: null }
}

export async function removeUnavailableDate(
  cycleId: string,
  userId: string,
  date: string
): Promise<{ error: string | null }> {
  const auth = await getAuthenticatedClient()
  if (!auth) return { error: 'Brak autoryzacji' }

  const { data: cycle, error: fetchErr } = await auth.supabase
    .from('cycles')
    .select('unavailability')
    .eq('id', cycleId)
    .single()

  if (fetchErr) return { error: fetchErr.message }

  const unavailability: Record<string, UnavailabilityEntry[]> =
    (cycle?.unavailability as Record<string, UnavailabilityEntry[]> | null) ?? {}

  const updated = {
    ...unavailability,
    [userId]: (unavailability[userId] ?? []).filter((e) => e.date !== date),
  }

  const { error } = await auth.supabase
    .from('cycles')
    .update({ unavailability: updated })
    .eq('id', cycleId)

  if (error) return { error: error.message }

  revalidatePath('/board')
  return { error: null }
}
