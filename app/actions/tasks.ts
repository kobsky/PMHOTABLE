'use server'

import { z } from 'zod'
import { getAuthenticatedClient } from '@/lib/supabase/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import type { TaskStatus, TaskPriority, TaskType, TaskWithRelations, DbProject, TaskSize, RaciMatrix } from '@/lib/supabase/types'
import { getZone } from '@/lib/velocity/tolerance'
import { STORY_POINTS_LIMIT } from '@/lib/capacity'

const StoryPointsSchema = z.number().int().refine(
  (val) => [1, 2, 3, 5, 8, 13].includes(val),
  { message: 'Nieprawidłowa wartość story points (dozwolone: 1, 2, 3, 5, 8, 13)' }
)
import { MOCK_TASKS, MOCK_PROJECTS, enrichTask } from '@/lib/mock-data'

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const TaskStatusEnum = z.enum(['todo', 'in_progress', 'in_review', 'done', 'cancelled'])
const TaskPriorityEnum = z.enum(['low', 'medium', 'high', 'urgent'])
const TaskTypeEnum = z.enum(['research', 'development', 'outreach', 'design', 'marketing', 'support', 'ops'])

const CreateTaskSchema = z.object({
  title: z.string().min(1, 'Tytuł jest wymagany').max(200, 'Tytuł za długi (max 200 znaków)'),
  projectId: z.string().min(1, 'Projekt jest wymagany'),
  status: TaskStatusEnum.optional(),
  priority: TaskPriorityEnum.optional(),
  type: TaskTypeEnum.optional(),
  cycleId: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Nieprawidłowy format daty (YYYY-MM-DD)').nullable().optional(),
})

const CreateSubtaskSchema = z.object({
  parentId: z.string().min(1),
  title: z.string().min(1, 'Tytuł jest wymagany').max(200),
  projectId: z.string().min(1, 'Projekt jest wymagany'),
})

// Supabase join select — zwraca TaskWithRelations
const TASK_SELECT = `
  *,
  project:projects(*),
  assignee:profiles(*),
  subtasks:tasks!parent_task_id(*)
`

// ---------------------------------------------------------------------------
// QUERIES — fallback na mock gdy brak auth lub brak kluczy
// ---------------------------------------------------------------------------

export async function getMyTasks(activeCycleId?: string): Promise<TaskWithRelations[]> {
  const auth = await getAuthenticatedClient()

  if (!auth) {
    return MOCK_TASKS
      .filter((t) => t.status !== 'cancelled')
      .map(enrichTask)
  }

  const { supabase, userId } = auth

  const baseAssigned = supabase
    .from('tasks')
    .select(TASK_SELECT)
    .eq('assignee_id', userId)
    .neq('status', 'cancelled')
    .is('deleted_at', null)

  const baseResponsible = supabase
    .from('tasks')
    .select(TASK_SELECT)
    .filter('raci->>responsible', 'eq', userId)
    .neq('status', 'cancelled')
    .is('deleted_at', null)

  const [assignedRes, responsibleRes] = await Promise.all([
    (activeCycleId ? baseAssigned.eq('cycle_id', activeCycleId) : baseAssigned).order('position'),
    (activeCycleId ? baseResponsible.eq('cycle_id', activeCycleId) : baseResponsible).order('position'),
  ])

  if (assignedRes.error) console.error('getMyTasks assigned:', assignedRes.error.message)
  if (responsibleRes.error) console.error('getMyTasks responsible:', responsibleRes.error.message)

  const seen = new Set<string>()
  const merged = [...(assignedRes.data ?? []), ...(responsibleRes.data ?? [])].filter((t) => {
    if (seen.has(t.id)) return false
    seen.add(t.id)
    return true
  })

  return merged as unknown as TaskWithRelations[]
}

export async function getTasksForCycle(cycleId: string): Promise<TaskWithRelations[]> {
  const auth = await getAuthenticatedClient()

  if (!auth) {
    return MOCK_TASKS
      .filter((t) => t.cycle_id === cycleId)
      .map(enrichTask)
  }

  const { supabase } = auth

  const { data, error } = await supabase
    .from('tasks')
    .select(TASK_SELECT)
    .eq('cycle_id', cycleId)
    .is('deleted_at', null)
    .order('position')

  if (error) { console.error('getTasksForCycle:', error.message); return [] }
  return (data ?? []) as unknown as TaskWithRelations[]
}

export async function getAllTasksWithRelations(): Promise<TaskWithRelations[]> {
  const auth = await getAuthenticatedClient()

  if (!auth) {
    return MOCK_TASKS.map(enrichTask)
  }

  const { supabase } = auth

  const { data, error } = await supabase
    .from('tasks')
    .select(TASK_SELECT)
    .neq('status', 'cancelled')
    .is('deleted_at', null)
    .order('priority')
    .order('created_at', { ascending: false })

  if (error) { console.error('getAllTasks:', error.message); return [] }
  return (data ?? []) as unknown as TaskWithRelations[]
}

export async function getProjects(): Promise<DbProject[]> {
  const auth = await getAuthenticatedClient()

  if (!auth) return MOCK_PROJECTS

  const { supabase } = auth

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('is_archived', false)
    .order('name')

  if (error) { console.error('getProjects:', error.message); return [] }

  return (data ?? []) as DbProject[]
}

// ---------------------------------------------------------------------------
// MUTATIONS — fallback: mock gdy brak auth (dev bez logowania)
// ---------------------------------------------------------------------------

export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
  position?: number
): Promise<{ error: string | null }> {
  const auth = await getAuthenticatedClient()

  if (!auth) return { error: 'Brak autoryzacji' }

  const patch: Record<string, unknown> = { status }
  if (position !== undefined) patch.position = position

  const { error } = await auth.supabase
    .from('tasks')
    .update(patch)
    .eq('id', taskId)
    .is('deleted_at', null)

  if (error) return { error: error.message }

  revalidatePath('/board')
  revalidatePath('/my-day')
  return { error: null }
}

export async function createTask(input: {
  title: string
  projectId: string
  status?: TaskStatus
  priority?: TaskPriority
  type?: TaskType
  cycleId?: string | null
  assigneeId?: string | null
  dueDate?: string | null
}): Promise<{ error: string | null }> {
  const parsed = CreateTaskSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const auth = await getAuthenticatedClient()

  if (!auth) return { error: 'Brak autoryzacji' }

  const { data } = parsed
  const { error } = await auth.supabase.from('tasks').insert({
    title: data.title,
    project_id: data.projectId,
    status: data.status ?? 'todo',
    priority: data.priority ?? 'medium',
    type: data.type ?? 'ops',
    cycle_id: data.cycleId ?? null,
    assignee_id: data.assigneeId ?? auth.userId,
    due_date: data.dueDate ?? null,
  })

  if (error) return { error: error.message }

  revalidatePath('/my-day')
  revalidatePath('/board')
  revalidatePath('/backlog')
  revalidateTag('tasks-for-cycle')
  revalidateTag('all-tasks')
  return { error: null }
}

export async function updateTask(
  taskId: string,
  patch: {
    title?: string
    description?: string | null
    status?: TaskStatus
    priority?: TaskPriority
    type?: TaskType
    ai_suggested?: boolean
    project_id?: string
    assignee_id?: string | null
    due_date?: string | null
    cycle_id?: string | null
    size?: TaskSize | null
    raci?: RaciMatrix | null
    story_points?: number | null
  }
): Promise<{ error: string | null }> {
  const auth = await getAuthenticatedClient()
  if (!auth) return { error: 'Brak autoryzacji' }

  const { error } = await auth.supabase
    .from('tasks')
    .update(patch)
    .eq('id', taskId)
    .is('deleted_at', null)

  if (error) return { error: error.message }

  revalidatePath('/board')
  revalidatePath('/my-day')
  revalidatePath('/backlog')
  revalidatePath('/team')
  revalidateTag('tasks-for-cycle')
  revalidateTag('all-tasks')
  return { error: null }
}

// Soft delete — zachowuje dane historyczne, ukrywa w UI
export async function deleteTask(taskId: string): Promise<{ error: string | null }> {
  const auth = await getAuthenticatedClient()
  if (!auth) return { error: 'Brak autoryzacji' }

  const { error } = await auth.supabase
    .from('tasks')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', taskId)

  if (error) return { error: error.message }

  revalidatePath('/board')
  revalidatePath('/my-day')
  revalidatePath('/backlog')
  return { error: null }
}

export async function moveTaskToCycle(
  taskId: string,
  cycleId: string
): Promise<{ error: string | null }> {
  const auth = await getAuthenticatedClient()

  if (!auth) return { error: 'Brak autoryzacji' }

  const { error } = await auth.supabase
    .from('tasks')
    .update({ cycle_id: cycleId })
    .eq('id', taskId)
    .is('deleted_at', null)

  if (error) return { error: error.message }

  revalidatePath('/board')
  revalidatePath('/backlog')
  return { error: null }
}

export async function updateTaskSize(
  taskId: string,
  size: TaskSize
): Promise<{ error: string | null }> {
  const auth = await getAuthenticatedClient()
  if (!auth) return { error: 'Brak autoryzacji' }

  const VALID_SIZES: TaskSize[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
  if (!VALID_SIZES.includes(size)) return { error: 'Nieprawidłowy rozmiar' }

  const { error } = await auth.supabase
    .from('tasks')
    .update({ size })
    .eq('id', taskId)
    .is('deleted_at', null)

  if (error) return { error: error.message }

  revalidatePath('/board')
  revalidatePath('/backlog')
  return { error: null }
}

export async function updateTaskStoryPoints(
  taskId: string,
  points: number
): Promise<{ error: string | null; warning?: string }> {
  const parsed = StoryPointsSchema.safeParse(points)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  // 13 (XXL) is blocked from UI — reject it server-side too
  if (points === 13) return { error: 'Zadań z 13 punktami nie można przypisywać do sprintów' }

  const auth = await getAuthenticatedClient()
  if (!auth) return { error: 'Brak autoryzacji' }

  // Capacity warning: check current assignee load in the task's cycle
  const { data: task } = await auth.supabase
    .from('tasks')
    .select('assignee_id, cycle_id')
    .eq('id', taskId)
    .single()

  let warning: string | undefined
  if (task?.assignee_id && task?.cycle_id) {
    const [siblingResult, cycleResult] = await Promise.all([
      auth.supabase
        .from('tasks')
        .select('story_points')
        .eq('assignee_id', task.assignee_id)
        .eq('cycle_id', task.cycle_id)
        .neq('id', taskId)
        .is('deleted_at', null),
      auth.supabase
        .from('cycles')
        .select('velocity_planned, tolerance_percent')
        .eq('id', task.cycle_id)
        .single(),
    ])

    const siblingSum = (siblingResult.data ?? []).reduce((s, t) => s + (t.story_points ?? 3), 0)
    const total = siblingSum + points
    const target = cycleResult.data?.velocity_planned ?? STORY_POINTS_LIMIT
    const tolerancePercent = (cycleResult.data?.tolerance_percent as number | null) ?? 20
    const zone = getZone(total, target, tolerancePercent)
    if (zone !== 'green') {
      warning = `Osoba ma już ${siblingSum} pkt — łącznie ${total} pkt (${zone === 'yellow' ? 'na granicy' : 'poza widełkami'} tolerancji ±${tolerancePercent}%)`
    }
  }

  const { error } = await auth.supabase
    .from('tasks')
    .update({ story_points: points })
    .eq('id', taskId)
    .is('deleted_at', null)

  if (error) return { error: error.message }

  revalidatePath('/board')
  revalidatePath('/backlog')
  revalidatePath('/capacity')
  return { error: null, warning }
}

export async function updateTaskRaci(
  taskId: string,
  raci: RaciMatrix | null
): Promise<{ error: string | null }> {
  const auth = await getAuthenticatedClient()
  if (!auth) return { error: 'Brak autoryzacji' }

  const { error } = await auth.supabase
    .from('tasks')
    .update({ raci })
    .eq('id', taskId)
    .is('deleted_at', null)

  if (error) return { error: error.message }

  revalidatePath('/board')
  revalidatePath('/backlog')
  return { error: null }
}

// ---------------------------------------------------------------------------
// SUBTASK ACTIONS
// ---------------------------------------------------------------------------

export async function createSubtask(
  parentId: string,
  title: string,
  projectId: string,
  parentType: string = 'ops'
): Promise<{ error: string | null; id?: string }> {
  const parsed = CreateSubtaskSchema.safeParse({ parentId, title, projectId })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const auth = await getAuthenticatedClient()
  if (!auth) return { error: null, id: `mock-${Date.now()}` }

  const { data, error } = await auth.supabase
    .from('tasks')
    .insert({
      title: parsed.data.title,
      project_id: parsed.data.projectId,
      parent_task_id: parsed.data.parentId,
      status: 'todo',
      priority: 'medium',
      type: parentType,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  return { error: null, id: data.id }
}

export async function updateSubtaskStatus(
  taskId: string,
  done: boolean
): Promise<{ error: string | null }> {
  const auth = await getAuthenticatedClient()
  if (!auth) return { error: 'Brak autoryzacji' }

  const { error } = await auth.supabase
    .from('tasks')
    .update({ status: done ? 'done' : 'todo' })
    .eq('id', taskId)

  if (error) return { error: error.message }
  return { error: null }
}

export async function removeSubtask(
  taskId: string
): Promise<{ error: string | null }> {
  const auth = await getAuthenticatedClient()
  if (!auth) return { error: 'Brak autoryzacji' }

  const { error } = await auth.supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)

  if (error) return { error: error.message }
  return { error: null }
}

// ---------------------------------------------------------------------------
// REORDER (DnD within same column)
// ---------------------------------------------------------------------------

// Accepts task IDs in new order (top→bottom) and writes their positions
export async function reorderColumn(
  taskIds: string[]
): Promise<{ error: string | null }> {
  const auth = await getAuthenticatedClient()
  if (!auth) return { error: 'Brak autoryzacji' }

  if (taskIds.length === 0) return { error: null }

  // Run all updates in parallel
  const results = await Promise.all(
    taskIds.map((id, index) =>
      auth.supabase
        .from('tasks')
        .update({ position: index })
        .eq('id', id)
        .is('deleted_at', null)
    )
  )

  const failed = results.find((r) => r.error)
  if (failed?.error) return { error: failed.error.message }

  revalidatePath('/board')
  return { error: null }
}

// ---------------------------------------------------------------------------
// BULK ACTIONS
// ---------------------------------------------------------------------------

export async function bulkUpdateTasks(
  taskIds: string[],
  patch: { assignee_id?: string | null; cycle_id?: string | null; status?: TaskStatus }
): Promise<{ error: string | null }> {
  const auth = await getAuthenticatedClient()
  if (!auth) return { error: 'Brak autoryzacji' }

  if (taskIds.length === 0) return { error: null }

  const { error } = await auth.supabase
    .from('tasks')
    .update(patch)
    .in('id', taskIds)
    .is('deleted_at', null)

  if (error) return { error: error.message }

  revalidatePath('/board')
  revalidatePath('/backlog')
  revalidatePath('/my-day')
  return { error: null }
}

// ---------------------------------------------------------------------------
// DELETED TASKS (soft delete view)
// ---------------------------------------------------------------------------

export async function getDeletedTasks(): Promise<TaskWithRelations[]> {
  const auth = await getAuthenticatedClient()
  if (!auth) return []

  const { data, error } = await auth.supabase
    .from('tasks')
    .select(TASK_SELECT)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
    .limit(50)

  if (error) { console.error('getDeletedTasks:', error.message); return [] }
  return (data ?? []) as unknown as TaskWithRelations[]
}

export async function restoreTask(
  taskId: string
): Promise<{ error: string | null }> {
  const auth = await getAuthenticatedClient()
  if (!auth) return { error: 'Brak autoryzacji' }

  const { error } = await auth.supabase
    .from('tasks')
    .update({ deleted_at: null })
    .eq('id', taskId)

  if (error) return { error: error.message }

  revalidatePath('/board')
  revalidatePath('/backlog')
  return { error: null }
}
