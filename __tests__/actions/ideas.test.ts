import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ getAuthenticatedClient: vi.fn() }))

import { getAuthenticatedClient } from '@/lib/supabase/server'
import {
  getIdeas,
  createIdea,
  updateIdeaStatus,
  promoteIdeaToTask,
} from '@/app/actions/ideas'

// ---------------------------------------------------------------------------
// Chain mock
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

function mockAuth(sb?: ReturnType<typeof makeSupabase>) {
  const supabase = sb ?? makeSupabase()
  vi.mocked(getAuthenticatedClient).mockResolvedValue({
    supabase: supabase as never,
    userId: 'user-1',
  })
  return supabase
}

function mockNoAuth() {
  vi.mocked(getAuthenticatedClient).mockResolvedValue(null)
}

// ---------------------------------------------------------------------------
// getIdeas
// ---------------------------------------------------------------------------
describe('getIdeas', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns mock ideas when unauthenticated', async () => {
    mockNoAuth()
    const ideas = await getIdeas()
    expect(Array.isArray(ideas)).toBe(true)
    expect(ideas.length).toBeGreaterThan(0)
  })

  it('returns empty array when authenticated and DB returns empty', async () => {
    // Mock fallback only applies when unauthenticated; an authenticated read of an
    // empty ideas table correctly yields [].
    mockAuth(makeSupabase({ data: [], error: null }))
    const ideas = await getIdeas()
    expect(ideas).toEqual([])
  })

  it('returns empty array on error', async () => {
    mockAuth(makeSupabase({ error: { message: 'fail' } }))
    const ideas = await getIdeas()
    expect(ideas).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// createIdea
// ---------------------------------------------------------------------------
describe('createIdea', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns auth error when unauthenticated', async () => {
    mockNoAuth()
    const result = await createIdea({
      title: 'Test idea',
      iceImpact: 5,
      iceConfidence: 5,
      iceEase: 5,
    })
    expect(result).toEqual({ error: 'Brak autoryzacji' })
  })

  it('rejects empty title', async () => {
    mockAuth()
    const result = await createIdea({
      title: '',
      iceImpact: 5,
      iceConfidence: 5,
      iceEase: 5,
    })
    expect(result.error).not.toBeNull()
  })

  it('rejects ICE score below 1', async () => {
    mockAuth()
    const result = await createIdea({
      title: 'Test',
      iceImpact: 0,
      iceConfidence: 5,
      iceEase: 5,
    })
    expect(result.error).not.toBeNull()
  })

  it('rejects ICE score above 10', async () => {
    mockAuth()
    const result = await createIdea({
      title: 'Test',
      iceImpact: 11,
      iceConfidence: 5,
      iceEase: 5,
    })
    expect(result.error).not.toBeNull()
  })

  it('succeeds with valid input', async () => {
    mockAuth(makeSupabase({ error: null }))
    const result = await createIdea({
      title: 'Great idea',
      iceImpact: 8,
      iceConfidence: 7,
      iceEase: 6,
    })
    expect(result.error).toBeNull()
  })

  it('returns Supabase error on insert failure', async () => {
    mockAuth(makeSupabase({ error: { message: 'unique violation' } }))
    const result = await createIdea({
      title: 'Idea',
      iceImpact: 5,
      iceConfidence: 5,
      iceEase: 5,
    })
    expect(result.error).toBe('unique violation')
  })
})

// ---------------------------------------------------------------------------
// updateIdeaStatus
// ---------------------------------------------------------------------------
describe('updateIdeaStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns auth error when unauthenticated', async () => {
    mockNoAuth()
    expect(await updateIdeaStatus('idea-1', 'accepted')).toEqual({ error: 'Brak autoryzacji' })
  })

  it('succeeds on valid status update', async () => {
    mockAuth(makeSupabase({ error: null }))
    const result = await updateIdeaStatus('idea-1', 'accepted')
    expect(result.error).toBeNull()
  })

  it('passes rejection reason when rejecting', async () => {
    const sb = makeSupabase({ error: null })
    mockAuth(sb)
    await updateIdeaStatus('idea-1', 'rejected', 'Nie w zakresie MVP')
    const chain = sb.from.mock.results[0].value as ReturnType<typeof makeChain>
    expect((chain.update as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'rejected',
        rejection_reason: 'Nie w zakresie MVP',
      })
    )
  })

  it('rejects status=rejected without a rejection reason (LOG-009)', async () => {
    const sb = makeSupabase({ error: null })
    mockAuth(sb)
    const result = await updateIdeaStatus('idea-1', 'rejected')
    expect(result.error).toBe('Powód odrzucenia jest wymagany przy odrzuceniu pomysłu')
    // Validation fails before any DB write is attempted.
    expect(sb.from).not.toHaveBeenCalled()
  })

  it('rejects status=rejected with a blank rejection reason (LOG-009)', async () => {
    const sb = makeSupabase({ error: null })
    mockAuth(sb)
    const result = await updateIdeaStatus('idea-1', 'rejected', '   ')
    expect(result.error).not.toBeNull()
    expect(sb.from).not.toHaveBeenCalled()
  })

  it('returns error on Supabase failure', async () => {
    mockAuth(makeSupabase({ error: { message: 'update failed' } }))
    const result = await updateIdeaStatus('idea-1', 'accepted')
    expect(result.error).toBe('update failed')
  })
})

// ---------------------------------------------------------------------------
// promoteIdeaToTask
// ---------------------------------------------------------------------------
describe('promoteIdeaToTask', () => {
  beforeEach(() => vi.clearAllMocks())

  // Valid v4 UUIDs (version nibble 4, variant nibble 8) — PromoteIdeaSchema
  // requires uuid() for ideaId and projectId; Zod v4 enforces the RFC variant.
  const IDEA_ID = '11111111-1111-4111-8111-111111111111'
  const PROJECT_ID = '22222222-2222-4222-8222-222222222222'

  it('returns auth error when unauthenticated', async () => {
    mockNoAuth()
    const result = await promoteIdeaToTask(IDEA_ID, {
      title: 'Promoted task',
      projectId: PROJECT_ID,
    })
    expect(result).toEqual({ error: 'Brak autoryzacji' })
  })

  it('rejects a non-uuid idea/project id (validation before DB)', async () => {
    const sb = makeSupabase()
    mockAuth(sb)
    const result = await promoteIdeaToTask('idea-1', {
      title: 'Task',
      projectId: 'proj-1',
    })
    expect(result.error).not.toBeNull()
    expect(sb.rpc).not.toHaveBeenCalled()
  })

  it('calls promote_idea_to_task RPC with the FK-setting args (LOG-005)', async () => {
    const sb = makeSupabase({ data: 'new-task-id', error: null })
    mockAuth(sb)
    const result = await promoteIdeaToTask(IDEA_ID, {
      title: 'Task',
      projectId: PROJECT_ID,
      priority: 'high',
    })
    expect(result.error).toBeNull()
    // The atomic RPC sets promoted_to_task_id + status='converted' server-side.
    expect(sb.rpc).toHaveBeenCalledWith('promote_idea_to_task', {
      p_idea_id: IDEA_ID,
      p_title: 'Task',
      p_project_id: PROJECT_ID,
      p_priority: 'high',
      p_assignee_id: 'user-1',
    })
  })

  it('defaults priority to medium when omitted', async () => {
    const sb = makeSupabase({ data: 'new-task-id', error: null })
    mockAuth(sb)
    await promoteIdeaToTask(IDEA_ID, { title: 'Task', projectId: PROJECT_ID })
    expect(sb.rpc).toHaveBeenCalledWith(
      'promote_idea_to_task',
      expect.objectContaining({ p_priority: 'medium' })
    )
  })

  it('surfaces the RPC error', async () => {
    const sb = makeSupabase({ data: null, error: { message: 'rpc failed' } })
    mockAuth(sb)
    const result = await promoteIdeaToTask(IDEA_ID, {
      title: 'Task',
      projectId: PROJECT_ID,
    })
    expect(result.error).toBe('rpc failed')
  })

  it('returns a friendly error when the idea is missing or already converted', async () => {
    // RPC returns null id → idea did not exist or was already promoted.
    const sb = makeSupabase({ data: null, error: null })
    mockAuth(sb)
    const result = await promoteIdeaToTask(IDEA_ID, {
      title: 'Task',
      projectId: PROJECT_ID,
    })
    expect(result.error).toBe('Pomysł nie istnieje lub został już przeniesiony do zadania')
  })
})
