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
  addCycleLink,
  removeCycleLink,
  addUnavailableDate,
  removeUnavailableDate,
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
  return {
    from: vi.fn().mockReturnValue(makeChain(result)),
    rpc: vi.fn().mockResolvedValue({ data: result.data ?? null, error: result.error ?? null }),
  }
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

  it('includes tolerance_percent in the insert (LOG-011)', async () => {
    const chain1 = makeChain({ data: null, error: null })
    const chain2 = makeChain({ data: { id: 'new-cycle' }, error: null })
    let callCount = 0
    const sb = {
      from: vi.fn(() => {
        callCount++
        return callCount === 1 ? chain1 : chain2
      }),
    }
    mockAuth(sb as never)

    await createCycle({
      name: 'Sprint 1',
      start_date: '2026-04-20',
      end_date: '2026-05-03',
      tolerance_percent: 15,
    })

    expect((chain2.insert as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.objectContaining({ tolerance_percent: 15 })
    )
  })

  it('omits tolerance_percent when not provided (DB default applies)', async () => {
    const chain1 = makeChain({ data: null, error: null })
    const chain2 = makeChain({ data: { id: 'new-cycle' }, error: null })
    let callCount = 0
    const sb = {
      from: vi.fn(() => {
        callCount++
        return callCount === 1 ? chain1 : chain2
      }),
    }
    mockAuth(sb as never)

    await createCycle({
      name: 'Sprint 1',
      start_date: '2026-04-20',
      end_date: '2026-05-03',
    })

    const insertArg = (chain2.insert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(insertArg).not.toHaveProperty('tolerance_percent')
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

  it('calls the atomic activate_cycle RPC (LOG-003)', async () => {
    const sb = makeSupabase({ error: null })
    mockAuth(sb)
    const result = await activateCycle('c1')
    expect(result.error).toBeNull()
    // One transactional RPC, not two separate UPDATEs (no zero/two-active window).
    expect(sb.rpc).toHaveBeenCalledWith('activate_cycle', { p_cycle_id: 'c1' })
    expect(sb.from).not.toHaveBeenCalled()
  })

  it('surfaces the RPC error', async () => {
    const sb = makeSupabase({ error: { message: 'activate failed' } })
    mockAuth(sb)
    const result = await activateCycle('c1')
    expect(result.error).toBe('activate failed')
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

// ---------------------------------------------------------------------------
// JSONB mutations via atomic RPC (LOG-004) — no read-modify-write
// ---------------------------------------------------------------------------
describe('addCycleLink', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns auth error when unauthenticated', async () => {
    mockNoAuth()
    expect((await addCycleLink('c1', { title: 'PR', url: 'https://x', label: 'doc' })).error).toBe(
      'Brak autoryzacji'
    )
  })

  it('appends via add_cycle_link RPC (not read-modify-write)', async () => {
    const sb = makeSupabase({ error: null })
    mockAuth(sb)
    const result = await addCycleLink('c1', { title: 'PR', url: 'https://x', label: 'doc' })
    expect(result.error).toBeNull()
    expect(sb.from).not.toHaveBeenCalled()
    expect(sb.rpc).toHaveBeenCalledWith(
      'add_cycle_link',
      expect.objectContaining({
        p_cycle_id: 'c1',
        p_link: expect.objectContaining({ title: 'PR', url: 'https://x', label: 'doc' }),
      })
    )
  })

  it('surfaces the RPC error', async () => {
    const sb = makeSupabase({ error: { message: 'rpc boom' } })
    mockAuth(sb)
    expect((await addCycleLink('c1', { title: 'PR', url: 'https://x', label: 'doc' })).error).toBe(
      'rpc boom'
    )
  })
})

describe('removeCycleLink', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns auth error when unauthenticated', async () => {
    mockNoAuth()
    expect((await removeCycleLink('c1', 'link-1')).error).toBe('Brak autoryzacji')
  })

  it('removes via remove_cycle_link RPC', async () => {
    const sb = makeSupabase({ error: null })
    mockAuth(sb)
    const result = await removeCycleLink('c1', 'link-1')
    expect(result.error).toBeNull()
    expect(sb.from).not.toHaveBeenCalled()
    expect(sb.rpc).toHaveBeenCalledWith('remove_cycle_link', {
      p_cycle_id: 'c1',
      p_link_id: 'link-1',
    })
  })
})

describe('addUnavailableDate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns auth error when unauthenticated', async () => {
    mockNoAuth()
    expect((await addUnavailableDate('c1', 'u1', '2026-05-01', 'urlop')).error).toBe(
      'Brak autoryzacji'
    )
  })

  it('appends via add_unavailable_date RPC', async () => {
    const sb = makeSupabase({ error: null })
    mockAuth(sb)
    const result = await addUnavailableDate('c1', 'u1', '2026-05-01', 'urlop')
    expect(result.error).toBeNull()
    expect(sb.from).not.toHaveBeenCalled()
    expect(sb.rpc).toHaveBeenCalledWith('add_unavailable_date', {
      p_cycle_id: 'c1',
      p_user_id: 'u1',
      p_date: '2026-05-01',
      p_reason: 'urlop',
    })
  })
})

describe('removeUnavailableDate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns auth error when unauthenticated', async () => {
    mockNoAuth()
    expect((await removeUnavailableDate('c1', 'u1', '2026-05-01')).error).toBe('Brak autoryzacji')
  })

  it('removes via remove_unavailable_date RPC', async () => {
    const sb = makeSupabase({ error: null })
    mockAuth(sb)
    const result = await removeUnavailableDate('c1', 'u1', '2026-05-01')
    expect(result.error).toBeNull()
    expect(sb.from).not.toHaveBeenCalled()
    expect(sb.rpc).toHaveBeenCalledWith('remove_unavailable_date', {
      p_cycle_id: 'c1',
      p_user_id: 'u1',
      p_date: '2026-05-01',
    })
  })
})
