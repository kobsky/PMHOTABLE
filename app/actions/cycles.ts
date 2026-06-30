'use server'

import { z } from 'zod'
import { getAuthenticatedClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { cache } from 'react'
import type { DbCycle, SprintLink, SprintLinkLabel } from '@/lib/supabase/types'
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
  velocity_planned: z.coerce.number().int().min(20, 'Pojemność musi wynosić min. 20 pkt').max(50, 'Pojemność nie może przekraczać 50 pkt').optional().nullable(),
  tolerance_percent: z.coerce.number().int().min(0).max(100).optional().nullable(),
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

export const getActiveCycle = cache(async (): Promise<DbCycle | null> => {
  const auth = await getAuthenticatedClient()
  if (!auth) return MOCK_CYCLE
  const { data, error } = await auth.supabase
    .from('cycles').select('*').eq('is_active', true).maybeSingle()
  if (error) { console.error('getActiveCycle:', error.message); return null }
  return data as DbCycle | null
})

export const getAllCycles = cache(async (): Promise<DbCycle[]> => {
  const auth = await getAuthenticatedClient()
  if (!auth) return MOCK_CYCLES
  const { data, error } = await auth.supabase
    .from('cycles').select('*').order('start_date', { ascending: false })
  if (error) { console.error('getAllCycles:', error.message); return [] }
  return (data ?? []) as DbCycle[]
})

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
      // tolerance_percent jest NOT NULL DEFAULT 20 (017). Pomijamy klucz, gdy nie
      // podano, aby zadziałał default bazy — jawny NULL łamałby ograniczenie.
      ...(data.tolerance_percent != null ? { tolerance_percent: data.tolerance_percent } : {}),
      is_active: isActive,
    })
    .select()
    .single()

  if (error) {
    // Naruszenie partial-unique „jeden aktywny sprint" (race przy równoległym
    // tworzeniu aktywnego cyklu) — zwróć przyjazny komunikat zamiast surowego błędu.
    if (error.code === '23505') {
      return { error: 'Sprint już aktywny / naruszenie unikalności' }
    }
    return { error: error.message }
  }

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

  // Atomowo: deaktywuj wszystkie i aktywuj wybrany w jednej transakcji (LOG-003),
  // bez okna z dwoma aktywnymi cyklami ani z zerem aktywnych po awarii.
  const { error } = await auth.supabase.rpc('activate_cycle', { p_cycle_id: cycleId })

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

  const newLink: SprintLink = {
    id: crypto.randomUUID(),
    title: link.title,
    url: link.url,
    label: link.label as SprintLinkLabel,
  }

  // Atomowy append po stronie bazy (LOG-004) — bez read-modify-write na JSONB.
  const { error } = await auth.supabase.rpc('add_cycle_link', {
    p_cycle_id: cycleId,
    p_link: newLink,
  })

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

  // Atomowe usunięcie linku po id po stronie bazy (LOG-004).
  const { error } = await auth.supabase.rpc('remove_cycle_link', {
    p_cycle_id: cycleId,
    p_link_id: linkId,
  })

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

  // Atomowy append wpisu niedostępności (LOG-004); de-duplikacja po dacie
  // odbywa się po stronie funkcji bazodanowej.
  const { error } = await auth.supabase.rpc('add_unavailable_date', {
    p_cycle_id: cycleId,
    p_user_id: userId,
    p_date: date,
    p_reason: reason,
  })

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

  // Atomowe usunięcie wpisu niedostępności dla daty (LOG-004).
  const { error } = await auth.supabase.rpc('remove_unavailable_date', {
    p_cycle_id: cycleId,
    p_user_id: userId,
    p_date: date,
  })

  if (error) return { error: error.message }

  revalidatePath('/board')
  return { error: null }
}
