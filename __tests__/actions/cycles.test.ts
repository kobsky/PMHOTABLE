import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ getAuthenticatedClient: vi.fn() }))

import { getAuthenticatedClient } from '@/lib/supabase/server'
import {
  getActiveCycle,
  getAllCycles,
  createCycle,
  updateCycle,
  activateCycle,
  deleteCycle,
} from '@/app/actions/cycles'

// ---------------------------------------------------------------------------
// Chain mock helper
// ---------------------------------------------------------------------------
function makeChain(result: { data?: unknown; error?: unknown } = {}) {
  const r = { data: result.data ?? null, error: result.error ?? null }
  const chain: Record<string, unknown> = {
    then: (resolve: (v: typeof r) => void, reject: (e: unknown) => void) =>
      Promise.resolve(r).then(resolve, reject),
    single: vi.fn().mockResolvedValue(r),
    maybeSingle: vi.fn().mockResolvedValue(r),
  }
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'is', 'not', 'in', 'order', 'limit']) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  return chain
}

function makeSupabase(result: { data?: unknown; error?: unknown } = {}) {
  return { from: vi.fn().mockReturnValue(makeChain(result)) }
}

function mockAuth(supabase?: ReturnType<typeof makeSupabase>) {
  const sb = supabase ?? makeSupabase()
  vi.mocked(getAuthenticatedClient).mockResolvedValue({
    supabase: sb as never,
    userId: 'user-1',
  })
  return sb
}

function mockNoAuth() {
  vi.mocked(getAuthenticatedClient).mockResolvedValue(null)
}

// ---------------------------------------------------------------------------
// getActiveCycle
// ---------------------------------------------------------------------------
describe('getActiveCycle', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns MOCK_CYCLE when unauthenticated', async () => {
    mockNoAuth()
    const cycle = await getActiveCycle()
    expect(cycle).not.toBeNull()
  })

  it('returns null when authenticated and DB has no active cycle', async () => {
    // Mock fallback only applies when unauthenticated; an authenticated read of an
    // empty cycles table correctly yields null (you don't show fake data to a real user).
    const chain = makeChain({ data: null, error: null })
    mockAuth({ from: vi.fn().mockReturnValue(chain) } as never)
    const cycle = await getActiveCycle()
    expect(cycle).toBeNull()
  })

  it('returns null on error', async () => {
    const chain = makeChain({ data: null, error: { message: 'fail' } })
    mockAuth({ from: vi.fn().mockReturnValue(chain) } as never)
    const cycle = await getActiveCycle()
    expect(cycle).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// getAllCycles
// ---------------------------------------------------------------------------
describe('getAllCycles', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns mock cycles when unauthenticated', async () => {
    mockNoAuth()
    const cycles = await getAllCycles()
    expect(Array.isArray(cycles)).toBe(true)
    expect(cycles.length).toBeGreaterThan(0)
  })

  it('returns empty array on error', async () => {
    mockAuth(makeSupabase({ error: { message: 'fail' } }))
    const cycles = await getAllCycles()
    expect(cycles).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// createCycle — Zod validation
// ---------------------------------------------------------------------------
describe('createCycle', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns auth error when unauthenticated', async () => {
    mockNoAuth()
    const result = await createCycle({
      name: 'Sprint 1',
      start_date: '2026-04-20',
      end_date: '2026-05-03',
    })
    expect(result.error).toBe('Brak autoryzacji')
  })

  it('rejects empty name', async () => {
    mockAuth()
    const result = await createCycle({
      name: '',
      start_date: '2026-04-20',
      end_date: '2026-05-03',
    })
    expect(result.error).not.toBeNull()
  })

  it('rejects when end_date <= start_date', async () => {
    mockAuth()
    const result = await createCycle({
      name: 'Sprint',
      start_date: '2026-05-03',
      end_date: '2026-04-20',
    })
    expect(result.error).toContain('Data końca')
  })

  it('rejects invalid date format', async () => {
    mockAuth()
    const result = await createCycle({
      name: 'Sprint',
      start_date: '20-04-2026',
      end_date: '2026-05-03',
    })
    expect(result.error).not.toBeNull()
  })

  it('rejects negative velocity_planned', async () => {
    mockAuth()
    const result = await createCycle({
      name: 'Sprint',
      start_date: '2026-04-20',
      end_date: '2026-05-03',
      velocity_planned: -5,
    })
    expect(result.error).not.toBeNull()
  })

  it('succeeds with valid input and no active cycle', async () => {
    // First call: check for existing active cycle → none (maybeSingle returns null)
    // Second call: insert cycle
    const chain1 = makeChain({ data: null, error: null })
    const chain2 = makeChain({ data: { id: 'new-cycle', name: 'Sprint 1' }, error: null })
    let callCount = 0
    const sb = {
      from: vi.fn(() => {
        callCount++
        return callCount === 1 ? chain1 : chain2
      }),
    }
    mockAuth(sb as never)

    const result = await createCycle({
      name: 'Sprint 1',
      start_date: '2026-04-20',
      end_date: '2026-05-03',
    })
    expect(result.error).toBeNull()
  })

  it('returns Supabase error message on insert failure', async () => {
    const chain1 = makeChain({ data: null, error: null })
    const chain2 = makeChain({ data: null, error: { message: 'duplicate key' } })
    let callCount = 0
    const sb = {
      from: vi.fn(() => {
        callCount++
        return callCount === 1 ? chain1 : chain2
      }),
    }
    mockAuth(sb as never)

    const result = await createCycle({
      name: 'Sprint 1',
      start_date: '2026-04-20',
      end_date: '2026-05-03',
    })
    expect(result.error).toBe('duplicate key')
  })
})

// ---------------------------------------------------------------------------
// updateCycle — partial Zod validation
// ---------------------------------------------------------------------------
describe('updateCycle', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns auth error when unauthenticated', async () => {
    mockNoAuth()
    const result = await updateCycle('c1', { name: 'Updated' })
    expect(result.error).toBe('Brak autoryzacji')
  })

  it('rejects update where end_date <= start_date', async () => {
    mockAuth()
    const result = await updateCycle('c1', {
      start_date: '2026-05-10',
      end_date: '2026-05-01',
    })
    expect(result.error).not.toBeNull()
  })

  it('succeeds with valid patch', async () => {
    mockAuth(makeSupabase({ error: null }))
    const result = await updateCycle('c1', { name: 'Sprint Updated' })
    expect(result.error).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// activateCycle
// ---------------------------------------------------------------------------
describe('activateCycle', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns auth error when unauthenticated', async () => {
    mockNoAuth()
    expect((await activateCycle('c1')).error).toBe('Brak autoryzacji')
  })

  it('returns error on deactivate failure', async () => {
    const chain1 = makeChain({ error: { message: 'deactivate failed' } })
    const chain2 = makeChain({ error: null })
    let call = 0
    const sb = { from: vi.fn(() => (++call === 1 ? chain1 : chain2)) }
    mockAuth(sb as never)
    const result = await activateCycle('c1')
    expect(result.error).toBe('deactivate failed')
  })

  it('succeeds when both updates work', async () => {
    const chain = makeChain({ error: null })
    mockAuth({ from: vi.fn().mockReturnValue(chain) } as never)
    const result = await activateCycle('c1')
    expect(result.error).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// deleteCycle
// ---------------------------------------------------------------------------
describe('deleteCycle', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns auth error when unauthenticated', async () => {
    mockNoAuth()
    expect((await deleteCycle('c1')).error).toBe('Brak autoryzacji')
  })

  it('refuses to delete active cycle', async () => {
    const chain = makeChain({ data: { is_active: true }, error: null })
    mockAuth({ from: vi.fn().mockReturnValue(chain) } as never)
    const result = await deleteCycle('c1')
    expect(result.error).toMatch(/aktywnego sprintu/)
  })

  it('succeeds for an inactive cycle', async () => {
    const chain1 = makeChain({ data: { is_active: false }, error: null })
    const chain2 = makeChain({ error: null })
    let call = 0
    const sb = { from: vi.fn(() => (++call === 1 ? chain1 : chain2)) }
    mockAuth(sb as never)
    const result = await deleteCycle('c1')
    expect(result.error).toBeNull()
  })
})
