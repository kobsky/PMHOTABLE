// Edge Function: generate-weekly-summary
// Wywołanie: POST /functions/v1/generate-weekly-summary
// Cron: piątek 17:00 (konfiguracja w supabase/config.toml)
// Deno runtime

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Pobierz autora — użyj pierwszego aktywnego użytkownika (cron nie ma auth)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .limit(10)

    if (!profiles || profiles.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Brak profili w bazie' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const profileMap: Record<string, string> = Object.fromEntries(
      profiles.map((p) => [p.id, p.full_name ?? p.email])
    )
    const authorId = profiles[0].id

    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const weekAgoISO = weekAgo.toISOString()

    // Pobierz dane z ostatnich 7 dni
    const [tasksRes, decisionsRes, ideasRes] = await Promise.all([
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
    ])

    const tasks = tasksRes.data ?? []
    const decisions = decisionsRes.data ?? []
    const ideas = ideasRes.data ?? []

    const done = tasks.filter((t) => t.status === 'done')
    const inProgress = tasks.filter((t) => t.status === 'in_progress')
    const newTasks = tasks.filter((t) => t.status === 'todo')

    const weekLabel = formatWeekLabel(now)
    const content = buildMarkdown({ weekLabel, done, inProgress, newTasks, decisions, ideas, profileMap })
    const title = `Weekly Summary — ${weekLabel}`

    const { data, error } = await supabase
      .from('documents')
      .insert({
        title,
        type: 'weekly_summary',
        content,
        project_id: null,
        author_id: authorId,
      })
      .select('id, title, created_at')
      .single()

    if (error) throw new Error(error.message)

    return new Response(
      JSON.stringify({ success: true, document: data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatWeekLabel(date: Date): string {
  const start = new Date(date)
  start.setDate(date.getDate() - date.getDay() + 1)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)

  const fmt = (d: Date) =>
    d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })

  return `${fmt(start)} – ${fmt(end)} ${date.getFullYear()}`
}

interface Task { title: string; status: string; assignee_id?: string | null }
interface Decision { title: string; type: string }
interface Idea { title: string; status: string; ice_score: number | null }

function buildMarkdown(d: {
  weekLabel: string
  done: Task[]
  inProgress: Task[]
  newTasks: Task[]
  decisions: Decision[]
  ideas: Idea[]
  profileMap: Record<string, string>
}): string {
  const lines: string[] = []

  lines.push(`## Weekly Summary — ${d.weekLabel}`, '')

  lines.push('### ✅ Ukończone')
  if (d.done.length === 0) {
    lines.push('_Brak ukończonych zadań_')
  } else {
    for (const t of d.done) {
      const who = t.assignee_id ? ` (${d.profileMap[t.assignee_id] ?? '?'})` : ''
      lines.push(`- ${t.title}${who}`)
    }
  }
  lines.push('')

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

  if (d.newTasks.length > 0) {
    lines.push('### 📥 Nowe zadania')
    for (const t of d.newTasks) lines.push(`- ${t.title}`)
    lines.push('')
  }

  if (d.decisions.length > 0) {
    lines.push('### 📋 Nowe dokumenty')
    for (const doc of d.decisions) lines.push(`- [${doc.type.toUpperCase()}] ${doc.title}`)
    lines.push('')
  }

  if (d.ideas.length > 0) {
    lines.push('### 💡 Nowe pomysły')
    for (const idea of d.ideas) {
      const score = idea.ice_score != null ? ` (ICE: ${idea.ice_score})` : ''
      lines.push(`- ${idea.title}${score}`)
    }
    lines.push('')
  }

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
