import { describe, it, expect } from 'vitest'
import {
  computeWsjf,
  hasValidWsjfInputs,
  isValidWsjfValue,
  spearman,
  WSJF_FIBONACCI,
  type WsjfInputs,
} from '@/lib/wsjf'

// ---------------------------------------------------------------------------
// U5 — SAFe WSJF (decision support, deterministic formula, no ML, no LLM)
// Behaviour-only assertions: WSJF = (uv+tc+rr)/jobSize, divide-by-zero guards,
// validation, and a correct Spearman over a known vector.
// ---------------------------------------------------------------------------

const VALID: WsjfInputs = {
  userValue: 8,
  timeCriticality: 5,
  riskReduction: 2,
  jobSize: 3,
}

// ---------------------------------------------------------------------------
// isValidWsjfValue
// ---------------------------------------------------------------------------
describe('isValidWsjfValue', () => {
  it('accepts every value on the allowed Fibonacci scale', () => {
    for (const v of WSJF_FIBONACCI) expect(isValidWsjfValue(v)).toBe(true)
  })

  it('rejects values off the scale, non-integers and negatives', () => {
    expect(isValidWsjfValue(4)).toBe(false)
    expect(isValidWsjfValue(0)).toBe(false)
    expect(isValidWsjfValue(-1)).toBe(false)
    expect(isValidWsjfValue(2.5)).toBe(false)
    expect(isValidWsjfValue(21)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// hasValidWsjfInputs
// ---------------------------------------------------------------------------
describe('hasValidWsjfInputs', () => {
  it('returns true for a complete, on-scale set', () => {
    expect(hasValidWsjfInputs(VALID)).toBe(true)
  })

  it('returns false when any input is missing', () => {
    expect(hasValidWsjfInputs({ userValue: 8, timeCriticality: 5, riskReduction: 2 })).toBe(false)
    expect(hasValidWsjfInputs({})).toBe(false)
  })

  it('returns false when any input is off the Fibonacci scale', () => {
    expect(hasValidWsjfInputs({ ...VALID, userValue: 4 })).toBe(false)
    expect(hasValidWsjfInputs({ ...VALID, jobSize: 7 })).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// computeWsjf
// ---------------------------------------------------------------------------
describe('computeWsjf', () => {
  it('computes (userValue + timeCriticality + riskReduction) / jobSize', () => {
    // (8 + 5 + 2) / 3 = 5
    expect(computeWsjf(VALID)).toBe(5)
  })

  it('computes a non-integer ratio correctly', () => {
    // (3 + 2 + 1) / 5 = 1.2
    expect(computeWsjf({ userValue: 3, timeCriticality: 2, riskReduction: 1, jobSize: 5 })).toBeCloseTo(1.2, 10)
  })

  it('ranks a smaller job above a larger one for equal Cost of Delay', () => {
    const cod = { userValue: 8, timeCriticality: 8, riskReduction: 8 }
    const small = computeWsjf({ ...cod, jobSize: 1 })!
    const large = computeWsjf({ ...cod, jobSize: 13 })!
    expect(small).toBeGreaterThan(large)
  })

  it('returns null (no divide-by-zero) when inputs are incomplete', () => {
    expect(computeWsjf({ userValue: 8, timeCriticality: 5, riskReduction: 2 })).toBeNull()
    expect(computeWsjf({})).toBeNull()
  })

  it('returns null for off-scale inputs rather than producing a value', () => {
    // jobSize = 0 is off-scale → guarded, never divides by zero
    expect(computeWsjf({ userValue: 8, timeCriticality: 5, riskReduction: 2, jobSize: 0 })).toBeNull()
    expect(computeWsjf({ ...VALID, userValue: 4 })).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// spearman
// ---------------------------------------------------------------------------
describe('spearman', () => {
  it('returns 1 when the WSJF order matches the expert order exactly', () => {
    const wsjf = [5, 3, 2, 1]
    const expert = [50, 30, 20, 10]
    expect(spearman(wsjf, expert)).toBeCloseTo(1, 10)
  })

  it('returns -1 when the orders are exactly reversed', () => {
    const wsjf = [5, 3, 2, 1]
    const expert = [10, 20, 30, 40]
    expect(spearman(wsjf, expert)).toBeCloseTo(-1, 10)
  })

  it('matches a known textbook value (0.9, no ties)', () => {
    // d^2 sum = 2, n = 5 → 1 - 6*2/(5*24) = 0.9
    expect(spearman([1, 2, 3, 4, 5], [2, 1, 3, 4, 5])).toBeCloseTo(0.9, 10)
  })

  it('handles ties via fractional ranking', () => {
    expect(spearman([1, 1, 3], [4, 4, 9])).toBeCloseTo(1, 10)
  })

  it('returns null for mismatched length, n < 2, or a constant series', () => {
    expect(spearman([1, 2], [1])).toBeNull()
    expect(spearman([1], [1])).toBeNull()
    expect(spearman([2, 2, 2], [1, 2, 3])).toBeNull()
  })
})
