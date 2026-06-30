import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// U2 — getStoryPointSuggestion server-action wiring (decision support, no LLM).
// Verifies the query target, fallback shape, error pass-through, and that the
// median baseline from lib/estimation flows through. Behaviour only.
// ---------------------------------------------------------------------------

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ getAuthenticatedClient: vi.fn() }))

import { getAuthenticatedClient } from '@/lib/supabase/server'
import { getStoryPointSuggestion } from '@/app/actions/estimation'

function makeChain(result: { data?: unknown; error?: unknown } = {}) {
  const r = { data: result.data ?? null, error: result.error ?? null }
  const chain: Record<string, unknown> = {
    then: (resolve: (v: typeof r) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(r).then(resolve, reject),
    catch: (reject: (e: unknown) => unknown) => Promise.resolve(r).catch(reject),
  }
  for (const m of ['select', 'eq', 'is', 'not', 'limit']) {
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

describe('getStoryPointSuggestion (U2)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns a null suggestion (silent fallback) when unauthenticated', async () => {
    mockNoAuth()
    const res = await getStoryPointSuggestion('development', 'M')
    expect(res).toEqual({ suggestion: null, error: null })
  })

  it('queries the tasks table for completed history', async () => {
    const sb = makeSupabase({ data: [] })
    mockAuth(sb)
    await getStoryPointSuggestion('development', 'M')
    expect(sb.from).toHaveBeenCalledWith('tasks')
  })

  it('returns the bucket median suggestion built from history', async () => {
    const data = [
      { type: 'development', size: 'M', story_points: 3 },
      { type: 'development', size: 'M', story_points: 5 },
      { type: 'development', size: 'M', story_points: 5 },
    ]
    mockAuth(makeSupabase({ data }))
    const res = await getStoryPointSuggestion('development', 'M')
    expect(res.error).toBeNull()
    expect(res.suggestion).not.toBeNull()
    expect(res.suggestion!.basis).toBe('bucket')
    expect(res.suggestion!.points).toBe(5) // median of [3,5,5]
    expect(res.suggestion!.sampleSize).toBe(3)
  })

  it('falls back to the size default when there is no history', async () => {
    mockAuth(makeSupabase({ data: [] }))
    const res = await getStoryPointSuggestion('development', 'L')
    expect(res.suggestion!.basis).toBe('size_default')
    expect(res.suggestion!.points).toBe(5) // SIZE_TO_POINTS.L
  })

  it('passes the Supabase error message through', async () => {
    mockAuth(makeSupabase({ error: { message: 'history read failed' } }))
    const res = await getStoryPointSuggestion('development', 'M')
    expect(res.suggestion).toBeNull()
    expect(res.error).toBe('history read failed')
  })
})
