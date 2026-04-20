'use server'

import { z } from 'zod'
import { getAuthenticatedClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { DbGoal, GoalType } from '@/lib/supabase/types'
import { MOCK_GOALS } from '@/lib/mock-data'

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const GoalTypeEnum = z.enum(['objective', 'key_result', 'grant_milestone'])

const CreateGoalSchema = z.object({
  title: z.string().min(1, 'Tytuł jest wymagany').max(200, 'Tytuł za długi (max 200 znaków)'),
  type: GoalTypeEnum,
  description: z.string().max(2000).nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  parentGoalId: z.string().nullable().optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Nieprawidłowy format daty').nullable().optional(),
})

const UpdateGoalProgressSchema = z.object({
  progress: z.number().int().min(0, 'Postęp nie może być ujemny').max(100, 'Postęp nie może przekroczyć 100'),
})

const UpdateGoalSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: z.enum(['on_track', 'at_risk', 'off_track', 'achieved']).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  project_id: z.string().uuid().nullable().optional(),
  target_value: z.number().nullable().optional(),
  current_value: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  quarter: z.string().nullable().optional(),
  budget_planned_pln: z.number().nullable().optional(),
  budget_actual_pln: z.number().nullable().optional(),
  due_date: z.string().nullable().optional(),
})

export async function getGoalById(id: string): Promise<DbGoal | null> {
  const auth = await getAuthenticatedClient()

  if (!auth) {
    return MOCK_GOALS.find((g) => g.id === id) ?? null
  }

  const { data, error } = await auth.supabase
    .from('goals')
    .select('*')
    .eq('id', id)
    .single()

  if (error) { console.error('getGoalById:', error.message); return null }
  return data as DbGoal
}

export async function updateGoal(
  id: string,
  input: z.infer<typeof UpdateGoalSchema>
): Promise<{ error: string | null }> {
  const parsed = UpdateGoalSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const auth = await getAuthenticatedClient()

  if (!auth) return { error: null }

  const { error } = await auth.supabase
    .from('goals')
    .update(parsed.data)
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/goals')
  revalidatePath('/gantt')
  return { error: null }
}

export async function getGoals(projectId?: string | null): Promise<DbGoal[]> {
  const auth = await getAuthenticatedClient()

  if (!auth) return MOCK_GOALS

  let query = auth.supabase
    .from('goals')
    .select('*')
    .order('type')
    .order('created_at')

  if (projectId) {
    query = query.eq('project_id', projectId)
  }

  const { data, error } = await query

  if (error) { console.error('getGoals:', error.message); return [] }

  return (data ?? []) as DbGoal[]
}

export async function createGoal(input: {
  title: string
  type: GoalType
  description?: string | null
  projectId?: string | null
  parentGoalId?: string | null
  dueDate?: string | null
}): Promise<{ error: string | null; goal?: DbGoal }> {
  const parsed = CreateGoalSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const auth = await getAuthenticatedClient()

  if (!auth) return { error: null }

  const { data } = parsed
  const { data: goal, error } = await auth.supabase
    .from('goals')
    .insert({
      title: data.title,
      type: data.type,
      description: data.description ?? null,
      project_id: data.projectId ?? null,
      parent_goal_id: data.parentGoalId ?? null,
      due_date: data.dueDate ?? null,
      progress: 0,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/goals')
  return { error: null, goal: goal as DbGoal }
}

export async function updateGoalProgress(
  id: string,
  progress: number
): Promise<{ error: string | null }> {
  const validated = UpdateGoalProgressSchema.safeParse({ progress })
  if (!validated.success) {
    return { error: validated.error.issues[0].message }
  }

  const auth = await getAuthenticatedClient()

  if (!auth) return { error: null }

  const { error } = await auth.supabase
    .from('goals')
    .update({ progress: validated.data.progress })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/goals')
  return { error: null }
}

export async function deleteGoal(id: string): Promise<{ error: string | null }> {
  const auth = await getAuthenticatedClient()

  if (!auth) return { error: null }

  const { error } = await auth.supabase
    .from('goals')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/goals')
  return { error: null }
}
