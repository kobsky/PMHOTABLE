'use server'

// ---------------------------------------------------------------------------
// U2 — Story-point estimation BASELINE server action.
//
// DECISION SUPPORT, NOT ML, and NO LLM. This action fetches completed
// historical tasks and returns a transparent MEDIAN baseline suggestion via
// lib/estimation.ts. The UI logs accept/apply to ai_feedback with
// feature="sp_estimation_baseline" (raw interaction logging only — adoption,
// not effectiveness).
//
// Rationale (verified): Tawosi, Moussa, Sarro, IEEE TSE 2022,
// DOI:10.1109/TSE.2022.3228739 — a learned SP model does not reliably beat the
// median baseline, so a transparent median baseline is the honest choice.
// ---------------------------------------------------------------------------

import { getAuthenticatedClient } from '@/lib/supabase/server'
import {
  suggestStoryPoints,
  type HistoricalTask,
  type StoryPointSuggestion,
} from '@/lib/estimation'
import type { TaskType, TaskSize } from '@/lib/supabase/types'

export interface StoryPointSuggestionResult {
  suggestion: StoryPointSuggestion | null
  error: string | null
}

/**
 * Returns a median-baseline story-point suggestion for a (taskType, size)
 * bucket, computed from completed historical tasks. Tier 0 auth guarded.
 *
 * On no auth, the action returns a null suggestion (silent fallback) so the
 * caller can simply render nothing.
 */
export async function getStoryPointSuggestion(
  taskType: TaskType,
  size: TaskSize | null,
): Promise<StoryPointSuggestionResult> {
  const auth = await getAuthenticatedClient()
  if (!auth) return { suggestion: null, error: null }

  // Completed tasks only — done work is the honest basis for an estimate.
  // Parent tasks only, exclude soft-deleted rows.
  const { data, error } = await auth.supabase
    .from('tasks')
    .select('type, size, story_points')
    .eq('status', 'done')
    .is('deleted_at', null)
    .is('parent_task_id', null)
    .not('story_points', 'is', null)
    .limit(500)

  if (error) return { suggestion: null, error: error.message }

  const historicalTasks = (data ?? []) as HistoricalTask[]
  const suggestion = suggestStoryPoints(taskType, size, historicalTasks)

  return { suggestion, error: null }
}
