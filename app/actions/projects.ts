'use server'

import { z } from 'zod'
import { getAuthenticatedClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { DbProject, ScopeTag } from '@/lib/supabase/types'
import { MOCK_PROJECTS } from '@/lib/mock-data'

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const SCOPE_TAGS = ['scope_1.0', 'scope_1.5', 'scope_2.0', 'grant_parp', 'marketing', 'ops'] as const

const ProjectSchema = z.object({
  name: z.string().min(1, 'Nazwa jest wymagana').max(100),
  scope_tag: z.enum(SCOPE_TAGS),
  description: z.string().max(500).optional().nullable(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Nieprawidłowy kolor hex')
    .default('#848179'),
})

export type CreateProjectInput = z.infer<typeof ProjectSchema>

// ---------------------------------------------------------------------------
// QUERIES
// ---------------------------------------------------------------------------

export async function getProjects(): Promise<DbProject[]> {
  const auth = await getAuthenticatedClient()

  if (!auth) return MOCK_PROJECTS

  const { data, error } = await auth.supabase
    .from('projects')
    .select('*')
    .eq('is_archived', false)
    .order('name')

  if (error) { console.error('getProjects:', error.message); return [] }

  return (data ?? []) as DbProject[]
}

// ---------------------------------------------------------------------------
// MUTATIONS
// ---------------------------------------------------------------------------

export async function createProject(
  input: CreateProjectInput
): Promise<{ error: string | null; project?: DbProject }> {
  const auth = await getAuthenticatedClient()
  if (!auth) return { error: 'Brak autoryzacji' }

  const parsed = ProjectSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { data } = parsed

  const { data: project, error } = await auth.supabase
    .from('projects')
    .insert({
      name: data.name,
      scope_tag: data.scope_tag as ScopeTag,
      description: data.description ?? null,
      color: data.color,
      is_archived: false,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/board')
  revalidatePath('/backlog')
  revalidatePath('/team')
  revalidatePath('/goals')
  return { error: null, project: project as DbProject }
}

export async function updateProject(
  projectId: string,
  input: Partial<CreateProjectInput>
): Promise<{ error: string | null }> {
  const auth = await getAuthenticatedClient()
  if (!auth) return { error: 'Brak autoryzacji' }

  const UpdateSchema = ProjectSchema.partial()
  const parsed = UpdateSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { error } = await auth.supabase
    .from('projects')
    .update(parsed.data)
    .eq('id', projectId)

  if (error) return { error: error.message }

  revalidatePath('/board')
  revalidatePath('/backlog')
  revalidatePath('/goals')
  return { error: null }
}

export async function archiveProject(projectId: string): Promise<{ error: string | null }> {
  const auth = await getAuthenticatedClient()
  if (!auth) return { error: 'Brak autoryzacji' }

  const { error } = await auth.supabase
    .from('projects')
    .update({ is_archived: true })
    .eq('id', projectId)

  if (error) return { error: error.message }

  revalidatePath('/board')
  revalidatePath('/backlog')
  revalidatePath('/goals')
  return { error: null }
}

export async function deleteProject(projectId: string): Promise<{ error: string | null }> {
  const auth = await getAuthenticatedClient()
  if (!auth) return { error: 'Brak autoryzacji' }

  const { error } = await auth.supabase
    .from('projects')
    .delete()
    .eq('id', projectId)

  if (error) return { error: error.message }

  revalidatePath('/board')
  revalidatePath('/backlog')
  return { error: null }
}
