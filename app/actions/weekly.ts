'use server'

import { getAuthenticatedClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { DbDocument } from '@/lib/supabase/types'

export async function generateWeeklySummary(): Promise<{
  doc: DbDocument | null
  error: string | null
}> {
  const auth = await getAuthenticatedClient()

  if (!auth) {
    // Dev bez auth — zwróć mock doc
    const mockDoc: DbDocument = {
      id: crypto.randomUUID(),
      title: `Weekly Summary — ${formatWeekLabel(new Date())}`,
      type: 'weekly_summary',
      content: buildMockSummary(),
      status: 'draft' as const,
      project_id: null,
      author_id: 'dev',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    return { doc: mockDoc, error: null }
  }

  const { supabase, userId } = auth

  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const weekAgoISO = weekAgo.toISOString()

  // Pobierz dane z ostatnich 7 dni równolegle
  const [tasksRes, decisionsRes, ideasRes, profilesRes] = await Promise.all([
    supabase
      .from('tasks')
      .select('title, status, assignee_id')
      .gte('updated_at', weekAgoISO)
      .neq('status', 'cancelled'),
    supabase
      .from('documents')
      .select('title, type')
      .gte('created_at', weekAgoISO)
      .neq('type', 'weekly_summary'),
    supabase
      .from('ideas')
      .select('title, status, ice_score')
      .gte('created_at', weekAgoISO),
    supabase
      .from('profiles')
      .select('id, full_name, email'),
  ])

  const tasks = tasksRes.data ?? []
  const decisions = decisionsRes.data ?? []
  const ideas = ideasRes.data ?? []
  const profiles = profilesRes.data ?? []

  const profileMap = Object.fromEntries(
    profiles.map((p) => [p.id, p.full_name ?? p.email])
  )

  const done = tasks.filter((t) => t.status === 'done')
  const inProgress = tasks.filter((t) => t.status === 'in_progress')
  const newTasks = tasks.filter((t) => t.status === 'todo')

  const content = buildSummaryMarkdown({
    weekLabel: formatWeekLabel(now),
    done,
    inProgress,
    newTasks,
    decisions,
    ideas,
    profileMap,
  })

  const title = `Weekly Summary — ${formatWeekLabel(now)}`

  const { data, error } = await supabase
    .from('documents')
    .insert({
      title,
      type: 'weekly_summary',
      content,
      project_id: null,
      author_id: userId,
    })
    .select('*')
    .single()

  if (error) return { doc: null, error: error.message }

  revalidatePath('/weekly')
  revalidatePath('/decisions')
  return { doc: data as DbDocument, error: null }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatWeekLabel(date: Date): string {
  const start = new Date(date)
  start.setDate(date.getDate() - date.getDay() + 1) // poniedziałek
  const end = new Date(start)
  end.setDate(start.getDate() + 6) // niedziela

  const fmt = (d: Date) =>
    d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })

  return `${fmt(start)} – ${fmt(end)} ${date.getFullYear()}`
}

interface SummaryData {
  weekLabel: string
  done: { title: string; assignee_id: string | null }[]
  inProgress: { title: string; assignee_id: string | null }[]
  newTasks: { title: string }[]
  decisions: { title: string; type: string }[]
  ideas: { title: string; status: string; ice_score: number | null }[]
  profileMap: Record<string, string>
}

function buildSummaryMarkdown(d: SummaryData): string {
  const lines: string[] = []

  lines.push(`## Weekly Summary — ${d.weekLabel}`, '')

  // Ukończone
  lines.push('### ✅ Ukończone')
  if (d.done.length === 0) {
    lines.push('_Brak ukończonych zadań w tym tygodniu_')
  } else {
    for (const t of d.done) {
      const who = t.assignee_id ? ` (${d.profileMap[t.assignee_id] ?? '?'})` : ''
      lines.push(`- ${t.title}${who}`)
    }
  }
  lines.push('')

  // W toku
  lines.push('### 🔄 W toku')
  if (d.inProgress.length === 0) {
    lines.push('_Brak zadań w toku_')
  } else {
    for (const t of d.inProgress) {
      const who = t.assignee_id ? ` (${d.profileMap[t.assignee_id] ?? '?'})` : ''
      lines.push(`- ${t.title}${who}`)
    }
  }
  lines.push('')

  // Nowe zadania
  if (d.newTasks.length > 0) {
    lines.push('### 📥 Nowe zadania')
    for (const t of d.newTasks) {
      lines.push(`- ${t.title}`)
    }
    lines.push('')
  }

  // Decyzje
  if (d.decisions.length > 0) {
    lines.push('### 📋 Nowe dokumenty')
    for (const doc of d.decisions) {
      lines.push(`- [${doc.type.toUpperCase()}] ${doc.title}`)
    }
    lines.push('')
  }

  // Pomysły
  if (d.ideas.length > 0) {
    lines.push('### 💡 Nowe pomysły')
    for (const idea of d.ideas) {
      const score = idea.ice_score != null ? ` (ICE: ${idea.ice_score})` : ''
      lines.push(`- ${idea.title}${score}`)
    }
    lines.push('')
  }

  // Statystyki
  lines.push('### 📊 Statystyki tygodnia')
  lines.push(`- Ukończone zadania: **${d.done.length}**`)
  lines.push(`- W toku: **${d.inProgress.length}**`)
  lines.push(`- Nowe dokumenty: **${d.decisions.length}**`)
  lines.push(`- Nowe pomysły: **${d.ideas.length}**`)
  lines.push('')

  lines.push('### 🚧 Blokery')
  lines.push('_Do uzupełnienia ręcznie_')
  lines.push('')
  lines.push('### 📝 Notatki')
  lines.push('_Do uzupełnienia ręcznie_')

  return lines.join('\n')
}

function buildMockSummary(): string {
  return buildSummaryMarkdown({
    weekLabel: formatWeekLabel(new Date()),
    done: [
      { title: 'Setup projektu Next.js 15 + Supabase', assignee_id: 'u1' },
      { title: 'Schemat bazy danych — migracje SQL', assignee_id: 'u2' },
    ],
    inProgress: [
      { title: 'Implementacja magic link auth', assignee_id: 'u1' },
      { title: 'Sprint Board — drag & drop kolumny', assignee_id: 'u2' },
    ],
    newTasks: [
      { title: 'Dokumentacja milestonu M2 — raport' },
    ],
    decisions: [
      { title: 'ADR-001: Wybór Supabase jako backend', type: 'adr' },
    ],
    ideas: [
      { title: 'Integracja z Google Calendar dla hoteli', status: 'inbox', ice_score: 6.0 },
    ],
    profileMap: { u1: 'Ania', u2: 'Marek', u3: 'Kasia' },
  })
}
