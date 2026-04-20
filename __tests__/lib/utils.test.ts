import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import {
  inferTaskType,
  calculateICE,
  formatDate,
  formatShortDate,
  formatRelativeDate,
  getDayOfWeek,
  getGreeting,
  getPriorityLabel,
  getStatusLabel,
  getScopeLabel,
  getTaskTypeLabel,
  getTaskTypeIcon,
  getDocStatusLabel,
  getGoalStatusLabel,
  isDeadlineNear,
  isOverdue,
  scopeColor,
  cn,
} from '@/lib/utils'

// ---------------------------------------------------------------------------
// inferTaskType
// ---------------------------------------------------------------------------
describe('inferTaskType', () => {
  // Short / empty inputs
  it('returns null for empty string', () => expect(inferTaskType('')).toBeNull())
  it('returns null for 2-char string', () => expect(inferTaskType('ab')).toBeNull())

  // Support detection (replaces bug)
  it('detects support from "fix"', () => {
    const r = inferTaskType('Fix login redirect issue')
    expect(r).not.toBeNull()
    expect(r!.type).toBe('support')
    expect(r!.confidence).toBeGreaterThan(0.8)
  })
  it('detects support from "bug"', () => expect(inferTaskType('Bug in payment flow')!.type).toBe('support'))
  it('detects support from "error"', () => expect(inferTaskType('Error on signup page')!.type).toBe('support'))
  it('detects support from "crash"', () => expect(inferTaskType('App crashing on mobile')!.type).toBe('support'))
  it('detects support from Polish "napraw"', () => expect(inferTaskType('Napraw formularz')!.type).toBe('support'))
  it('detects support from "błąd"', () => expect(inferTaskType('Błąd walidacji formularza')!.type).toBe('support'))
  it('detects support from "hotfix"', () => expect(inferTaskType('Hotfix: null pointer in auth')!.type).toBe('support'))

  // Research detection
  it('detects research from "research"', () => expect(inferTaskType('Research payment providers')!.type).toBe('research'))
  it('detects research from "investigate"', () => expect(inferTaskType('Investigate performance bottleneck')!.type).toBe('research'))
  it('detects research from "audit"', () => expect(inferTaskType('Security audit of auth flow')!.type).toBe('research'))
  it('detects research from Polish "badania"', () => expect(inferTaskType('Badania użytkowników')!.type).toBe('research'))
  it('detects research from "spike"', () => expect(inferTaskType('Spike: evaluate GraphQL')!.type).toBe('research'))
  it('detects research from "poc"', () => expect(inferTaskType('POC for new DB migration')!.type).toBe('research'))

  // Design detection
  it('detects design from "design"', () => expect(inferTaskType('Design new dashboard layout')!.type).toBe('design'))
  it('detects design from "mockup"', () => expect(inferTaskType('Create mockup for onboarding')!.type).toBe('design'))
  it('detects design from "wireframe"', () => expect(inferTaskType('Wireframe for mobile view')!.type).toBe('design'))
  it('detects design from "figma"', () => expect(inferTaskType('Update Figma components')!.type).toBe('design'))
  it('detects design from "ui"', () => expect(inferTaskType('UI for settings page')!.type).toBe('design'))

  // Marketing detection
  it('detects marketing from "marketing"', () => expect(inferTaskType('Marketing campaign Q2')!.type).toBe('marketing'))
  it('detects marketing from "newsletter"', () => expect(inferTaskType('Send newsletter to users')!.type).toBe('marketing'))
  it('detects marketing from "seo"', () => expect(inferTaskType('SEO optimization for landing page')!.type).toBe('marketing'))
  it('detects marketing from "blog"', () => expect(inferTaskType('Write blog post about feature')!.type).toBe('marketing'))

  // Ops detection (replaces chore)
  it('detects ops from "refactor"', () => expect(inferTaskType('Refactor auth module')!.type).toBe('ops'))
  it('detects ops from "deploy"', () => expect(inferTaskType('Deploy to production')!.type).toBe('ops'))
  it('detects ops from "setup"', () => expect(inferTaskType('Setup CI/CD pipeline')!.type).toBe('ops'))
  it('detects ops from "migrate"', () => expect(inferTaskType('Migrate database schema')!.type).toBe('ops'))
  it('detects ops from "upgrade"', () => expect(inferTaskType('Upgrade React to v19')!.type).toBe('ops'))
  it('detects ops from "documentation"', () => expect(inferTaskType('Update documentation')!.type).toBe('ops'))

  // Development detection (replaces feature)
  it('detects development from "add"', () => expect(inferTaskType('Add user notifications')!.type).toBe('development'))
  it('detects development from "implement"', () => expect(inferTaskType('Implement payment gateway')!.type).toBe('development'))
  it('detects development from "build"', () => expect(inferTaskType('Build search functionality')!.type).toBe('development'))
  it('detects development from Polish "dodaj"', () => expect(inferTaskType('Dodaj filtrowanie backlogu')!.type).toBe('development'))

  // Priority: support wins over development
  it('support matches before development for "fix broken"', () => {
    expect(inferTaskType('Fix broken feature')!.type).toBe('support')
  })

  // Confidence ordering
  it('support confidence is higher than development confidence', () => {
    const support = inferTaskType('Fix login crash')!
    const dev = inferTaskType('Add new login page')!
    expect(support.confidence).toBeGreaterThan(dev.confidence)
  })

  // No match
  it('returns null for generic meeting notes', () => {
    expect(inferTaskType('Team retrospective')).toBeNull()
  })
  it('returns null for "stand up"', () => {
    expect(inferTaskType('Stand-up 10AM')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// calculateICE
// ---------------------------------------------------------------------------
describe('calculateICE', () => {
  it('returns 6 for equal scores', () => expect(calculateICE(6, 6, 6)).toBe(6))
  it('returns max of 10 for all-10 input', () => expect(calculateICE(10, 10, 10)).toBe(10))
  it('returns 0 for all-zero input', () => expect(calculateICE(0, 0, 0)).toBe(0))
  it('rounds to one decimal place', () => {
    // (7 + 8 + 9) / 3 = 8.0 exactly
    expect(calculateICE(7, 8, 9)).toBe(8)
  })
  it('rounds correctly for non-round result', () => {
    // (1 + 2 + 3) / 3 = 2.0
    expect(calculateICE(1, 2, 3)).toBe(2)
  })
  it('handles mixed values', () => {
    // (10 + 5 + 3) / 3 = 6.0
    expect(calculateICE(10, 5, 3)).toBe(6)
  })
  it('rounds to 1 decimal', () => {
    // (1 + 1 + 2) / 3 = 1.333... → 1.3
    expect(calculateICE(1, 1, 2)).toBe(1.3)
  })
})

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------
describe('formatDate', () => {
  it('returns a non-empty string for valid date string', () => {
    const result = formatDate('2026-01-15')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
  it('accepts a Date object', () => {
    const result = formatDate(new Date(2026, 0, 15))
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
  it('output contains the year', () => {
    expect(formatDate('2026-01-15')).toContain('2026')
  })
})

describe('formatShortDate', () => {
  it('returns a non-empty string', () => {
    expect(formatShortDate('2026-06-01').length).toBeGreaterThan(0)
  })
  it('does not contain the full year', () => {
    // Short date: "1 cze" not "01.06.2026"
    expect(formatShortDate('2026-06-01')).not.toContain('2026')
  })
})

// ---------------------------------------------------------------------------
// formatRelativeDate — uses fake timers
// ---------------------------------------------------------------------------
describe('formatRelativeDate', () => {
  beforeAll(() => {
    vi.useFakeTimers()
    // Fix time: 2026-04-16 noon UTC to avoid timezone edge-cases
    vi.setSystemTime(new Date('2026-04-16T12:00:00.000Z'))
  })
  afterAll(() => {
    vi.useRealTimers()
  })

  it('returns "Jutro" for tomorrow', () => {
    expect(formatRelativeDate('2026-04-17')).toBe('Jutro')
  })
  it('returns "Wczoraj" for yesterday', () => {
    expect(formatRelativeDate('2026-04-15')).toBe('Wczoraj')
  })
  it('returns "za Xd" for 5 days ahead', () => {
    expect(formatRelativeDate('2026-04-21')).toBe('za 5d')
  })
  it('returns "Xd temu" for 3 days ago', () => {
    expect(formatRelativeDate('2026-04-13')).toBe('3d temu')
  })
  it('returns formatted date for > 7 days ahead', () => {
    const result = formatRelativeDate('2026-05-20')
    // Should be a short formatted date, not "za Xd"
    expect(result).not.toMatch(/^za \d+d$/)
  })
})

// ---------------------------------------------------------------------------
// getDayOfWeek / getGreeting
// ---------------------------------------------------------------------------
describe('getDayOfWeek', () => {
  it('returns a non-empty Polish day name', () => {
    const days = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota']
    expect(days).toContain(getDayOfWeek())
  })
  it('accepts a Date argument', () => {
    // 2026-04-13 is a Monday
    const monday = new Date(2026, 3, 13) // April 13, 2026
    expect(getDayOfWeek(monday)).toBe('Poniedziałek')
  })
})

describe('getGreeting', () => {
  it('returns one of the three Polish greetings', () => {
    const valid = ['Dzień dobry', 'Cześć', 'Dobry wieczór']
    expect(valid).toContain(getGreeting())
  })
})

// ---------------------------------------------------------------------------
// Label mappers
// ---------------------------------------------------------------------------
describe('getPriorityLabel', () => {
  it('returns Polish label for known priority', () => {
    expect(getPriorityLabel('low')).toBe('Niski')
    expect(getPriorityLabel('medium')).toBe('Średni')
    expect(getPriorityLabel('high')).toBe('Wysoki')
    expect(getPriorityLabel('urgent')).toBe('Pilny')
  })
  it('returns the key itself for unknown priority', () => {
    expect(getPriorityLabel('unknown')).toBe('unknown')
  })
})

describe('getStatusLabel', () => {
  it('returns Polish label for known status', () => {
    expect(getStatusLabel('todo')).toBe('Do zrobienia')
    expect(getStatusLabel('in_progress')).toBe('W toku')
    expect(getStatusLabel('done')).toBe('Gotowe')
    expect(getStatusLabel('cancelled')).toBe('Anulowane')
  })
  it('returns the key for unknown status', () => {
    expect(getStatusLabel('archived')).toBe('archived')
  })
})

describe('getScopeLabel', () => {
  it('maps all known scope tags', () => {
    expect(getScopeLabel('scope_1.0')).toBe('Scope 1.0')
    expect(getScopeLabel('scope_1.5')).toBe('Scope 1.5')
    expect(getScopeLabel('scope_2.0')).toBe('Scope 2.0')
    expect(getScopeLabel('grant_parp')).toBe('Grant PARP')
    expect(getScopeLabel('marketing')).toBe('Marketing')
    expect(getScopeLabel('ops')).toBe('Ops')
  })
  it('returns the key for unknown scope', () => {
    expect(getScopeLabel('other')).toBe('other')
  })
})

describe('getTaskTypeLabel', () => {
  const types = ['research', 'development', 'outreach', 'design', 'marketing', 'support', 'ops'] as const
  types.forEach((t) => {
    it(`returns non-empty label for "${t}"`, () => {
      expect(getTaskTypeLabel(t).length).toBeGreaterThan(0)
    })
  })
})

describe('getTaskTypeIcon', () => {
  it('returns non-empty icon string for known types', () => {
    expect(getTaskTypeIcon('support')).toBe('○')
    expect(getTaskTypeIcon('development')).toBe('⚙')
    expect(getTaskTypeIcon('ops')).toBe('▣')
  })
  it('returns fallback for unknown type', () => {
    expect(getTaskTypeIcon('unknown')).toBe('○')
  })
})

describe('getDocStatusLabel', () => {
  it('maps all known doc statuses', () => {
    expect(getDocStatusLabel('draft')).toBe('Szkic')
    expect(getDocStatusLabel('review')).toBe('Review')
    expect(getDocStatusLabel('accepted')).toBe('Zaakceptowany')
    expect(getDocStatusLabel('deprecated')).toBe('Wycofany')
    expect(getDocStatusLabel('superseded')).toBe('Zastąpiony')
  })
})

describe('getGoalStatusLabel', () => {
  it('maps all known goal statuses', () => {
    expect(getGoalStatusLabel('on_track')).toBe('Na dobrej drodze')
    expect(getGoalStatusLabel('at_risk')).toBe('Zagrożony')
    expect(getGoalStatusLabel('off_track')).toBe('Opóźniony')
    expect(getGoalStatusLabel('achieved')).toBe('Osiągnięty')
  })
})

// ---------------------------------------------------------------------------
// isDeadlineNear
// ---------------------------------------------------------------------------
describe('isDeadlineNear', () => {
  it('returns false for null', () => expect(isDeadlineNear(null)).toBe(false))
  it('returns false for a far-future date (100 days away)', () => {
    const future = new Date(Date.now() + 100 * 86_400_000).toISOString().split('T')[0]
    expect(isDeadlineNear(future)).toBe(false)
  })
  it('returns false for a past date', () => {
    expect(isDeadlineNear('2020-01-01')).toBe(false)
  })
  it('returns true for a date within 3-day default threshold', () => {
    const twoDays = new Date(Date.now() + 2 * 86_400_000).toISOString().split('T')[0]
    expect(isDeadlineNear(twoDays)).toBe(true)
  })
  it('honours custom threshold', () => {
    const tenDays = new Date(Date.now() + 10 * 86_400_000).toISOString().split('T')[0]
    expect(isDeadlineNear(tenDays, 14)).toBe(true)
    expect(isDeadlineNear(tenDays, 5)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// isOverdue
// ---------------------------------------------------------------------------
describe('isOverdue', () => {
  it('returns false for null', () => expect(isOverdue(null)).toBe(false))
  it('returns true for a past date', () => expect(isOverdue('2020-01-01')).toBe(true))
  it('returns false for a far-future date', () => expect(isOverdue('2099-12-31')).toBe(false))
})

// ---------------------------------------------------------------------------
// scopeColor
// ---------------------------------------------------------------------------
describe('scopeColor', () => {
  it('returns a hex color for known scopes', () => {
    expect(scopeColor('scope_1.0')).toMatch(/^#[0-9A-Fa-f]{6}$/)
    expect(scopeColor('grant_parp')).toMatch(/^#[0-9A-Fa-f]{6}$/)
    expect(scopeColor('marketing')).toMatch(/^#[0-9A-Fa-f]{6}$/)
  })
  it('returns the fallback gray for unknown scope', () => {
    expect(scopeColor('unknown')).toBe('#848179')
  })
  it('maps all 6 known scopes to hex colors', () => {
    const scopes = ['scope_1.0', 'scope_1.5', 'scope_2.0', 'grant_parp', 'marketing', 'ops']
    scopes.forEach((s) => {
      expect(scopeColor(s)).toMatch(/^#[0-9A-Fa-f]{6}$/)
    })
  })
  it('colored scopes return distinct colors from each other', () => {
    // At least scope_1.0, grant_parp, marketing are distinctly colored
    expect(scopeColor('scope_1.0')).toBe('#4BAF87')
    expect(scopeColor('grant_parp')).toBe('#F5A83A')
    expect(scopeColor('marketing')).toBe('#E8622A')
  })
})

// ---------------------------------------------------------------------------
// cn (class merger)
// ---------------------------------------------------------------------------
describe('cn', () => {
  it('merges class names', () => {
    expect(cn('a', 'b')).toBe('a b')
  })
  it('handles conditional classes', () => {
    expect(cn('a', false && 'b', 'c')).toBe('a c')
  })
  it('deduplicates Tailwind classes (last wins)', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })
  it('handles empty input', () => {
    expect(cn()).toBe('')
  })
})
