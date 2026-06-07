'use server'

import { z } from 'zod'
import { getAuthenticatedClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { headers } from 'next/headers'

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

// Zwraca { success } gdy mail wysłany przez Resend,
// { resetLink } gdy brak klucza Resend (link do wyświetlenia w UI / dev),
// { error } gdy konto nie istnieje lub błąd krytyczny.
export async function requestPasswordReset(
  input: z.infer<typeof RequestResetSchema>
): Promise<{ success: true } | { resetLink: string } | { error: string }> {
  const parsed = RequestResetSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return { error: 'Brak konfiguracji Supabase' }

  let baseUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!baseUrl) {
    const headersList = await headers()
    const host = headersList.get('host') || 'localhost:3000'
    const protocol = headersList.get('x-forwarded-proto') || 'http'
    baseUrl = `${protocol}://${host}`
  }

  // Admin client — generuje token resetu bez wysyłki przez Supabase SMTP
  // i bez wymagania whitelisty redirect URL w Supabase Dashboard.
  const admin = createAdminClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: parsed.data.email,
  })

  if (error || !data?.properties?.hashed_token) {
    console.error('requestPasswordReset generateLink:', error?.message)
    return { error: 'Nie znaleziono konta z tym adresem email' }
  }

  // Link kieruje bezpośrednio do naszego callbacku z token_hash —
  // omija Supabase verify endpoint i jego sprawdzanie whitelisty.
  const resetLink = `${baseUrl}/auth/callback?token_hash=${data.properties.hashed_token}&type=recovery&next=/reset-password`

  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
        to: parsed.data.email,
        subject: 'Reset hasła — Hotable Compass',
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #EAE8DF;">Reset hasła</h2>
            <p style="color: #A8A49A;">Kliknij poniższy przycisk aby ustawić nowe hasło. Link jest ważny przez 1 godzinę.</p>
            <a href="${resetLink}"
               style="display:inline-block;background:#E8622A;color:#fff;padding:10px 20px;
                      border-radius:4px;text-decoration:none;font-weight:600;margin:16px 0;">
              Ustaw nowe hasło
            </a>
            <p style="color: #7A766E; font-size: 12px;">
              Lub skopiuj ten link:<br>${resetLink}
            </p>
            <p style="color: #7A766E; font-size: 12px;">
              Jeśli nie prosiłeś o reset hasła, zignoruj tę wiadomość.
            </p>
          </div>
        `,
      })
      return { success: true }
    } catch (emailError) {
      console.error('requestPasswordReset resend:', emailError)
      // Email nie wysłany — zwróć link bezpośrednio jako fallback
    }
  }

  // Brak Resend lub błąd wysyłki — zwróć link do wyświetlenia w UI
  return { resetLink }
}
