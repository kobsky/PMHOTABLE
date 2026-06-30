import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// U3 (assignee recommender) + U4 (workload balancing) — DECISION SUPPORT.
//
// These tests assert BEHAVIOUR only, never "effectiveness":
//   - getAssigneeRecommendation is DETERMINISTIC (same inputs → same ranking),
//     returns sub-scores + a load Gini, and makes NO network/LLM call beyond the
//     two Supabase reads we mock here (no Anthropic / fetch).
//   - exploration weight lifts an under-loaded member as expected.
//   - getWorkloadSuggestions computes from passed-in data (no re-fetch) and
//     returns an imbalance indicator.
// ---------------------------------------------------------------------------

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ getAuthenticatedClient: vi.fn() }))

import { getAuthenticatedClient } from '@/lib/supabase/server'
import { getAssigneeRecommendation, getWorkloadSuggestions } from '@/app/actions/ai'

// ---------------------------------------------------------------------------
// Supabase mock: a thenable chain whose terminal value depends on the table.
// from('profiles') resolves the profiles dataset; from('tasks') resolves tasks.
// All chain methods return the same chain so any call order works.
// ---------------------------------------------------------------------------
function makeTableChain(result: { data?: unknown; error?: unknown }) {
  const r = { data: result.data ?? null, error: result.error ?? null }
  const chain: Record<string, unknown> = {
    then: (resolve: (v: typeof r) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(r).then(resolve, reject),
    catch: (reject: (e: unknown) => unknown) => Promise.resolve(r).catch(reject),
  }
  for (const m of ['select', 'eq', 'neq', 'is', 'not', 'in', 'order', 'limit']) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  return chain
}

function mockAuthWith(tables: Record<string, { data?: unknown; error?: unknown }>) {
  const from = vi.fn((table: string) => makeTableChain(tables[table] ?? { data: [] }))
  vi.mocked(getAuthenticatedClient).mockResolvedValue({
    supabase: { from } as never,
    userId: 'user-test',
  })
  return from
}

function mockNoAuth() {
  vi.mocked(getAuthenticatedClient).mockResolvedValue(null)
}

// ---------------------------------------------------------------------------
// getAssigneeRecommendation — U3
// ---------------------------------------------------------------------------
describe('getAssigneeRecommendation (U3)', () => {
  beforeEach(() => vi.clearAllMocks())

  const profiles = [
    { id: 'p1', full_name: 'Ada Dev', email: 'ada@x.io', role: ['developer'], skills: ['frontend', 'react'] },
    { id: 'p2', full_name: 'Bo Design', email: 'bo@x.io', role: ['designer'], skills: ['figma', 'design'] },
    { id: 'p3', full_name: 'Cy Ops', email: 'cy@x.io', role: ['ops'], skills: ['infra'] },
  ]

  // p1 carries a heavy active load and lots of same-type history;
  // p3 is idle with no history (the exploration target).
  const tasks = [
    { id: 't1', title: 'a', type: 'development', status: 'in_progress', assignee_id: 'p1' },
    { id: 't2', title: 'b', type: 'development', status: 'todo', assignee_id: 'p1' },
    { id: 't3', title: 'c', type: 'development', status: 'in_review', assignee_id: 'p1' },
    { id: 't4', title: 'd', type: 'development', status: 'done', assignee_id: 'p1' },
    { id: 't5', title: 'e', type: 'design', status: 'todo', assignee_id: 'p2' },
  ]

  it('returns empty result (no throw) when unauthenticated', async () => {
    mockNoAuth()
    const res = await getAssigneeRecommendation('Build a feature', null, 'task-1')
    expect(res.suggestions).toEqual([])
    expect(res.cacheKey).toBe('task-1')
    expect(res.loadGini).toBe(0)
    expect(res.error).toBeNull()
  })

  it('is DETERMINISTIC — identical inputs yield identical rankings and scores', async () => {
    mockAuthWith({ profiles: { data: profiles }, tasks: { data: tasks } })
    const a = await getAssigneeRecommendation('Build a frontend react component', 'react work', 'task-9')
    mockAuthWith({ profiles: { data: profiles }, tasks: { data: tasks } })
    const b = await getAssigneeRecommendation('Build a frontend react component', 'react work', 'task-9')
    expect(a.suggestions).toEqual(b.suggestions)
    expect(a.loadGini).toBe(b.loadGini)
  })

  it('returns sub-scores in [0,1] and a total score in [0,1] for each suggestion', async () => {
    mockAuthWith({ profiles: { data: profiles }, tasks: { data: tasks } })
    const res = await getAssigneeRecommendation('Design a new figma mockup', null, null)
    expect(res.suggestions.length).toBeGreaterThan(0)
    for (const s of res.suggestions) {
      expect(s.score).toBeGreaterThanOrEqual(0)
      expect(s.score).toBeLessThanOrEqual(1)
      for (const key of ['skill', 'load', 'history', 'explore'] as const) {
        expect(s.subScores[key]).toBeGreaterThanOrEqual(0)
        expect(s.subScores[key]).toBeLessThanOrEqual(1)
      }
      expect(typeof s.reason).toBe('string')
    }
  })

  it('returns a non-null cacheKey equal to the passed taskId', async () => {
    mockAuthWith({ profiles: { data: profiles }, tasks: { data: tasks } })
    const res = await getAssigneeRecommendation('Anything', null, 'cache-me')
    expect(res.cacheKey).toBe('cache-me')
  })

  it('reports a positive load Gini when load is concentrated on one member', async () => {
    mockAuthWith({ profiles: { data: profiles }, tasks: { data: tasks } })
    const res = await getAssigneeRecommendation('Some task', null, null)
    // p1 holds 3 active, p2 holds 1, p3 holds 0 → not even → Gini > 0.
    expect(res.loadGini).toBeGreaterThan(0)
  })

  it('makes NO network/LLM call — only the two mocked Supabase reads', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('no network allowed'))
    const from = mockAuthWith({ profiles: { data: profiles }, tasks: { data: tasks } })
    const res = await getAssigneeRecommendation('Build a feature', null, null)
    expect(fetchSpy).not.toHaveBeenCalled()
    // exactly the two table reads (profiles + tasks), no extra round-trips.
    expect(from).toHaveBeenCalledWith('profiles')
    expect(from).toHaveBeenCalledWith('tasks')
    expect(res.error).toBeNull()
    fetchSpy.mockRestore()
  })

  it('exploration weight surfaces an under-loaded, no-history member among the top suggestions', async () => {
    // For a task type nobody has history in ("outreach"), the idle p3 should not
    // be buried by the overloaded, experienced p1: exploration + inverse-load lift it.
    mockAuthWith({ profiles: { data: profiles }, tasks: { data: tasks } })
    const res = await getAssigneeRecommendation('Cold outreach to leads', null, null)
    const ids = res.suggestions.map((s) => s.assignee_id)
    expect(ids).toContain('p3')
    // And the idle member must out-rank the overloaded, history-heavy p1.
    const p3 = res.suggestions.find((s) => s.assignee_id === 'p3')!
    const p1 = res.suggestions.find((s) => s.assignee_id === 'p1')
    if (p1) expect(p3.score).toBeGreaterThan(p1.score)
    // Idle member's load + explore sub-scores should be maxed out.
    expect(p3.subScores.load).toBe(1)
  })

  it('returns empty (no throw) when there are no profiles', async () => {
    mockAuthWith({ profiles: { data: [] }, tasks: { data: tasks } })
    const res = await getAssigneeRecommendation('x', null, null)
    expect(res.suggestions).toEqual([])
    expect(res.error).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// getWorkloadSuggestions — U4
// ---------------------------------------------------------------------------
describe('getWorkloadSuggestions (U4)', () => {
  beforeEach(() => vi.clearAllMocks())

  const profiles = [
    { id: 'p1', full_name: 'Heavy', email: 'h@x.io' },
    { id: 'p2', full_name: 'Light', email: 'l@x.io' },
  ]

  it('computes from passed-in data WITHOUT re-fetching (no auth round-trip)', async () => {
    const tasks = [
      { id: 't1', title: 'A', status: 'todo', assignee_id: 'p1', parent_task_id: null, deleted_at: null },
      { id: 't2', title: 'B', status: 'in_progress', assignee_id: 'p1', parent_task_id: null, deleted_at: null },
      { id: 't3', title: 'C', status: 'todo', assignee_id: 'p1', parent_task_id: null, deleted_at: null },
    ]
    const res = await getWorkloadSuggestions(profiles, tasks)
    // The function must NOT have called the Supabase client (PERF-004).
    expect(getAuthenticatedClient).not.toHaveBeenCalled()
    expect(res.error).toBeNull()
    expect(res.loadMap['p1'].active).toBe(3)
    expect(res.loadMap['p1'].inProgress).toBe(1)
    expect(res.loadMap['p2'].active).toBe(0)
  })

  it('suggests moving a (preferably todo) task from the most- to the least-loaded member', async () => {
    const tasks = [
      { id: 't1', title: 'Todo one', status: 'todo', assignee_id: 'p1', parent_task_id: null, deleted_at: null },
      { id: 't2', title: 'In prog', status: 'in_progress', assignee_id: 'p1', parent_task_id: null, deleted_at: null },
      { id: 't3', title: 'Todo two', status: 'todo', assignee_id: 'p1', parent_task_id: null, deleted_at: null },
    ]
    const res = await getWorkloadSuggestions(profiles, tasks)
    expect(res.suggestions.length).toBeGreaterThanOrEqual(1)
    const s = res.suggestions[0]
    expect(s.fromUserId).toBe('p1')
    expect(s.toUserId).toBe('p2')
    // Prefers a todo task over the in_progress one.
    expect(['t1', 't3']).toContain(s.taskId)
  })

  it('produces no suggestions when load difference is below the threshold of 2', async () => {
    const tasks = [
      { id: 't1', title: 'A', status: 'todo', assignee_id: 'p1', parent_task_id: null, deleted_at: null },
      { id: 't2', title: 'B', status: 'todo', assignee_id: 'p2', parent_task_id: null, deleted_at: null },
    ]
    const res = await getWorkloadSuggestions(profiles, tasks)
    // 1 vs 1 → diff 0 < 2 → no move.
    expect(res.suggestions).toEqual([])
  })

  it('ignores subtasks, deleted, and done/cancelled tasks when counting load', async () => {
    const tasks = [
      { id: 't1', title: 'sub', status: 'todo', assignee_id: 'p1', parent_task_id: 'parent', deleted_at: null },
      { id: 't2', title: 'del', status: 'todo', assignee_id: 'p1', parent_task_id: null, deleted_at: '2026-01-01' },
      { id: 't3', title: 'done', status: 'done', assignee_id: 'p1', parent_task_id: null, deleted_at: null },
      { id: 't4', title: 'real', status: 'in_progress', assignee_id: 'p1', parent_task_id: null, deleted_at: null },
    ]
    const res = await getWorkloadSuggestions(profiles, tasks)
    expect(res.loadMap['p1'].active).toBe(1) // only t4 counts
  })

  it('returns an imbalance indicator (Gini + variance + spread) reflecting concentration', async () => {
    const tasks = [
      { id: 't1', title: 'A', status: 'todo', assignee_id: 'p1', parent_task_id: null, deleted_at: null },
      { id: 't2', title: 'B', status: 'todo', assignee_id: 'p1', parent_task_id: null, deleted_at: null },
      { id: 't3', title: 'C', status: 'todo', assignee_id: 'p1', parent_task_id: null, deleted_at: null },
    ]
    const res = await getWorkloadSuggestions(profiles, tasks)
    expect(res.imbalance.gini).toBeGreaterThan(0)
    expect(res.imbalance.variance).toBeGreaterThan(0)
    expect(res.imbalance.maxLoad).toBe(3)
    expect(res.imbalance.minLoad).toBe(0)
  })

  it('returns an even (zero) imbalance when load is perfectly balanced', async () => {
    const tasks = [
      { id: 't1', title: 'A', status: 'todo', assignee_id: 'p1', parent_task_id: null, deleted_at: null },
      { id: 't2', title: 'B', status: 'todo', assignee_id: 'p2', parent_task_id: null, deleted_at: null },
    ]
    const res = await getWorkloadSuggestions(profiles, tasks)
    expect(res.imbalance.gini).toBe(0)
    expect(res.imbalance.variance).toBe(0)
    expect(res.suggestions).toEqual([])
  })

  it('returns an empty result for an empty team', async () => {
    const res = await getWorkloadSuggestions([], [])
    expect(res.suggestions).toEqual([])
    expect(res.loadMap).toEqual({})
    expect(res.imbalance).toEqual({ gini: 0, variance: 0, maxLoad: 0, minLoad: 0 })
    expect(res.error).toBeNull()
  })
})
