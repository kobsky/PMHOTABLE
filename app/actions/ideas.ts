'use server'

import { z } from 'zod'
import { getAuthenticatedClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { IdeaWithAuthor, IdeaStatus } from '@/lib/supabase/types'
import { MOCK_IDEAS, MOCK_USERS } from '@/lib/mock-data'

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const IceScoreField = z.number().int().min(1, 'Wartość ICE musi być między 1 a 10').max(10, 'Wartość ICE musi być między 1 a 10')

const CreateIdeaSchema = z.object({
  title: z.string().min(1, 'Tytuł jest wymagany').max(200, 'Tytuł za długi (max 200 znaków)'),
  description: z.string().max(2000, 'Opis za długi (max 2000 znaków)').nullable().optional(),
  iceImpact: IceScoreField,
  iceConfidence: IceScoreField,
  iceEase: IceScoreField,
})

const IDEA_SELECT = '*, author:profiles(*)'

function mockIdeasWithAuthors(): IdeaWithAuthor[] {
  return MOCK_IDEAS.map((idea) => ({
    ...idea,
    author: MOCK_USERS.find((u) => u.id === idea.author_id) ?? MOCK_USERS[0],
  }))
}

export async function getIdeas(): Promise<IdeaWithAuthor[]> {
  const auth = await getAuthenticatedClient()

  if (!auth) return mockIdeasWithAuthors()

  const { data, error } = await auth.supabase
    .from('ideas')
    .select(IDEA_SELECT)
    .order('ice_score', { ascending: false })

  if (error) { console.error('getIdeas:', error.message); return [] }

  return (data ?? []) as unknown as IdeaWithAuthor[]
}

export async function createIdea(input: {
  title: string
  description?: string | null
  iceImpact: number
  iceConfidence: number
  iceEase: number
}): Promise<{ error: string | null }> {
  const parsed = CreateIdeaSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const auth = await getAuthenticatedClient()

  if (!auth) return { error: 'Brak autoryzacji' }

  const { data } = parsed
  const { error } = await auth.supabase.from('ideas').insert({
    title: data.title,
    description: data.description ?? null,
    ice_impact: data.iceImpact,
    ice_confidence: data.iceConfidence,
    ice_ease: data.iceEase,
    status: 'inbox',
    author_id: auth.userId,
  })

  if (error) return { error: error.message }

  revalidatePath('/ideas')
  return { error: null }
}

export async function updateIdeaStatus(
  id: string,
  status: IdeaStatus,
  rejectionReason?: string
): Promise<{ error: string | null }> {
  const auth = await getAuthenticatedClient()

  if (!auth) return { error: 'Brak autoryzacji' }

  const patch: Record<string, unknown> = { status }
  if (status === 'rejected' && rejectionReason) {
    patch.rejection_reason = rejectionReason
  }

  const { error } = await auth.supabase
    .from('ideas')
    .update(patch)
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/ideas')
  return { error: null }
}

export async function promoteIdeaToTask(
  ideaId: string,
  taskInput: {
    title: string
    projectId: string
    priority?: string
  }
): Promise<{ error: string | null }> {
  const auth = await getAuthenticatedClient()

  if (!auth) return { error: 'Brak autoryzacji' }

  // Utwórz zadanie
  const { data: task, error: taskError } = await auth.supabase
    .from('tasks')
    .insert({
      title: taskInput.title,
      project_id: taskInput.projectId,
      priority: taskInput.priority ?? 'medium',
      status: 'todo',
      assignee_id: auth.userId,
    })
    .select('id')
    .single()

  if (taskError) return { error: taskError.message }

  // Oznacz ideę jako converted
  const { error: ideaError } = await auth.supabase
    .from('ideas')
    .update({ status: 'converted' })
    .eq('id', ideaId)

  if (ideaError) return { error: ideaError.message }

  revalidatePath('/ideas')
  revalidatePath('/backlog')
  return { error: null }
}
