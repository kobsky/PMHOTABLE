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

// Generyczny komunikat — taki sam niezależnie od tego, czy konto istnieje
// (ochrona przed enumeracją kont).
const GENERIC_RESET_MESSAGE =
  'Jeśli konto z tym adresem istnieje, wysłaliśmy na nie link do resetu hasła.'

// Escapowanie wartości wstawianych do HTML maila (ochrona przed iniekcją).
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

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

// Zawsze zwraca generyczny komunikat sukcesu (ochrona przed enumeracją kont).
// { message } — generyczny komunikat (sukces) niezależnie od istnienia konta.
// { resetLink } — TYLKO w trybie development (do wyświetlenia w UI/dev).
// { error } — wyłącznie błąd walidacji wejścia lub konfiguracji.
export async function requestPasswordReset(
  input: z.infer<typeof RequestResetSchema>
): Promise<{ message: string } | { resetLink: string } | { error: string }> {
  const parsed = RequestResetSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const isDev = process.env.NODE_ENV === 'development'

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return { error: 'Brak konfiguracji Supabase' }

  // W produkcji nie ufamy nagłówkowi Host (host-header injection) —
  // wymagamy jawnie skonfigurowanego NEXT_PUBLIC_APP_URL.
  let baseUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!baseUrl) {
    if (!isDev) {
      console.error('requestPasswordReset: brak NEXT_PUBLIC_APP_URL w produkcji')
      return { error: 'Brak konfiguracji adresu aplikacji' }
    }
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
    // Konto nie istnieje (lub inny błąd generowania) — NIE ujawniamy tego
    // wywołującemu; zwracamy ten sam generyczny komunikat co przy sukcesie.
    console.error('requestPasswordReset generateLink:', error?.message)
    return { message: GENERIC_RESET_MESSAGE }
  }

  // Link kieruje bezpośrednio do naszego callbacku z token_hash —
  // omija Supabase verify endpoint i jego sprawdzanie whitelisty.
  const resetLink = `${baseUrl}/auth/callback?token_hash=${data.properties.hashed_token}&type=recovery&next=/reset-password`
  const safeResetLink = escapeHtml(resetLink)

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
            <a href="${safeResetLink}"
               style="display:inline-block;background:#E8622A;color:#fff;padding:10px 20px;
                      border-radius:4px;text-decoration:none;font-weight:600;margin:16px 0;">
              Ustaw nowe hasło
            </a>
            <p style="color: #7A766E; font-size: 12px;">
              Lub skopiuj ten link:<br>${safeResetLink}
            </p>
            <p style="color: #7A766E; font-size: 12px;">
              Jeśli nie prosiłeś o reset hasła, zignoruj tę wiadomość.
            </p>
          </div>
        `,
      })
      return { message: GENERIC_RESET_MESSAGE }
    } catch (emailError) {
      console.error('requestPasswordReset resend:', emailError)
      // Email nie wysłany — w produkcji NIE ujawniamy linku (zawiera żywy token).
    }
  }

  // Brak Resend lub błąd wysyłki:
  // - w dev zwracamy link do wyświetlenia w UI (wygoda lokalna),
  // - w produkcji NIGDY nie zwracamy tokenu/linku — generyczny komunikat.
  if (isDev) {
    return { resetLink }
  }
  return { message: GENERIC_RESET_MESSAGE }
}
