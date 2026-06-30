import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// STRUKT-002 / PERF-002 — getProjects has a SINGLE source.
//
// The perf dedup removed the second (uncached) getProjects from tasks.ts; the
// only getProjects now lives in projects.ts wrapped in react.cache(). These
// tests guard against the duplicate being reintroduced (which caused the real
// double SELECT on /backlog) and confirm the cached source still behaves.
// ---------------------------------------------------------------------------

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ getAuthenticatedClient: vi.fn() }))

import { getAuthenticatedClient } from '@/lib/supabase/server'
import * as projectsActions from '@/app/actions/projects'
import * as tasksActions from '@/app/actions/tasks'
import { getProjects } from '@/app/actions/projects'

function makeChain(result: { data?: unknown; error?: unknown } = {}) {
  const r = { data: result.data ?? null, error: result.error ?? null }
  const chain: Record<string, unknown> = {
    then: (resolve: (v: typeof r) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(r).then(resolve, reject),
  }
  for (const m of ['select', 'eq', 'order']) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  return chain
}

function mockAuth(data: unknown) {
  const from = vi.fn().mockReturnValue(makeChain({ data }))
  vi.mocked(getAuthenticatedClient).mockResolvedValue({
    supabase: { from } as never,
    userId: 'user-1',
  })
  return from
}

function mockNoAuth() {
  vi.mocked(getAuthenticatedClient).mockResolvedValue(null)
}

describe('getProjects — single cached source (STRUKT-002 / PERF-002)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('is exported from projects.ts only — NOT duplicated in tasks.ts', () => {
    expect(typeof projectsActions.getProjects).toBe('function')
    // The uncached duplicate that lived in tasks.ts must stay removed.
    expect('getProjects' in tasksActions).toBe(false)
  })

  it('returns mock projects when unauthenticated', async () => {
    mockNoAuth()
    const projects = await getProjects()
    expect(Array.isArray(projects)).toBe(true)
    expect(projects.length).toBeGreaterThan(0)
  })

  it('queries the projects table once per authenticated call', async () => {
    const from = mockAuth([{ id: 'proj-1', name: 'Compass' }])
    const projects = await getProjects()
    expect(from).toHaveBeenCalledWith('projects')
    expect(from).toHaveBeenCalledTimes(1)
    expect(projects).toEqual([{ id: 'proj-1', name: 'Compass' }])
  })
})
