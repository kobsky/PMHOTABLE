// ---------------------------------------------------------------------------
// U2 — Story-point estimation BASELINE (DECISION SUPPORT, NOT ML, NO LLM)
// ---------------------------------------------------------------------------
//
// This module provides a transparent, deterministic median baseline for
// story-point estimation. It is DECISION SUPPORT, not machine learning, and
// contains NO LLM call. Given a (task type, size) bucket, suggestStoryPoints
// returns the MEDIAN story_points of completed historical tasks in that bucket,
// falling back to the overall median, then to a fixed size->points default map.
//
// Rationale for the median baseline (verified source):
//   Tawosi, Moussa, Sarro — "Investigating the Effectiveness of Clustering for
//   Story Point Estimation", IEEE Transactions on Software Engineering, 2022.
//   DOI: 10.1109/TSE.2022.3228739 (verified)
//   Finding: learned story-point models do not reliably beat a simple median
//   baseline. A transparent median baseline is therefore the honest choice for
//   decision support — no opaque model, no overclaiming.
// ---------------------------------------------------------------------------

import type { TaskType, TaskSize } from '@/lib/supabase/types'

/**
 * Allowed Fibonacci story-point values (mirrors the DB CHECK in migration 016).
 */
export const STORY_POINTS_FIBONACCI = [1, 2, 3, 5, 8, 13] as const

/**
 * Fixed size -> story_points default map. Mirrors the seed mapping used in
 * migration 016_story_points.sql, so suggestions stay consistent with the
 * historical backfill when no comparable history exists yet.
 */
export const SIZE_TO_POINTS: Record<TaskSize, number> = {
  XS: 1,
  S: 2,
  M: 3,
  L: 5,
  XL: 8,
  XXL: 13,
}

/** Overall fallback when there is no history and no usable size. */
export const DEFAULT_STORY_POINTS = 3

/**
 * Minimal shape of a historical task row needed for the baseline. Accepting a
 * structural type (rather than DbTask) keeps the function pure and easy to test.
 */
export interface HistoricalTask {
  type: TaskType
  size?: TaskSize | null
  story_points?: number | null
}

/** Snap an arbitrary number to the nearest allowed Fibonacci story-point value. */
export function snapToFibonacci(value: number): number {
  let best = STORY_POINTS_FIBONACCI[0] as number
  let bestDist = Math.abs(value - best)
  for (const fib of STORY_POINTS_FIBONACCI) {
    const dist = Math.abs(value - fib)
    if (dist < bestDist) {
      best = fib
      bestDist = dist
    }
  }
  return best
}

/**
 * Median of a list of numbers. Returns null for an empty list.
 * Even-length lists return the average of the two central values.
 */
export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid]
  return (sorted[mid - 1] + sorted[mid]) / 2
}

/** Result of a baseline suggestion, with provenance for transparency. */
export interface StoryPointSuggestion {
  /** Suggested story points, snapped to an allowed Fibonacci value. */
  points: number
  /** Where the suggestion came from — surfaced in the UI for transparency. */
  basis: 'bucket' | 'overall' | 'size_default' | 'global_default'
  /** Number of historical tasks the suggestion was computed from (0 for defaults). */
  sampleSize: number
}

/**
 * DECISION-SUPPORT BASELINE (not ML, no LLM).
 *
 * Returns the MEDIAN story_points for completed tasks matching the given
 * (taskType, size) bucket. Fallback chain:
 *   1. bucket median        — tasks with same type AND same size
 *   2. overall median       — all historical tasks (any type/size)
 *   3. size_default         — fixed SIZE_TO_POINTS map for the given size
 *   4. global_default       — DEFAULT_STORY_POINTS
 *
 * Only tasks whose story_points is a positive number are considered.
 *
 * @param taskType        type of the task being estimated
 * @param size            optional t-shirt size (deprecated field, still seeds defaults)
 * @param historicalTasks completed tasks to learn the median from
 */
export function suggestStoryPoints(
  taskType: TaskType,
  size: TaskSize | null | undefined,
  historicalTasks: HistoricalTask[],
): StoryPointSuggestion {
  const withPoints = historicalTasks.filter(
    (t): t is HistoricalTask & { story_points: number } =>
      typeof t.story_points === 'number' && t.story_points > 0,
  )

  // 1. Bucket median: same type AND same size (only when a size is provided).
  if (size != null) {
    const bucket = withPoints.filter((t) => t.type === taskType && t.size === size)
    const bucketMedian = median(bucket.map((t) => t.story_points))
    if (bucketMedian != null) {
      return { points: snapToFibonacci(bucketMedian), basis: 'bucket', sampleSize: bucket.length }
    }
  }

  // 2. Overall median across all history.
  const overallMedian = median(withPoints.map((t) => t.story_points))
  if (overallMedian != null) {
    return { points: snapToFibonacci(overallMedian), basis: 'overall', sampleSize: withPoints.length }
  }

  // 3. Fixed size -> points default map.
  if (size != null && size in SIZE_TO_POINTS) {
    return { points: SIZE_TO_POINTS[size], basis: 'size_default', sampleSize: 0 }
  }

  // 4. Global default.
  return { points: DEFAULT_STORY_POINTS, basis: 'global_default', sampleSize: 0 }
}

/**
 * Spearman's rank correlation coefficient (rho) between two equal-length series.
 * Intended for OFFLINE evaluation of the baseline (e.g. actual vs. predicted
 * story points) — it is NOT used at request time. Returns null when the inputs
 * are mismatched, too short (< 2 pairs), or when either series has zero variance
 * (rank correlation is undefined for a constant series).
 *
 * Uses average ranks for ties (fractional ranking) and the general Pearson
 * formula over ranks, so it is correct in the presence of tied values.
 */
export function spearman(actual: number[], predicted: number[]): number | null {
  if (actual.length !== predicted.length || actual.length < 2) return null

  const rankActual = averageRanks(actual)
  const rankPredicted = averageRanks(predicted)

  const n = rankActual.length
  const meanA = rankActual.reduce((s, v) => s + v, 0) / n
  const meanP = rankPredicted.reduce((s, v) => s + v, 0) / n

  let cov = 0
  let varA = 0
  let varP = 0
  for (let i = 0; i < n; i++) {
    const da = rankActual[i] - meanA
    const dp = rankPredicted[i] - meanP
    cov += da * dp
    varA += da * da
    varP += dp * dp
  }

  if (varA === 0 || varP === 0) return null
  return cov / Math.sqrt(varA * varP)
}

/**
 * Assign average (fractional) ranks to values, handling ties by sharing the
 * mean of the tied positions. Smallest value gets rank 1.
 */
function averageRanks(values: number[]): number[] {
  const indexed = values.map((value, index) => ({ value, index }))
  indexed.sort((a, b) => a.value - b.value)

  const ranks = new Array<number>(values.length)
  let i = 0
  while (i < indexed.length) {
    let j = i
    while (j + 1 < indexed.length && indexed[j + 1].value === indexed[i].value) {
      j++
    }
    // Positions i..j are tied; ranks are 1-based, so average of (i+1)..(j+1).
    const avgRank = (i + 1 + (j + 1)) / 2
    for (let k = i; k <= j; k++) {
      ranks[indexed[k].index] = avgRank
    }
    i = j + 1
  }
  return ranks
}
