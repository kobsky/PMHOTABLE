'use server'

import { getAuthenticatedClient } from '@/lib/supabase/server'
import { inferTaskType } from '@/lib/utils'
import { revalidatePath } from 'next/cache'
import type { AiFeature, DbAiFeedback } from '@/lib/supabase/types'

// ---------------------------------------------------------------------------
// Workload Balancing
// ---------------------------------------------------------------------------

export interface WorkloadSuggestion {
  suggestionId: string
  fromUserId: string
  fromUserName: string
  toUserId: string
  toUserName: string
  taskId: string
  taskTitle: string
  fromLoad: number
  toLoad: number
}

export interface WorkloadResult {
  suggestions: WorkloadSuggestion[]
  loadMap: Record<string, { name: string; active: number; inProgress: number }>
  error: string | null
}

export async function getWorkloadSuggestions(): Promise<WorkloadResult> {
  const auth = await getAuthenticatedClient()
  if (!auth) return { suggestions: [], loadMap: {}, error: null }

  const [profilesRes, tasksRes] = await Promise.all([
    auth.supabase.from('profiles').select('id, full_name, email').order('full_name'),
    auth.supabase
      .from('tasks')
      .select('id, title, status, priority, assignee_id')
      .in('status', ['todo', 'in_progress', 'in_review'])
      .is('deleted_at', null)
      .is('parent_task_id', null),
  ])

  if (profilesRes.error) return { suggestions: [], loadMap: {}, error: profilesRes.error.message }
  if (tasksRes.error) return { suggestions: [], loadMap: {}, error: tasksRes.error.message }

  const profiles = (profilesRes.data ?? []) as Array<{ id: string; full_name: string | null; email: string }>
  type TaskRow = { id: string; title: string; status: string; priority: string; assignee_id: string | null }
  const activeTasks = (tasksRes.data ?? []) as TaskRow[]

  // Build per-user load maps
  const loadMap: Record<string, { name: string; active: number; inProgress: number; tasks: TaskRow[] }> = {}
  for (const p of profiles) {
    loadMap[p.id] = { name: p.full_name ?? p.email.split('@')[0], active: 0, inProgress: 0, tasks: [] }
  }
  for (const t of activeTasks) {
    if (t.assignee_id && loadMap[t.assignee_id]) {
      loadMap[t.assignee_id].active++
      if (t.status === 'in_progress') loadMap[t.assignee_id].inProgress++
      loadMap[t.assignee_id].tasks.push(t)
    }
  }

  // Suggest moving a task from the most overloaded → least loaded (min diff = 2)
  const DIFF_THRESHOLD = 2
  const ranked = Object.entries(loadMap).sort((a, b) => b[1].active - a[1].active)
  const suggestions: WorkloadSuggestion[] = []

  for (const [fromId, fromData] of ranked) {
    if (suggestions.length >= 3) break
    // Find least-loaded user that's at least DIFF_THRESHOLD below fromData
    const candidates = ranked
      .filter(([id, d]) => id !== fromId && fromData.active - d.active >= DIFF_THRESHOLD)
    if (candidates.length === 0) continue
    const [toId, toData] = candidates[candidates.length - 1] // least loaded

    // Prefer moving a todo task (least disruptive), fall back to any
    const candidate = fromData.tasks.find(t => t.status === 'todo') ?? fromData.tasks[0]
    if (!candidate) continue

    suggestions.push({
      suggestionId: `${fromId}-${toId}-${candidate.id}`,
      fromUserId: fromId,
      fromUserName: fromData.name,
      toUserId: toId,
      toUserName: toData.name,
      taskId: candidate.id,
      taskTitle: candidate.title,
      fromLoad: fromData.active,
      toLoad: toData.active,
    })
  }

  // Strip the tasks array before returning (not needed by client)
  const publicLoadMap: Record<string, { name: string; active: number; inProgress: number }> = {}
  for (const [id, d] of Object.entries(loadMap)) {
    publicLoadMap[id] = { name: d.name, active: d.active, inProgress: d.inProgress }
  }

  return { suggestions, loadMap: publicLoadMap, error: null }
}

// ---------------------------------------------------------------------------
// Assignee Recommender
// ---------------------------------------------------------------------------

export interface AssigneeSuggestion {
  assignee_id: string
  assignee_name: string
  score: number  // 0.0–1.0
  reason: string
}

export async function getAssigneeRecommendation(
  taskTitle: string,
  taskDescription: string | null,
  taskId?: string | null,
): Promise<{ suggestions: AssigneeSuggestion[]; error: string | null }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { suggestions: [], error: null }  // silent fallback

  const auth = await getAuthenticatedClient()
  if (!auth) return { suggestions: [], error: null }

  try {
    const [profilesRes, tasksRes] = await Promise.all([
      auth.supabase.from('profiles').select('id, full_name, email, role').order('full_name'),
      auth.supabase
        .from('tasks')
        .select('id, title, type, status, assignee_id')
        .is('deleted_at', null)
        .is('parent_task_id', null)
        .not('assignee_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(60),
    ])

    if (profilesRes.error || !profilesRes.data?.length) return { suggestions: [], error: null }

    type ProfileRow = { id: string; full_name: string | null; email: string; role?: string[] | null }
    const profiles = profilesRes.data as ProfileRow[]

    type TaskRow = { id: string; title: string; type: string; status: string; assignee_id: string }
    const allTasks = (tasksRes.data ?? []) as TaskRow[]

    // Build per-assignee history (last 20 tasks each)
    const teamContext = profiles
      .map((p) => {
        const name = p.full_name ?? p.email.split('@')[0]
        const roleStr = Array.isArray(p.role) && p.role.length > 0
          ? `roles: ${p.role.join(', ')}`
          : ''
        const ptasks = allTasks.filter((t) => t.assignee_id === p.id).slice(0, 20)
        const history =
          ptasks.map((t) => `[${t.type}] ${t.title}`).join('; ') || 'no history yet'
        return `- ${name} (id: ${p.id}${roleStr ? `, ${roleStr}` : ''}): ${history}`
      })
      .join('\n')

    const desc = taskDescription ? `\nDescription: ${taskDescription.slice(0, 400)}` : ''
    const prompt = `You are a task assignment assistant for a small 3-person tech startup PM tool.

Team members and their recent task history:
${teamContext}

New task to assign:
Title: "${taskTitle}"${desc}

Recommend the 2 best assignees based on their task history and expertise.

Respond ONLY with valid JSON (no markdown blocks), exactly like this:
[{"assignee_id":"<uuid>","score":0.87,"reason":"Short reason under 60 chars"},{"assignee_id":"<uuid>","score":0.65,"reason":"Short reason under 60 chars"}]

Valid assignee_id values: ${profiles.map((p) => p.id).join(', ')}`

    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const client = new Anthropic({ apiKey })

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })

    const rawText =
      message.content[0]?.type === 'text' ? message.content[0].text.trim() : ''

    // Extract JSON array (handle any accidental wrapping)
    const jsonMatch = rawText.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return { suggestions: [], error: null }

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      assignee_id: string
      score: number
      reason: string
    }>

    const validIds = new Set(profiles.map((p) => p.id))
    const suggestions: AssigneeSuggestion[] = parsed
      .filter((s) => s.assignee_id && validIds.has(s.assignee_id) && typeof s.score === 'number')
      .slice(0, 2)
      .map((s) => {
        const p = profiles.find((pr) => pr.id === s.assignee_id)!
        return {
          assignee_id: s.assignee_id,
          assignee_name: p.full_name ?? p.email.split('@')[0],
          score: Math.max(0, Math.min(1, s.score)),
          reason: String(s.reason ?? '').slice(0, 80),
        }
      })

    return { suggestions, error: null }
  } catch {
    // Silently fail — show nothing to user
    return { suggestions: [], error: null }
  }
}

// ---------------------------------------------------------------------------
// Feedback logging
// ---------------------------------------------------------------------------

export async function logAIFeedback(input: {
  feature: AiFeature
  taskId?: string | null
  suggestion: Record<string, unknown>
  accepted: boolean
  overrideValue?: Record<string, unknown> | null
}): Promise<void> {
  const auth = await getAuthenticatedClient()
  if (!auth) return

  // Fire and forget — don't block UI on logging errors
  await auth.supabase.from('ai_feedback').insert({
    feature: input.feature,
    task_id: input.taskId ?? null,
    suggestion: input.suggestion,
    accepted: input.accepted,
    override_value: input.overrideValue ?? null,
  })
}

// ---------------------------------------------------------------------------
// Bulk auto-categorization
// ---------------------------------------------------------------------------

export async function bulkCategorizeTaskTypes(
  tasks: Array<{ id: string; title: string; currentType: string }>
): Promise<{ error: string | null; updated: number }> {
  const auth = await getAuthenticatedClient()
  if (!auth) return { error: null, updated: 0 }

  const toUpdate: Array<{ id: string; type: string }> = []
  for (const task of tasks) {
    const inf = inferTaskType(task.title)
    if (inf && inf.type !== task.currentType) {
      toUpdate.push({ id: task.id, type: inf.type })
    }
  }

  if (toUpdate.length === 0) return { error: null, updated: 0 }

  const results = await Promise.all(
    toUpdate.map(({ id, type }) =>
      auth.supabase
        .from('tasks')
        .update({ type, ai_suggested: true })
        .eq('id', id)
        .is('deleted_at', null)
    )
  )

  const failed = results.find((r) => r.error)
  if (failed?.error) return { error: failed.error.message, updated: 0 }

  revalidatePath('/backlog')
  revalidatePath('/board')
  return { error: null, updated: toUpdate.length }
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

export interface AIFeedbackStats {
  feature: AiFeature
  total: number
  accepted: number
  acceptanceRate: number
}

export async function getAIFeedbackStats(): Promise<{
  stats: AIFeedbackStats[]
  recent: DbAiFeedback[]
  error: string | null
}> {
  const auth = await getAuthenticatedClient()
  if (!auth) return { stats: [], recent: [], error: null }

  const { data, error } = await auth.supabase
    .from('ai_feedback')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return { stats: [], recent: [], error: error.message }

  const rows = (data ?? []) as DbAiFeedback[]

  // Aggregate by feature
  const featureMap = new Map<AiFeature, { total: number; accepted: number }>()
  for (const row of rows) {
    const f = row.feature as AiFeature
    const cur = featureMap.get(f) ?? { total: 0, accepted: 0 }
    cur.total++
    if (row.accepted === true) cur.accepted++
    featureMap.set(f, cur)
  }

  const stats: AIFeedbackStats[] = Array.from(featureMap.entries()).map(([feature, counts]) => ({
    feature,
    total: counts.total,
    accepted: counts.accepted,
    acceptanceRate: counts.total > 0 ? Math.round((counts.accepted / counts.total) * 100) : 0,
  }))

  return { stats, recent: rows.slice(0, 50), error: null }
}
