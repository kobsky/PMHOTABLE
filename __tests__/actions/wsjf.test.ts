import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// U5 — WSJF server-action wiring (decision support, deterministic, no LLM).
// Verifies validation on setWsjfInputs, auth guards, and that getWsjfRanking
// sorts by computeWsjf descending and drops tasks without a complete input set.
// Behaviour only — no "effectiveness".
// ---------------------------------------------------------------------------

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ getAuthenticatedClient: vi.fn() }))

import { getAuthenticatedClient } from '@/lib/supabase/server'
import { setWsjfInputs, getWsjfRanking } from '@/app/actions/wsjf'
import type { WsjfInputs } from '@/lib/wsjf'

function makeChain(result: { data?: unknown; error?: unknown } = {}) {
  const r = { data: result.data ?? null, error: result.error ?? null }
  const chain: Record<string, unknown> = {
    then: (resolve: (v: typeof r) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(r).then(resolve, reject),
    catch: (reject: (e: unknown) => unknown) => Promise.resolve(r).catch(reject),
  }
  for (const m of ['select', 'update', 'eq', 'neq', 'is', 'not', 'order', 'limit']) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  return chain
}

function makeSupabase(result: { data?: unknown; error?: unknown } = {}) {
  return { from: vi.fn().mockReturnValue(makeChain(result)) }
}

function mockAuth(sb: ReturnType<typeof makeSupabase>) {
  vi.mocked(getAuthenticatedClient).mockResolvedValue({ supabase: sb as never, userId: 'u1' })
  return sb
}

function mockNoAuth() {
  vi.mocked(getAuthenticatedClient).mockResolvedValue(null)
}

const VALID: WsjfInputs = { userValue: 8, timeCriticality: 5, riskReduction: 2, jobSize: 3 }

// ---------------------------------------------------------------------------
// setWsjfInputs
// ---------------------------------------------------------------------------
describe('setWsjfInputs (U5)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects off-scale inputs before touching auth/DB', async () => {
    const res = await setWsjfInputs('task-1', { ...VALID, userValue: 4 })
    expect(res.error).not.toBeNull()
    expect(getAuthenticatedClient).not.toHaveBeenCalled()
  })

  it('returns auth error when unauthenticated', async () => {
    mockNoAuth()
    const res = await setWsjfInputs('task-1', VALID)
    expect(res).toEqual({ error: 'Brak autoryzacji' })
  })

  it('persists the four inputs and returns { error: null } on success', async () => {
    const sb = makeSupabase({ error: null })
    mockAuth(sb)
    const res = await setWsjfInputs('task-1', VALID)
    expect(res.error).toBeNull()
    const chain = sb.from.mock.results[0].value as ReturnType<typeof makeChain>
    expect(chain.update as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
      expect.objectContaining({
        wsjf_user_value: 8,
        wsjf_time_criticality: 5,
        wsjf_risk_reduction: 2,
        wsjf_job_size: 3,
      }),
    )
  })

  it('passes the Supabase error message through', async () => {
    mockAuth(makeSupabase({ error: { message: 'update failed' } }))
    const res = await setWsjfInputs('task-1', VALID)
    expect(res.error).toBe('update failed')
  })
})

// ---------------------------------------------------------------------------
// getWsjfRanking
// ---------------------------------------------------------------------------
describe('getWsjfRanking (U5)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns [] when unauthenticated', async () => {
    mockNoAuth()
    expect(await getWsjfRanking()).toEqual([])
  })

  it('returns [] on Supabase error', async () => {
    mockAuth(makeSupabase({ error: { message: 'read failed' } }))
    expect(await getWsjfRanking()).toEqual([])
  })

  it('sorts tasks by WSJF descending and drops tasks without complete inputs', async () => {
    const data = [
      // WSJF = (3+2+1)/13 ≈ 0.46
      { id: 'low', wsjf_user_value: 3, wsjf_time_criticality: 2, wsjf_risk_reduction: 1, wsjf_job_size: 13 },
      // WSJF = (8+8+8)/2 = 12
      { id: 'high', wsjf_user_value: 8, wsjf_time_criticality: 8, wsjf_risk_reduction: 8, wsjf_job_size: 2 },
      // WSJF = (5+5+5)/5 = 3
      { id: 'mid', wsjf_user_value: 5, wsjf_time_criticality: 5, wsjf_risk_reduction: 5, wsjf_job_size: 5 },
      // incomplete → dropped
      { id: 'incomplete', wsjf_user_value: 8, wsjf_time_criticality: null, wsjf_risk_reduction: 2, wsjf_job_size: 3 },
    ]
    mockAuth(makeSupabase({ data }))
    const ranked = await getWsjfRanking()
    expect(ranked.map((r) => (r.task as { id: string }).id)).toEqual(['high', 'mid', 'low'])
    expect(ranked[0].wsjf).toBe(12)
    expect(ranked.find((r) => (r.task as { id: string }).id === 'incomplete')).toBeUndefined()
  })

  it('returns an empty list when no task has a complete WSJF input set', async () => {
    const data = [
      { id: 'a', wsjf_user_value: null, wsjf_time_criticality: null, wsjf_risk_reduction: null, wsjf_job_size: null },
    ]
    mockAuth(makeSupabase({ data }))
    expect(await getWsjfRanking()).toEqual([])
  })
})
