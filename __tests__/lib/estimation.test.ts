import { describe, it, expect } from 'vitest'
import {
  suggestStoryPoints,
  median,
  snapToFibonacci,
  spearman,
  STORY_POINTS_FIBONACCI,
  SIZE_TO_POINTS,
  DEFAULT_STORY_POINTS,
  type HistoricalTask,
} from '@/lib/estimation'
import type { TaskType, TaskSize } from '@/lib/supabase/types'

// ---------------------------------------------------------------------------
// U2 — Story-point estimation BASELINE (decision support, not ML, no LLM)
// These tests assert BEHAVIOUR only (median bucket + fallback chain + spearman),
// never "effectiveness".
// ---------------------------------------------------------------------------

function task(type: TaskType, size: TaskSize | null, points: number | null): HistoricalTask {
  return { type, size, story_points: points }
}

// ---------------------------------------------------------------------------
// median
// ---------------------------------------------------------------------------
describe('median', () => {
  it('returns null for an empty list', () => {
    expect(median([])).toBeNull()
  })

  it('returns the middle value for an odd-length list', () => {
    expect(median([5, 1, 3])).toBe(3) // sorted: 1,3,5
  })

  it('returns the average of the two central values for an even-length list', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5)
  })

  it('does not mutate the input array', () => {
    const input = [3, 1, 2]
    median(input)
    expect(input).toEqual([3, 1, 2])
  })
})

// ---------------------------------------------------------------------------
// snapToFibonacci
// ---------------------------------------------------------------------------
describe('snapToFibonacci', () => {
  it('snaps an exact Fibonacci value to itself', () => {
    for (const fib of STORY_POINTS_FIBONACCI) {
      expect(snapToFibonacci(fib)).toBe(fib)
    }
  })

  it('snaps an in-between value to the nearest allowed point', () => {
    expect(snapToFibonacci(4)).toBe(3) // 4 is closer to 3 than 5 (ties resolve low)
    expect(snapToFibonacci(4.5)).toBe(5)
    expect(snapToFibonacci(6)).toBe(5)
    expect(snapToFibonacci(11)).toBe(13)
  })

  it('clamps below the lowest and above the highest allowed value', () => {
    expect(snapToFibonacci(0)).toBe(1)
    expect(snapToFibonacci(-5)).toBe(1)
    expect(snapToFibonacci(100)).toBe(13)
  })
})

// ---------------------------------------------------------------------------
// suggestStoryPoints — bucket median
// ---------------------------------------------------------------------------
describe('suggestStoryPoints — bucket median', () => {
  it('returns the median of the (type, size) bucket', () => {
    const history: HistoricalTask[] = [
      task('development', 'M', 3),
      task('development', 'M', 5),
      task('development', 'M', 5),
      // noise in other buckets that must be ignored
      task('development', 'L', 13),
      task('design', 'M', 1),
    ]
    const res = suggestStoryPoints('development', 'M', history)
    // bucket = [3,5,5] → median 5
    expect(res.basis).toBe('bucket')
    expect(res.points).toBe(5)
    expect(res.sampleSize).toBe(3)
  })

  it('snaps an even-length bucket median to the nearest Fibonacci point', () => {
    const history: HistoricalTask[] = [
      task('development', 'S', 1),
      task('development', 'S', 2),
    ]
    // median = 1.5 → snaps to 2 (tie → first/lower wins, but 1.5 is equidistant;
    // implementation keeps first best = 1). Assert against the real snap rule.
    const res = suggestStoryPoints('development', 'S', history)
    expect(res.basis).toBe('bucket')
    expect(STORY_POINTS_FIBONACCI as readonly number[]).toContain(res.points)
    expect(res.points).toBe(snapToFibonacci(1.5))
  })

  it('ignores rows with null or non-positive story_points when building the bucket', () => {
    const history: HistoricalTask[] = [
      task('development', 'M', null),
      task('development', 'M', 0),
      task('development', 'M', 8),
    ]
    const res = suggestStoryPoints('development', 'M', history)
    // only the 8-pointer counts
    expect(res.basis).toBe('bucket')
    expect(res.points).toBe(8)
    expect(res.sampleSize).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// suggestStoryPoints — fallback chain
// ---------------------------------------------------------------------------
describe('suggestStoryPoints — fallback chain', () => {
  it('falls back to the overall median when the bucket is empty', () => {
    const history: HistoricalTask[] = [
      task('design', 'L', 5),
      task('marketing', 'S', 3),
      task('ops', 'M', 1),
    ]
    // No 'development'/'XL' bucket → overall median of [1,3,5] = 3
    const res = suggestStoryPoints('development', 'XL', history)
    expect(res.basis).toBe('overall')
    expect(res.points).toBe(3)
    expect(res.sampleSize).toBe(3)
  })

  it('falls back to the size_default map when there is no usable history', () => {
    const res = suggestStoryPoints('development', 'L', [])
    expect(res.basis).toBe('size_default')
    expect(res.points).toBe(SIZE_TO_POINTS.L)
    expect(res.sampleSize).toBe(0)
  })

  it('falls back to the global default when there is no history and no size', () => {
    const res = suggestStoryPoints('development', null, [])
    expect(res.basis).toBe('global_default')
    expect(res.points).toBe(DEFAULT_STORY_POINTS)
    expect(res.sampleSize).toBe(0)
  })

  it('skips the bucket step entirely when size is null and uses the overall median', () => {
    const history: HistoricalTask[] = [
      task('development', 'M', 2),
      task('development', 'L', 8),
    ]
    const res = suggestStoryPoints('development', null, history)
    expect(res.basis).toBe('overall')
    // overall median of [2,8] = 5
    expect(res.points).toBe(5)
  })
})

// ---------------------------------------------------------------------------
// spearman (offline evaluation only)
// ---------------------------------------------------------------------------
describe('spearman', () => {
  it('returns 1 for a perfectly monotonic increasing relationship', () => {
    const a = [1, 2, 3, 4, 5]
    const b = [10, 20, 30, 40, 50]
    expect(spearman(a, b)).toBeCloseTo(1, 10)
  })

  it('returns -1 for a perfectly inverse relationship', () => {
    const a = [1, 2, 3, 4, 5]
    const b = [5, 4, 3, 2, 1]
    expect(spearman(a, b)).toBeCloseTo(-1, 10)
  })

  it('matches a known textbook value (with no ties)', () => {
    // Classic worked example: rho = 1 - 6*Sum(d^2)/(n(n^2-1))
    // a ranks vs b ranks, d = [-1,1,0,0,0] in this construction → Sum d^2 = 2
    // n=5 → 1 - 6*2/(5*24) = 1 - 12/120 = 0.9
    const a = [1, 2, 3, 4, 5]
    const b = [2, 1, 3, 4, 5]
    expect(spearman(a, b)).toBeCloseTo(0.9, 10)
  })

  it('handles tied values via average (fractional) ranking', () => {
    // Two identical series with ties must still correlate at 1.
    const a = [1, 1, 2, 3, 3]
    const b = [5, 5, 6, 9, 9]
    expect(spearman(a, b)).toBeCloseTo(1, 10)
  })

  it('returns null when lengths differ', () => {
    expect(spearman([1, 2, 3], [1, 2])).toBeNull()
  })

  it('returns null for fewer than 2 pairs', () => {
    expect(spearman([1], [1])).toBeNull()
    expect(spearman([], [])).toBeNull()
  })

  it('returns null when either series is constant (zero variance)', () => {
    expect(spearman([3, 3, 3], [1, 2, 3])).toBeNull()
    expect(spearman([1, 2, 3], [7, 7, 7])).toBeNull()
  })
})
