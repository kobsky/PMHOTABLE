import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { TaskType } from '@/lib/supabase/types'

// ---------------------------------------------------------------------------
// AI inference
// ---------------------------------------------------------------------------

export interface TaskTypeInference {
  type: TaskType
  confidence: number // 0–1
}

/**
 * Rule-based task type inference from title.
 * Returns null when no confident match is found.
 */
export function inferTaskType(title: string): TaskTypeInference | null {
  const t = title.toLowerCase().trim()
  if (t.length < 3) return null

  // Research & Analizy
  if (/\b(research|badani[ea]|zbadaj|investigat(e|ion)|analiz[aeuy]|analys[ei]s|audit|poc|proof of concept|spike|explore?|discover|learn|onboard)\b/.test(t)) {
    return { type: 'research', confidence: 0.88 }
  }

  // Design & Content
  if (/\b(design|mockup|wireframe|prototype|figma|ui|ux|layout|visual|branding|logo|typography|ilustracj[ae]|grafik[ai]|content|copy|tekst|artykuł)\b/.test(t)) {
    return { type: 'design', confidence: 0.85 }
  }

  // PR i Marketing
  if (/\b(marketing|kampani[ae]|campaign|newsletter|social([ -]media)?|seo|blog|landing page|copywrite?|email campaign|promo(cj[ae])?|reklam[ae]|pr\b|press release|media)\b/.test(t)) {
    return { type: 'marketing', confidence: 0.83 }
  }

  // Outreach & Growth
  if (/\b(outreach|growth|partnerstwo|partnership|lead|akwizycj[ae]|acquisition|sprzedaż|sales|konferencj[ae]|conference|event|demo|pitch|cold)\b/.test(t)) {
    return { type: 'outreach', confidence: 0.83 }
  }

  // Support & Feedback
  if (/\b(support|fix(ed|ing|uj|uję)?|bug|błąd|error|crash\w*|broken|hotfix|glitch\w*|feedback|zgłoszeni[ae]|issue|problem|napraw\w*|klient|customer)\b/.test(t)) {
    return { type: 'support', confidence: 0.82 }
  }

  // Operations & Admin
  if (/\b(refactor|refaktoryz|cleanup|clean[ -]up|setup|set[ -]up|konfiguracja|configur(e|ation)|deploy|migrat(e|ion)|upgrade|maintenance|readme|dokumentacj[ae]|documentation|ci\/cd|linting|dependency|dependencies|admin|ops|operacj[ae])\b/.test(t)) {
    return { type: 'ops', confidence: 0.80 }
  }

  // Development
  if (/\b(add|dodaj|implement(uj)?|zbuduj|build|create|utwórz|now[ay]|new|feature|funkcj[ae]|integracj[ae]|integrat(e|ion)|develop|wdróż|introduce)\b/.test(t)) {
    return { type: 'development', confidence: 0.75 }
  }

  return null
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculateICE(impact: number, confidence: number, ease: number): number {
  return Math.round(((impact + confidence + ease) / 3) * 10) / 10
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatShortDate(date: string | Date): string {
  return new Intl.DateTimeFormat('pl-PL', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(date))
}

export function formatRelativeDate(date: string | Date): string {
  const d = new Date(date)
  const now = new Date()
  const diffMs = d.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Dziś'
  if (diffDays === 1) return 'Jutro'
  if (diffDays === -1) return 'Wczoraj'
  if (diffDays < 0) return `${Math.abs(diffDays)}d temu`
  if (diffDays < 7) return `za ${diffDays}d`
  return formatShortDate(date)
}

export function getDayOfWeek(date?: Date): string {
  const d = date ?? new Date()
  const days = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota']
  return days[d.getDay()]
}

export function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Dzień dobry'
  if (hour < 18) return 'Cześć'
  return 'Dobry wieczór'
}

export function getPriorityLabel(priority: string): string {
  const map: Record<string, string> = {
    low: 'Niski',
    medium: 'Średni',
    high: 'Wysoki',
    urgent: 'Pilny',
  }
  return map[priority] ?? priority
}

export function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    todo: 'Do zrobienia',
    in_progress: 'W toku',
    done: 'Gotowe',
    cancelled: 'Anulowane',
  }
  return map[status] ?? status
}

export function getScopeLabel(scope: string): string {
  const map: Record<string, string> = {
    'scope_1.0': 'Scope 1.0',
    'scope_1.5': 'Scope 1.5',
    'scope_2.0': 'Scope 2.0',
    grant_parp: 'Grant PARP',
    marketing: 'Marketing',
    ops: 'Ops',
  }
  return map[scope] ?? scope
}

export function getTaskTypeLabel(type: string): string {
  const map: Record<string, string> = {
    research: 'Research & Analizy',
    development: 'Development',
    outreach: 'Outreach & Growth',
    design: 'Design & Content',
    marketing: 'PR i Marketing',
    support: 'Support & Feedback',
    ops: 'Operations & Admin',
  }
  return map[type] ?? type
}

export function getTaskTypeIcon(type: string): string {
  const map: Record<string, string> = {
    research: '◆',
    development: '⚙',
    outreach: '◎',
    design: '△',
    marketing: '◈',
    support: '○',
    ops: '▣',
  }
  return map[type] ?? '○'
}

export function getDocStatusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: 'Szkic',
    review: 'Review',
    accepted: 'Zaakceptowany',
    deprecated: 'Wycofany',
    superseded: 'Zastąpiony',
  }
  return map[status] ?? status
}

export function getGoalStatusLabel(status: string): string {
  const map: Record<string, string> = {
    on_track: 'Na dobrej drodze',
    at_risk: 'Zagrożony',
    off_track: 'Opóźniony',
    achieved: 'Osiągnięty',
  }
  return map[status] ?? status
}

export function isDeadlineNear(dueDate: string | null, daysThreshold: number = 3): boolean {
  if (!dueDate) return false
  const due = new Date(dueDate)
  const now = new Date()
  const diffMs = due.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  return diffDays >= 0 && diffDays <= daysThreshold
}

export function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false
  return new Date(dueDate) < new Date()
}

export function scopeColor(scope: string): string {
  const map: Record<string, string> = {
    'scope_1.0': '#4BAF87',
    'scope_1.5': '#4B8FAF',
    'scope_2.0': '#8F4BAF',
    grant_parp: '#F5A83A',
    marketing: '#E8622A',
    ops: '#848179',
  }
  return map[scope] ?? '#848179'
}
