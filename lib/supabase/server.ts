import { createServerClient, type CookieMethodsServer } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

// Zwraca null jeśli brak kluczy (tryb dev bez Supabase)
export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) return null

  const cookieStore = await cookies()

  const cookieMethods: CookieMethodsServer = {
    getAll() {
      return cookieStore.getAll()
    },
    setAll(cookiesToSet) {
      try {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        )
      } catch {
        // Ignorowane w Server Components — obsługiwane przez middleware
      }
    },
  }

  return createServerClient(url, key, { cookies: cookieMethods })
}

// Zwraca klienta + userId tylko gdy użytkownik jest zalogowany.
// Gdy brak kluczy LUB brak sesji → null (fallback na mock we wszystkich actions).
export const getAuthenticatedClient = cache(async (): Promise<{
  supabase: SupabaseClient
  userId: string
} | null> => {
  const supabase = await createClient()
  if (!supabase) return null

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  return { supabase, userId: user.id }
})
