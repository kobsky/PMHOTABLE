'use server'

import { cache } from 'react'
import { getAuthenticatedClient } from '@/lib/supabase/server'
import type { DbUser } from '@/lib/supabase/types'
import { MOCK_USERS } from '@/lib/mock-data'

export const getProfiles = cache(async (): Promise<DbUser[]> => {
  const auth = await getAuthenticatedClient()
  if (!auth) return MOCK_USERS
  const { data, error } = await auth.supabase
    .from('profiles').select('*').order('full_name')
  if (error) { console.error('getProfiles:', error.message); return [] }
  return (data ?? []) as DbUser[]
})
