'use server'

import { z } from 'zod'
import { getAuthenticatedClient, createClient } from '@/lib/supabase/server'

const ChangePasswordSchema = z.object({
  password: z.string().min(6, 'Hasło musi mieć min. 6 znaków'),
})

const RequestResetSchema = z.object({
  email: z.string().email('Podaj prawidłowy adres email'),
})

export async function changePassword(
  input: z.infer<typeof ChangePasswordSchema>
): Promise<{ success: true } | { error: string }> {
  const parsed = ChangePasswordSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const auth = await getAuthenticatedClient()
  if (!auth) return { error: 'Nie jesteś zalogowany' }

  const { error } = await auth.supabase.auth.updateUser({
    password: parsed.data.password,
  })

  if (error) {
    console.error('changePassword:', error.message)
    return { error: error.message }
  }

  return { success: true }
}

export async function requestPasswordReset(
  input: z.infer<typeof RequestResetSchema>
): Promise<{ success: true } | { error: string }> {
  const parsed = RequestResetSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  if (!supabase) return { error: 'Brak konfiguracji Supabase' }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${baseUrl}/auth/callback?next=/settings/account`,
  })

  if (error) {
    console.error('requestPasswordReset:', error.message)
    return { error: error.message }
  }

  return { success: true }
}
