'use server'

import { getAuthenticatedClient } from '@/lib/supabase/server'
import { inferTaskType } from '@/lib/utils'
import { revalidatePath } from 'next/cache'
import type { AiFeature, DbAiFeedback } from '@/lib/supabase/types'

// ===========================================================================
// DECISION SUPPORT (heuristic scoring) — NOT machine learning, NOT an LLM.
//
// The functions in this file are deterministic heuristics that help a human
// decide; they do not learn from data and they do not call any external model.
// The only real ML in the product is the task-type classifier (U1) elsewhere.
//
// Bias note: a naive "most-experienced person wins" rule creates a
// rich-get-richer (Matthew effect) loop — the same person keeps getting work,
// which is both unfair and a single point of failure. We counter it with an
// explicit EXPLORATION weight that boosts under-loaded / less-experienced
// members, and we surface a Gini coefficient of current load as a transparent
// bias monitor so the human can see imbalance, not just the recommendation.
// ===========================================================================

// ---------------------------------------------------------------------------
// Shared helpers: load distribution + Gini bias monitor
// ---------------------------------------------------------------------------

// Minimal structural shapes so callers can pass already-fetched rows
// (DbUser[], TaskWithRelations[], etc.) without re-querying — see PERF-004.
type ProfileLike = { id: string; full_name: string | null; email?: string | null }
type TaskLike = {
  id: string
  title: string
  status: string
  type?: string | null
  assignee_id: string | null
  parent_task_id?: string | null
  deleted_at?: string | null
}

function displayName(p: ProfileLike): string {
  if (p.full_name && p.full_name.trim()) return p.full_name
  const email = p.email ?? ''
  return email.includes('@') ? email.split('@')[0] : 'Bez nazwy'
}

/**
 * Gini coefficient of a set of non-negative values (here: active task counts).
 * 0 = perfectly even distribution, →1 = one person holds everything.
 * Used purely as a transparency / bias-monitor signal, not as a score.
 * Reference: Gini, C. (1912). "Variabilità e mutabilità." (concept; DOI to verify)
 */
function giniCoefficient(values: number[]): number {
  const n = values.length
  if (n === 0) return 0
  const sum = values.reduce((a, b) => a + b, 0)
  if (sum === 0) return 0 // no load at all → treat as perfectly even
  const sorted = [...values].sort((a, b) => a - b)
  // Standard mean-absolute-difference form of the Gini index.
  let cumulative = 0
  for (let i = 0; i < n; i++) {
    cumulative += (2 * (i + 1) - n - 1) * sorted[i]
  }
  return cumulative / (n * sum)
}

// ---------------------------------------------------------------------------
// U4 — Workload Balancing (decision support)
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

export interface WorkloadImbalance {
  // Gini of active-task counts across the team (0 even … →1 concentrated).
  gini: number
  // Population variance of active-task counts (secondary imbalance signal).
  variance: number
  // Spread between the most- and least-loaded member.
  maxLoad: number
  minLoad: number
}

export interface WorkloadResult {
  suggestions: WorkloadSuggestion[]
  loadMap: Record<string, { name: string; active: number; inProgress: number }>
  imbalance: WorkloadImbalance
  error: string | null
}

const EMPTY_IMBALANCE: WorkloadImbalance = { gini: 0, variance: 0, maxLoad: 0, minLoad: 0 }

/**
 * U4 — suggest workload-rebalancing moves from already-fetched data.
 *
 * PERF-004 fix: the /team page already loads profiles + tasks, so this function
 * now ACCEPTS them as parameters instead of re-querying the DB. No auth guard /
 * Supabase round-trip needed for the suggestion math — it is pure computation
 * over data the caller already authorized and fetched.
 *
 * @param profiles already-fetched team profiles (e.g. DbUser[])
 * @param tasks    already-fetched tasks (e.g. TaskWithRelations[]); the function
 *                 filters to active, non-subtask, non-deleted rows internally
 */
export async function getWorkloadSuggestions(
  profiles: ProfileLike[],
  tasks: TaskLike[],
): Promise<WorkloadResult> {
  if (!profiles || profiles.length === 0) {
    return { suggestions: [], loadMap: {}, imbalance: EMPTY_IMBALANCE, error: null }
  }

  // Active, top-level (non-subtask), non-deleted tasks only.
  const activeTasks = (tasks ?? []).filter(
    (t) =>
      ['todo', 'in_progress', 'in_review'].includes(t.status) &&
      !t.parent_task_id &&
      !t.deleted_at,
  )

  // Build per-user load maps
  const loadMap: Record<string, { name: string; active: number; inProgress: number; tasks: TaskLike[] }> = {}
  for (const p of profiles) {
    loadMap[p.id] = { name: displayName(p), active: 0, inProgress: 0, tasks: [] }
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

  // Imbalance / bias monitor over active-task counts.
  const loads = Object.values(loadMap).map((d) => d.active)
  const mean = loads.reduce((a, b) => a + b, 0) / (loads.length || 1)
  const variance =
    loads.length > 0
      ? loads.reduce((a, v) => a + (v - mean) ** 2, 0) / loads.length
      : 0
  const imbalance: WorkloadImbalance = {
    gini: giniCoefficient(loads),
    variance,
    maxLoad: loads.length ? Math.max(...loads) : 0,
    minLoad: loads.length ? Math.min(...loads) : 0,
  }

  // Strip the tasks array before returning (not needed by client)
  const publicLoadMap: Record<string, { name: string; active: number; inProgress: number }> = {}
  for (const [id, d] of Object.entries(loadMap)) {
    publicLoadMap[id] = { name: d.name, active: d.active, inProgress: d.inProgress }
  }

  return { suggestions, loadMap: publicLoadMap, imbalance, error: null }
}

// ---------------------------------------------------------------------------
// U3 — Assignee Recommender (DECISION SUPPORT, deterministic — no LLM)
//
// Earlier this called the Claude/Anthropic API. That is intentionally REMOVED:
// the thesis solution must be transparent, reproducible and offline. We replace
// it with a deterministic, explainable scoring function over the team.
//
// score(person, task) = weighted sum of four normalised [0..1] sub-scores:
//   (a) skill   — person's skills/roles vs the task type + title keywords
//   (b) load    — inverse current active load (fewer open tasks ⇒ higher)
//   (c) history — person's count of past tasks of the SAME type (experience)
//   (d) explore — EXPLORATION bonus boosting under-loaded / less-experienced
//                 members to counter rich-get-richer (Matthew-effect) bias.
//
// Each candidate is returned with its sub-scores and a transparent Polish
// reason string. We also return a Gini coefficient of current load as a bias
// monitor. No data is learned or persisted by this function — pure heuristic.
//
// Bias / fairness rationale for the exploration term:
//   Merton, R.K. (1968) "The Matthew Effect in Science", Science 159(3810),
//   pp. 56-63. DOI:10.1126/science.159.3810.56 (concept reference).
// ---------------------------------------------------------------------------

export interface AssigneeSubScores {
  skill: number    // (a) 0..1
  load: number     // (b) 0..1
  history: number  // (c) 0..1
  explore: number  // (d) 0..1
}

export interface AssigneeSuggestion {
  assignee_id: string
  assignee_name: string
  score: number  // 0.0–1.0 (weighted total)
  reason: string
  subScores: AssigneeSubScores
}

export interface AssigneeRecommendationResult {
  suggestions: AssigneeSuggestion[]
  // Cache key the UI uses to memoise results per task (see UI gating by button).
  cacheKey: string | null
  // Gini coefficient of current active load across the team (bias monitor).
  loadGini: number
  error: string | null
}

// Sub-score weights. Skill + history reward fit/experience; load + explore
// push back against concentration so work spreads across the small team.
const ASSIGNEE_WEIGHTS = { skill: 0.4, load: 0.25, history: 0.2, explore: 0.15 } as const

export async function getAssigneeRecommendation(
  taskTitle: string,
  taskDescription: string | null,
  taskId?: string | null,
): Promise<AssigneeRecommendationResult> {
  const cacheKey = taskId ?? null

  // Tier 0 auth guard preserved.
  const auth = await getAuthenticatedClient()
  if (!auth) return { suggestions: [], cacheKey, loadGini: 0, error: null }

  try {
    const [profilesRes, tasksRes] = await Promise.all([
      auth.supabase.from('profiles').select('id, full_name, email, role, skills').order('full_name'),
      auth.supabase
        .from('tasks')
        .select('id, title, type, status, assignee_id')
        .is('deleted_at', null)
        .is('parent_task_id', null)
        .not('assignee_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(200),
    ])

    if (profilesRes.error || !profilesRes.data?.length) {
      if (profilesRes.error) console.error('getAssigneeRecommendation profiles:', profilesRes.error.message)
      return { suggestions: [], cacheKey, loadGini: 0, error: null }
    }
    if (tasksRes.error) console.error('getAssigneeRecommendation tasks:', tasksRes.error.message)

    type ProfileRow = {
      id: string
      full_name: string | null
      email: string | null
      role?: string[] | null
      skills?: string[] | null
    }
    const profiles = profilesRes.data as ProfileRow[]

    type TaskRow = { id: string; title: string; type: string; status: string; assignee_id: string }
    const allTasks = (tasksRes.data ?? []) as TaskRow[]

    // --- Task signal: inferred type + lowercase keyword bag -----------------
    const inferred = inferTaskType(taskTitle)
    const taskType = inferred?.type ?? null
    const keywordText = `${taskTitle} ${taskDescription ?? ''}`.toLowerCase()
    const keywords = keywordText.split(/[^a-ząćęłńóśźż0-9]+/i).filter((w) => w.length >= 3)

    // --- Per-person aggregates ---------------------------------------------
    const activeStatuses = new Set(['todo', 'in_progress', 'in_review'])
    const activeLoad = new Map<string, number>()
    const sameTypeCount = new Map<string, number>()
    let maxLoad = 0
    let maxSameType = 0

    for (const p of profiles) {
      const ptasks = allTasks.filter((t) => t.assignee_id === p.id)
      const load = ptasks.filter((t) => activeStatuses.has(t.status)).length
      const sameType = taskType ? ptasks.filter((t) => t.type === taskType).length : 0
      activeLoad.set(p.id, load)
      sameTypeCount.set(p.id, sameType)
      if (load > maxLoad) maxLoad = load
      if (sameType > maxSameType) maxSameType = sameType
    }

    // --- Score each candidate ----------------------------------------------
    const scored = profiles.map((p) => {
      const name = displayName(p)
      const skillTokens = [
        ...(Array.isArray(p.skills) ? p.skills : []),
        ...(Array.isArray(p.role) ? p.role : []),
      ].map((s) => s.toLowerCase())

      // (a) skill: fraction of task keywords matched by a skill/role token,
      //     plus a direct bonus if a skill/role names the inferred task type.
      let keywordHits = 0
      for (const kw of keywords) {
        if (skillTokens.some((s) => s.includes(kw) || kw.includes(s))) keywordHits++
      }
      const keywordScore = keywords.length ? keywordHits / keywords.length : 0
      const typeNameHit =
        taskType && skillTokens.some((s) => s.includes(taskType) || taskType.includes(s)) ? 1 : 0
      const skill = Math.min(1, keywordScore + 0.5 * typeNameHit)

      // (b) load: inverse of current active load, normalised by busiest member.
      const load = maxLoad > 0 ? 1 - (activeLoad.get(p.id) ?? 0) / maxLoad : 1

      // (c) history: experience on this task type, normalised by most-experienced.
      const history = maxSameType > 0 ? (sameTypeCount.get(p.id) ?? 0) / maxSameType : 0

      // (d) explore: boost under-loaded AND less-experienced members to fight
      //     the rich-get-richer loop. High when both current load is low (load
      //     sub-score high) and prior experience is low (history low).
      const explore = (load + (1 - history)) / 2

      const subScores: AssigneeSubScores = { skill, load, history, explore }

      const total =
        ASSIGNEE_WEIGHTS.skill * skill +
        ASSIGNEE_WEIGHTS.load * load +
        ASSIGNEE_WEIGHTS.history * history +
        ASSIGNEE_WEIGHTS.explore * explore

      const reason = buildAssigneeReason(name, subScores, taskType)

      return {
        assignee_id: p.id,
        assignee_name: name,
        score: Math.max(0, Math.min(1, total)),
        reason,
        subScores,
      }
    })

    scored.sort((a, b) => b.score - a.score)
    const suggestions = scored.slice(0, 2)

    const loadGini = giniCoefficient(profiles.map((p) => activeLoad.get(p.id) ?? 0))

    return { suggestions, cacheKey, loadGini, error: null }
  } catch (err) {
    console.error('getAssigneeRecommendation:', err)
    return { suggestions: [], cacheKey, loadGini: 0, error: null }
  }
}

/** Transparent Polish explanation built from the dominant sub-scores. */
function buildAssigneeReason(
  _name: string,
  s: AssigneeSubScores,
  taskType: string | null,
): string {
  const parts: string[] = []
  if (s.skill >= 0.5) parts.push('dopasowanie kompetencji')
  if (s.history >= 0.5) parts.push(taskType ? `doświadczenie w "${taskType}"` : 'doświadczenie')
  if (s.load >= 0.66) parts.push('niskie obciążenie')
  if (s.explore >= 0.66 && parts.length === 0) parts.push('odciążenie zespołu (eksploracja)')
  if (parts.length === 0) parts.push('zrównoważony wybór')
  return parts.join(', ')
}

// ---------------------------------------------------------------------------
// Feedback logging
// ---------------------------------------------------------------------------

// Widened feature union for Tier 2 UIs. The base AiFeature union (3 values) is
// extended here with the new decision-support feature names whose DB CHECK is
// widened in migration 020 (wsjf-logic). Kept local so we don't edit types.ts.
export type LoggableAiFeature =
  | AiFeature
  | 'sp_estimation_baseline'
  | 'wsjf_prioritization'
  | 'task_type_classifier_ml'

export async function logAIFeedback(input: {
  feature: LoggableAiFeature
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

  // ONE batch upsert (id + new type) — mirrors reorderSubtasks batch pattern.
  const rows = toUpdate.map(({ id, type }) => ({ id, type, ai_suggested: true }))

  const { error } = await auth.supabase
    .from('tasks')
    .upsert(rows)

  if (error) return { error: error.message, updated: 0 }

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
