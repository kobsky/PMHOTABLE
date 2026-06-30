import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Module mocks (hoisted before imports)
// ---------------------------------------------------------------------------
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ getAuthenticatedClient: vi.fn() }))
vi.mock('@/lib/mock-data', async () => {
  const actual = await vi.importActual<typeof import('@/lib/mock-data')>('@/lib/mock-data')
  return actual
})

import { getAuthenticatedClient } from '@/lib/supabase/server'
import {
  createTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
  getMyTasks,
  getAllTasksWithRelations,
  createSubtask,
  bulkUpdateTasks,
  reorderColumn,
  reorderSubtasks,
  getDeletedTasks,
  restoreTask,
} from '@/app/actions/tasks'

// ---------------------------------------------------------------------------
// Helper: build a thenable Supabase query chain mock
// ---------------------------------------------------------------------------
function makeChain(result: { data?: unknown; error?: unknown; count?: number } = {}) {
  const r = {
    data: result.data ?? null,
    error: result.error ?? null,
    count: result.count ?? null,
  }
  const chain: Record<string, unknown> = {
    then: (resolve: (v: typeof r) => void, reject: (e: unknown) => void) =>
      Promise.resolve(r).then(resolve, reject),
    catch: (reject: (e: unknown) => void) => Promise.resolve(r).catch(reject),
    single: vi.fn().mockResolvedValue(r),
    maybeSingle: vi.fn().mockResolvedValue(r),
  }
  for (const m of ['select', 'insert', 'upsert', 'update', 'delete', 'eq', 'neq', 'is', 'not', 'in', 'filter', 'order', 'limit']) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  return chain
}

function makeSupabase(result: { data?: unknown; error?: unknown } = {}) {
  return { from: vi.fn().mockReturnValue(makeChain(result)) }
}

const TEST_USER_ID = 'user-123'

function mockAuth(supabase?: ReturnType<typeof makeSupabase>) {
  const sb = supabase ?? makeSupabase()
  vi.mocked(getAuthenticatedClient).mockResolvedValue({
    supabase: sb as never,
    userId: TEST_USER_ID,
  })
  return sb
}

function mockNoAuth() {
  vi.mocked(getAuthenticatedClient).mockResolvedValue(null)
}

// ---------------------------------------------------------------------------
// getMyTasks
// ---------------------------------------------------------------------------
describe('getMyTasks', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns mock data when unauthenticated', async () => {
    mockNoAuth()
    const tasks = await getMyTasks()
    expect(Array.isArray(tasks)).toBe(true)
    expect(tasks.length).toBeGreaterThan(0)
  })

  it('returns empty array on Supabase error', async () => {
    const sb = makeSupabase({ error: { message: 'DB error' } })
    mockAuth(sb)
    const tasks = await getMyTasks()
    expect(tasks).toEqual([])
  })

  it('queries the tasks table', async () => {
    const sb = makeSupabase({ data: [] })
    mockAuth(sb)
    await getMyTasks()
    expect(sb.from).toHaveBeenCalledWith('tasks')
  })
})

// ---------------------------------------------------------------------------
// getAllTasksWithRelations
// ---------------------------------------------------------------------------
describe('getAllTasksWithRelations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns mock data when unauthenticated', async () => {
    mockNoAuth()
    const tasks = await getAllTasksWithRelations()
    expect(Array.isArray(tasks)).toBe(true)
  })

  it('returns empty array on error', async () => {
    mockAuth(makeSupabase({ error: { message: 'fail' } }))
    const tasks = await getAllTasksWithRelations()
    expect(tasks).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// createTask
// ---------------------------------------------------------------------------
describe('createTask', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns auth error when unauthenticated', async () => {
    mockNoAuth()
    const result = await createTask({ title: 'Test', projectId: 'proj-1' })
    expect(result).toEqual({ error: 'Brak autoryzacji' })
  })

  it('returns { error: null } on successful insert', async () => {
    mockAuth(makeSupabase({ data: null, error: null }))
    const result = await createTask({ title: 'Test task', projectId: 'proj-abc' })
    expect(result.error).toBeNull()
  })

  it('returns error message on Supabase failure', async () => {
    mockAuth(makeSupabase({ error: { message: 'insert failed' } }))
    const result = await createTask({ title: 'Test', projectId: 'proj-1' })
    expect(result.error).toBe('insert failed')
  })

  it('rejects empty title', async () => {
    mockAuth()
    const result = await createTask({ title: '', projectId: 'proj-1' })
    expect(result.error).not.toBeNull()
  })

  it('rejects title that is too long (>200 chars)', async () => {
    mockAuth()
    const result = await createTask({ title: 'x'.repeat(201), projectId: 'proj-1' })
    expect(result.error).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// updateTask
// ---------------------------------------------------------------------------
describe('updateTask', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns auth error when unauthenticated', async () => {
    mockNoAuth()
    const result = await updateTask('task-1', { title: 'Updated' })
    expect(result).toEqual({ error: 'Brak autoryzacji' })
  })

  it('returns { error: null } on successful update', async () => {
    mockAuth(makeSupabase({ error: null }))
    const result = await updateTask('task-1', { title: 'Updated title' })
    expect(result.error).toBeNull()
  })

  it('returns error on Supabase failure', async () => {
    mockAuth(makeSupabase({ error: { message: 'update failed' } }))
    const result = await updateTask('task-1', { title: 'x' })
    expect(result.error).toBe('update failed')
  })
})

// ---------------------------------------------------------------------------
// updateTaskStatus
// ---------------------------------------------------------------------------
describe('updateTaskStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns auth error when unauthenticated', async () => {
    mockNoAuth()
    expect(await updateTaskStatus('task-1', 'done')).toEqual({ error: 'Brak autoryzacji' })
  })

  it('returns { error: null } on success', async () => {
    mockAuth(makeSupabase({ error: null }))
    expect((await updateTaskStatus('t1', 'in_progress')).error).toBeNull()
  })

  it('returns error on failure', async () => {
    mockAuth(makeSupabase({ error: { message: 'status update failed' } }))
    expect((await updateTaskStatus('t1', 'done')).error).toBe('status update failed')
  })
})

// ---------------------------------------------------------------------------
// deleteTask (soft delete)
// ---------------------------------------------------------------------------
describe('deleteTask', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns auth error when unauthenticated', async () => {
    mockNoAuth()
    expect(await deleteTask('task-1')).toEqual({ error: 'Brak autoryzacji' })
  })

  it('soft-deletes (uses update not delete)', async () => {
    const sb = makeSupabase({ error: null })
    mockAuth(sb)
    await deleteTask('task-1')
    const chain = sb.from.mock.results[0].value as ReturnType<typeof makeChain>
    // Should call .update (soft delete) with deleted_at
    expect((chain.update as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.objectContaining({ deleted_at: expect.any(String) })
    )
  })

  it('returns error on failure', async () => {
    mockAuth(makeSupabase({ error: { message: 'delete failed' } }))
    expect((await deleteTask('t1')).error).toBe('delete failed')
  })
})

// ---------------------------------------------------------------------------
// createSubtask
// ---------------------------------------------------------------------------
describe('createSubtask', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns mock id when unauthenticated', async () => {
    mockNoAuth()
    const result = await createSubtask('parent-1', 'Sub task', 'proj-1')
    expect(result.error).toBeNull()
    expect(result.id).toMatch(/^mock-/)
  })

  it('returns the created id on success', async () => {
    const chain = makeChain({ data: { id: 'new-sub-id' }, error: null })
    const sb = { from: vi.fn().mockReturnValue(chain) }
    mockAuth(sb as never)
    const result = await createSubtask('parent-1', 'Sub', 'proj-1')
    expect(result.error).toBeNull()
    // id comes from .single() result
  })

  it('returns error on failure', async () => {
    const chain = makeChain({ data: null, error: { message: 'subtask failed' } })
    const sb = { from: vi.fn().mockReturnValue(chain) }
    mockAuth(sb as never)
    const result = await createSubtask('parent-1', 'Sub', 'proj-1')
    expect(result.error).toBe('subtask failed')
  })
})

// ---------------------------------------------------------------------------
// bulkUpdateTasks
// ---------------------------------------------------------------------------
describe('bulkUpdateTasks', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns { error: null } for empty array without querying', async () => {
    mockAuth()
    const result = await bulkUpdateTasks([], { status: 'done' })
    expect(result).toEqual({ error: null })
  })

  it('returns auth error when unauthenticated', async () => {
    mockNoAuth()
    expect(await bulkUpdateTasks(['t1'], { status: 'done' })).toEqual({ error: 'Brak autoryzacji' })
  })
})

// ---------------------------------------------------------------------------
// reorderColumn (PERF-008) — single batch upsert, auth-guarded
// ---------------------------------------------------------------------------
describe('reorderColumn', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns { error: null } for empty array without querying', async () => {
    const sb = makeSupabase({ error: null })
    mockAuth(sb)
    expect(await reorderColumn([])).toEqual({ error: null })
    expect(sb.from).not.toHaveBeenCalled()
  })

  it('returns auth error when unauthenticated', async () => {
    mockNoAuth()
    expect(await reorderColumn(['t1', 't2'])).toEqual({ error: 'Brak autoryzacji' })
  })

  it('persists order in ONE batch upsert with position 0..n', async () => {
    const sb = makeSupabase({ error: null })
    mockAuth(sb)
    const result = await reorderColumn(['t2', 't0', 't1'])
    expect(result.error).toBeNull()
    const chain = sb.from.mock.results[0].value as ReturnType<typeof makeChain>
    const upsert = chain.upsert as ReturnType<typeof vi.fn>
    // Exactly one batch call, not N separate updates.
    expect(upsert).toHaveBeenCalledTimes(1)
    expect(upsert).toHaveBeenCalledWith([
      { id: 't2', position: 0 },
      { id: 't0', position: 1 },
      { id: 't1', position: 2 },
    ])
  })

  it('returns error on Supabase failure', async () => {
    mockAuth(makeSupabase({ error: { message: 'reorder failed' } }))
    expect((await reorderColumn(['t1'])).error).toBe('reorder failed')
  })
})

// ---------------------------------------------------------------------------
// reorderSubtasks (LOG-006) — single batch upsert, auth-guarded
// ---------------------------------------------------------------------------
describe('reorderSubtasks', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns auth error when unauthenticated', async () => {
    mockNoAuth()
    expect(await reorderSubtasks('parent-1', ['s1', 's2'])).toEqual({ error: 'Brak autoryzacji' })
  })

  it('returns { error: null } for empty array without querying', async () => {
    const sb = makeSupabase({ error: null })
    mockAuth(sb)
    const result = await reorderSubtasks('parent-1', [])
    expect(result).toEqual({ error: null })
    expect(sb.from).not.toHaveBeenCalled()
  })

  it('persists order in ONE batch upsert with position 0..n', async () => {
    const sb = makeSupabase({ error: null })
    mockAuth(sb)
    const result = await reorderSubtasks('parent-1', ['s2', 's0', 's1'])
    expect(result.error).toBeNull()
    const chain = sb.from.mock.results[0].value as ReturnType<typeof makeChain>
    const upsert = chain.upsert as ReturnType<typeof vi.fn>
    // Exactly one batch call, not N separate updates.
    expect(upsert).toHaveBeenCalledTimes(1)
    expect(upsert).toHaveBeenCalledWith([
      { id: 's2', position: 0 },
      { id: 's0', position: 1 },
      { id: 's1', position: 2 },
    ])
  })

  it('returns error on Supabase failure', async () => {
    mockAuth(makeSupabase({ error: { message: 'reorder failed' } }))
    expect((await reorderSubtasks('parent-1', ['s1'])).error).toBe('reorder failed')
  })
})

// ---------------------------------------------------------------------------
// getDeletedTasks
// ---------------------------------------------------------------------------
describe('getDeletedTasks', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns empty array when unauthenticated', async () => {
    mockNoAuth()
    expect(await getDeletedTasks()).toEqual([])
  })

  it('returns empty array on error', async () => {
    mockAuth(makeSupabase({ error: { message: 'fail' } }))
    expect(await getDeletedTasks()).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// restoreTask
// ---------------------------------------------------------------------------
describe('restoreTask', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns auth error when unauthenticated', async () => {
    mockNoAuth()
    expect(await restoreTask('task-1')).toEqual({ error: 'Brak autoryzacji' })
  })

  it('restores by setting deleted_at to null', async () => {
    const sb = makeSupabase({ error: null })
    mockAuth(sb)
    await restoreTask('task-1')
    const chain = sb.from.mock.results[0].value as ReturnType<typeof makeChain>
    expect((chain.update as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith({ deleted_at: null })
  })
})
