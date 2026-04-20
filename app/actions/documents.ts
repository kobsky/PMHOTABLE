'use server'

import { z } from 'zod'
import { getAuthenticatedClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { DbDocument, DocumentType, DocumentStatus } from '@/lib/supabase/types'
import { MOCK_DOCUMENTS } from '@/lib/mock-data'

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const DocumentTypeEnum = z.enum(['adr', 'rfc', 'spec', 'brief', 'weekly_summary'])
const DocumentStatusEnum = z.enum(['draft', 'review', 'accepted', 'deprecated', 'superseded'])

const CreateDocumentSchema = z.object({
  title: z.string().min(1, 'Tytuł jest wymagany').max(200, 'Tytuł za długi (max 200 znaków)'),
  type: DocumentTypeEnum,
  content: z.string().optional(),
  projectId: z.string().nullable().optional(),
})

const UpdateDocumentSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().optional(),
  status: DocumentStatusEnum.optional(),
})

export async function getDocuments(): Promise<DbDocument[]> {
  const auth = await getAuthenticatedClient()

  if (!auth) return MOCK_DOCUMENTS

  const { data, error } = await auth.supabase
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) { console.error('getDocuments:', error.message); return [] }

  return (data ?? []) as DbDocument[]
}

export async function createDocument(input: {
  title: string
  type: DocumentType
  content?: string
  projectId?: string | null
}): Promise<{ error: string | null }> {
  const parsed = CreateDocumentSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const auth = await getAuthenticatedClient()

  if (!auth) return { error: null }

  const { data } = parsed
  const { error } = await auth.supabase.from('documents').insert({
    title: data.title,
    type: data.type,
    content: data.content ?? '',
    project_id: data.projectId ?? null,
    author_id: auth.userId,
  })

  if (error) return { error: error.message }

  revalidatePath('/decisions')
  return { error: null }
}

export async function updateDocumentContent(
  id: string,
  content: string
): Promise<{ error: string | null }> {
  const auth = await getAuthenticatedClient()

  if (!auth) return { error: null }

  const { error } = await auth.supabase
    .from('documents')
    .update({ content })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/decisions')
  return { error: null }
}

export async function updateDocumentStatus(
  id: string,
  status: DocumentStatus
): Promise<{ error: string | null }> {
  const auth = await getAuthenticatedClient()

  if (!auth) return { error: null }

  const { error } = await auth.supabase
    .from('documents')
    .update({ status })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/decisions')
  return { error: null }
}

export async function updateDocument(
  id: string,
  patch: { title?: string; content?: string; status?: DocumentStatus }
): Promise<{ error: string | null }> {
  const parsed = UpdateDocumentSchema.safeParse(patch)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const auth = await getAuthenticatedClient()

  if (!auth) return { error: null }

  const { error } = await auth.supabase
    .from('documents')
    .update(parsed.data)
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/decisions')
  return { error: null }
}

export async function deleteDocument(id: string): Promise<{ error: string | null }> {
  const auth = await getAuthenticatedClient()

  if (!auth) return { error: null }

  const { error } = await auth.supabase
    .from('documents')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/decisions')
  return { error: null }
}
