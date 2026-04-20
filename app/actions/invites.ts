'use server'

import { z } from 'zod'
import { getAuthenticatedClient, createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const InviteSchema = z.object({
  email: z.string().email('Podaj prawidłowy adres email'),
})

const AcceptInviteSchema = z.object({
  token: z.string().uuid('Nieprawidłowy token'),
  password: z.string().min(6, 'Hasło musi mieć min. 6 znaków'),
})

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InviteToken {
  token: string
  email: string
  created_by: string | null
  expires_at: string
  accepted_at: string | null
  created_at: string
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function generateInviteToken(
  input: z.infer<typeof InviteSchema>
): Promise<{ inviteLink: string; email: string } | { error: string }> {
  const parsed = InviteSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const auth = await getAuthenticatedClient()
  if (!auth) return { error: 'Nie jesteś zalogowany' }

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7) // 7-day expiry

  const { data, error } = await auth.supabase
    .from('invite_tokens')
    .insert({
      email: parsed.data.email,
      created_by: auth.userId,
      expires_at: expiresAt.toISOString(),
    })
    .select('token')
    .single()

  if (error || !data) {
    console.error('generateInviteToken:', error?.message)
    return { error: 'Nie udało się wygenerować linku zaproszenia' }
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const inviteLink = `${baseUrl}/invite/${data.token}`

  revalidatePath('/team/invite')
  return { inviteLink, email: parsed.data.email }
}

// ---------------------------------------------------------------------------
// Accept invite — creates auth account + links placeholder profile if found
// ---------------------------------------------------------------------------

export async function acceptInviteWithPassword(
  input: z.infer<typeof AcceptInviteSchema>
): Promise<{ error: string } | { success: true }> {
  const parsed = AcceptInviteSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  if (!supabase) return { error: 'Brak konfiguracji Supabase' }

  // 1. Look up valid (unexpired, not yet accepted) invite
  const { data: invite, error: lookupError } = await supabase
    .from('invite_tokens')
    .select('token, email, accepted_at, expires_at')
    .eq('token', parsed.data.token)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (lookupError || !invite) {
    return { error: 'Zaproszenie jest nieważne lub wygasło' }
  }

  // 2. Create auth account (signUp)
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: invite.email,
    password: parsed.data.password,
  })

  if (signUpError || !signUpData.user) {
    console.error('acceptInviteWithPassword signUp:', signUpError?.message)
    return { error: signUpError?.message ?? 'Nie udało się utworzyć konta' }
  }

  const newUserId = signUpData.user.id

  // 3. Sign in immediately (signUp doesn't auto-sign-in in all Supabase configs)
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: invite.email,
    password: parsed.data.password,
  })

  if (signInError) {
    console.error('acceptInviteWithPassword signIn:', signInError.message)
    return { error: 'Konto utworzone, ale logowanie nie powiodło się. Zaloguj się ręcznie.' }
  }

  // 4. Mark invite as accepted
  await supabase
    .from('invite_tokens')
    .update({ accepted_at: new Date().toISOString() })
    .eq('token', parsed.data.token)

  // 5. Link existing placeholder / invited profile (if one exists for this email)
  //    Preserve roles, skills, bio — only update identity fields.
  const { data: placeholder } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', invite.email)
    .in('profile_type', ['placeholder', 'invited'])
    .maybeSingle()

  if (placeholder) {
    // Link placeholder profile to the new auth user
    // The handle_new_user trigger created a new profile with id = newUserId.
    // We need to:
    //   a) Copy roles/skills/bio from placeholder into the new profile
    //   b) Delete the placeholder (its data is now in the linked profile)
    const { data: phData } = await supabase
      .from('profiles')
      .select('role, skills, bio')
      .eq('id', placeholder.id)
      .single()

    if (phData) {
      await supabase
        .from('profiles')
        .update({
          role: phData.role ?? [],
          skills: phData.skills ?? [],
          bio: phData.bio ?? null,
          profile_type: 'active',
          linked_user_id: null,
        })
        .eq('id', newUserId)

      // Remove the now-redundant placeholder
      await supabase
        .from('profiles')
        .delete()
        .eq('id', placeholder.id)
    }
  } else {
    // No placeholder — just mark the auto-created profile as active
    await supabase
      .from('profiles')
      .update({ profile_type: 'active' })
      .eq('id', newUserId)
  }

  revalidatePath('/team/members')
  redirect('/my-day')
}

// ---------------------------------------------------------------------------
// Legacy acceptInvite (kept for backwards compat — requires existing session)
// ---------------------------------------------------------------------------

export async function acceptInvite(
  token: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await getAuthenticatedClient()
  if (!auth) return { success: false, error: 'Musisz być zalogowany, aby zaakceptować zaproszenie' }

  const { data: invite, error: lookupError } = await auth.supabase
    .from('invite_tokens')
    .select('token, email, accepted_at, expires_at')
    .eq('token', token)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (lookupError || !invite) {
    return { success: false, error: 'Zaproszenie jest nieważne lub wygasło' }
  }

  const { error: updateError } = await auth.supabase
    .from('invite_tokens')
    .update({ accepted_at: new Date().toISOString() })
    .eq('token', token)

  if (updateError) {
    console.error('acceptInvite:', updateError.message)
    return { success: false, error: 'Nie udało się zaakceptować zaproszenia' }
  }

  return { success: true }
}

export async function getPendingInvites(): Promise<InviteToken[]> {
  const auth = await getAuthenticatedClient()
  if (!auth) return []

  const { data, error } = await auth.supabase
    .from('invite_tokens')
    .select('*')
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  if (error) { console.error('getPendingInvites:', error.message); return [] }
  return (data ?? []) as InviteToken[]
}
