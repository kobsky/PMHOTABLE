'use server'

import { getAuthenticatedClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { DbUser } from '@/lib/supabase/types'
import {
  UpdateMemberSchema,
  CreatePlaceholderSchema,
  type UpdateMemberInput,
  type CreatePlaceholderInput,
} from '@/lib/team-constants'

// ---------------------------------------------------------------------------
// QUERIES
// ---------------------------------------------------------------------------

export async function getTeamMembers(): Promise<DbUser[]> {
  const auth = await getAuthenticatedClient()

  if (!auth) return []

  const { data, error } = await auth.supabase
    .from('profiles')
    .select('*')
    .order('full_name')

  if (error) { console.error('getTeamMembers:', error.message); return [] }
  return (data ?? []) as DbUser[]
}

export async function getMemberById(userId: string): Promise<DbUser | null> {
  const auth = await getAuthenticatedClient()

  if (!auth) return null

  const { data, error } = await auth.supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) { console.error('getMemberById:', error.message); return null }
  return data as DbUser | null
}

// ---------------------------------------------------------------------------
// MUTATIONS
// ---------------------------------------------------------------------------

export async function updateMember(
  userId: string,
  input: UpdateMemberInput
): Promise<{ error: string | null }> {
  const parsed = UpdateMemberSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const auth = await getAuthenticatedClient()
  if (!auth) return { error: 'Brak autoryzacji' }

  const { error } = await auth.supabase
    .from('profiles')
    .update(parsed.data)
    .eq('id', userId)

  if (error) return { error: error.message }

  revalidatePath('/team/members')
  revalidatePath(`/team/members/${userId}`)
  revalidatePath('/team')
  revalidatePath('/settings/team')
  revalidatePath('/capacity')
  return { error: null }
}

// ---------------------------------------------------------------------------
// Placeholder profiles — add a member without requiring an Auth account
// ---------------------------------------------------------------------------

export async function createPlaceholderProfile(
  input: CreatePlaceholderInput
): Promise<{ error: string | null; id?: string }> {
  const parsed = CreatePlaceholderSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const auth = await getAuthenticatedClient()
  if (!auth) return { error: 'Brak autoryzacji' }

  // If email provided, check it's not already in use
  if (parsed.data.email) {
    const { data: existing } = await auth.supabase
      .from('profiles')
      .select('id')
      .eq('email', parsed.data.email)
      .maybeSingle()

    if (existing) {
      return { error: 'Profil z tym adresem email już istnieje' }
    }
  }

  const { data, error } = await auth.supabase
    .from('profiles')
    .insert({
      id: crypto.randomUUID(),          // profiles.id has no DEFAULT — must supply for placeholders
      full_name: parsed.data.full_name,
      email: parsed.data.email ?? null,
      role: parsed.data.role,
      bio: parsed.data.bio ?? null,
      skills: parsed.data.skills ?? [],
      profile_type: 'placeholder',
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/team/members')
  revalidatePath('/team')
  return { error: null, id: data.id }
}

// ---------------------------------------------------------------------------
// Send invite to a placeholder profile
// Marks the profile as 'invited' and generates an invite token
// ---------------------------------------------------------------------------

export async function sendInviteToPlaceholder(
  profileId: string
): Promise<{ error: string | null; inviteLink?: string }> {
  const auth = await getAuthenticatedClient()
  if (!auth) return { error: 'Brak autoryzacji' }

  // Fetch the placeholder
  const { data: profile, error: fetchError } = await auth.supabase
    .from('profiles')
    .select('id, email, profile_type')
    .eq('id', profileId)
    .maybeSingle()

  if (fetchError || !profile) return { error: 'Nie znaleziono profilu' }
  if (!profile.email) return { error: 'Profil nie ma adresu email — edytuj profil i dodaj email przed zaproszeniem' }
  if (profile.profile_type === 'active') return { error: 'Ten użytkownik ma już aktywne konto' }

  // Create an invite token
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)

  const { data: tokenData, error: tokenError } = await auth.supabase
    .from('invite_tokens')
    .insert({
      email: profile.email,
      created_by: auth.userId,
      expires_at: expiresAt.toISOString(),
    })
    .select('token')
    .single()

  if (tokenError || !tokenData) {
    return { error: 'Nie udało się wygenerować linku zaproszenia' }
  }

  // Update profile_type to 'invited'
  await auth.supabase
    .from('profiles')
    .update({ profile_type: 'invited' })
    .eq('id', profileId)

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const inviteLink = `${baseUrl}/invite/${tokenData.token}`

  revalidatePath('/team/members')
  return { error: null, inviteLink }
}

// ---------------------------------------------------------------------------
// Delete a placeholder / invited profile
// ---------------------------------------------------------------------------

export async function deletePlaceholderProfile(
  profileId: string
): Promise<{ error: string | null }> {
  const auth = await getAuthenticatedClient()
  if (!auth) return { error: 'Brak autoryzacji' }

  const { error } = await auth.supabase
    .from('profiles')
    .delete()
    .eq('id', profileId)
    .in('profile_type', ['placeholder', 'invited'])

  if (error) return { error: error.message }

  revalidatePath('/team/members')
  revalidatePath('/team')
  return { error: null }
}
