'use server'

import { z } from 'zod'
import { getAuthenticatedClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { IdeaWithAuthor, IdeaStatus, TaskPriority } from '@/lib/supabase/types'
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

const UpdateIdeaStatusSchema = z
  .object({
    status: z.enum(['inbox', 'accepted', 'rejected', 'converted']),
    rejectionReason: z.string().trim().min(1).max(500).optional().nullable(),
  })
  .refine((d) => d.status !== 'rejected' || !!d.rejectionReason, {
    message: 'Powód odrzucenia jest wymagany przy odrzuceniu pomysłu',
    path: ['rejectionReason'],
  })

const PromoteIdeaSchema = z.object({
  ideaId: z.string().uuid('Nieprawidłowy identyfikator pomysłu'),
  title: z.string().min(1, 'Tytuł jest wymagany').max(200, 'Tytuł za długi (max 200 znaków)'),
  projectId: z.string().uuid('Nieprawidłowy projekt'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
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
  // Wymuś rejection_reason przy odrzuceniu (LOG-009) — przyjazny komunikat
  // zamiast surowego błędu CHECK z bazy.
  const parsed = UpdateIdeaStatusSchema.safeParse({ status, rejectionReason })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const auth = await getAuthenticatedClient()

  if (!auth) return { error: 'Brak autoryzacji' }

  const patch: Record<string, unknown> = { status: parsed.data.status }
  if (parsed.data.status === 'rejected') {
    patch.rejection_reason = parsed.data.rejectionReason
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
  const parsed = PromoteIdeaSchema.safeParse({
    ideaId,
    title: taskInput.title,
    projectId: taskInput.projectId,
    priority: taskInput.priority,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const auth = await getAuthenticatedClient()

  if (!auth) return { error: 'Brak autoryzacji' }

  // Atomowy promote (LOG-005): RPC w jednej transakcji tworzy zadanie,
  // ustawia status pomysłu na 'converted' i wypełnia promoted_to_task_id.
  // Zwraca id zadania lub null, jeśli pomysł nie istnieje / był już przeniesiony.
  const priority: TaskPriority = parsed.data.priority ?? 'medium'
  const { data: newTaskId, error } = await auth.supabase.rpc('promote_idea_to_task', {
    p_idea_id: parsed.data.ideaId,
    p_title: parsed.data.title,
    p_project_id: parsed.data.projectId,
    p_priority: priority,
    p_assignee_id: auth.userId,
  })

  if (error) return { error: error.message }
  if (!newTaskId) {
    return { error: 'Pomysł nie istnieje lub został już przeniesiony do zadania' }
  }

  revalidatePath('/ideas')
  revalidatePath('/backlog')
  return { error: null }
}
