import type { Metadata } from 'next'
import { getDayOfWeek, getGreeting, formatDate } from '@/lib/utils'
import { getMyTasks } from '@/app/actions/tasks'
import { getProjects } from '@/app/actions/projects'
import { getActiveCycle } from '@/app/actions/cycles'
import { getProfiles } from '@/app/actions/users'
import { getAuthenticatedClient } from '@/lib/supabase/server'
import { TaskCard } from '@/components/compass/task-card'
import { QuickAddTask } from '@/components/compass/quick-add-task'
import { Sun, Circle, Clock4, CheckCircle2, TrendingUp } from 'lucide-react'

export const metadata: Metadata = { title: 'Moje Zadania' }

export default async function MyDayPage() {
  const [activeCycle, projects, profiles, auth] = await Promise.all([
    getActiveCycle(),
    getProjects(),
    getProfiles(),
    getAuthenticatedClient(),
  ])

  const tasks = await getMyTasks(activeCycle?.id)

  const currentUserId: string | null = auth?.userId ?? null
  const currentProfile = currentUserId
    ? profiles.find((p) => p.id === currentUserId)
    : null
  const userName = currentProfile?.full_name?.split(' ')[0] ?? 'Ty'

  const today = new Date()
  const inProgress = tasks.filter((t) => t.status === 'in_progress')
  const todo = tasks.filter((t) => t.status === 'todo')
  const done = tasks.filter((t) => t.status === 'done')
  const total = tasks.length
  const doneCount = done.length
  const progress = total > 0 ? Math.round((doneCount / total) * 100) : 0
  const greeting = getGreeting()

  // WIP warning
  const hasWipWarning = inProgress.length > 3

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 animate-fade-in">
      {/* Hero greeting */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Sun size={16} className="text-compass-warning" strokeWidth={1.5} />
          <span className="font-mono text-2xs text-compass-dim uppercase tracking-widest">
            {getDayOfWeek()}, {formatDate(today)}
          </span>
        </div>
        <h1 className="font-display text-3xl font-semibold text-compass-text tracking-tight">
          Moje zadania,{' '}
          <span className="text-compass-accent">{userName}</span>.
        </h1>
        <p className="mt-1 text-sm text-compass-muted">
          {inProgress.length > 0
            ? `Masz ${inProgress.length} ${inProgress.length === 1 ? 'zadanie aktywne' : 'zadania aktywne'}. Skupiaj się.`
            : todo.length > 0
            ? `${todo.length} zadań czeka. Zacznij od najważniejszego.`
            : 'Wszystko gotowe. Dobra robota!'}
        </p>
      </div>

      {/* WIP warning */}
      {hasWipWarning && (
        <div className="mb-4 px-3 py-2 rounded-[3px] bg-compass-danger-dim border border-compass-danger/30 text-xs text-compass-danger">
          Masz {inProgress.length} zadania w toku. Rozważ zamknięcie jednego przed dodaniem nowego.
        </div>
      )}

      {/* Pasek postępu sprintu */}
      <div className="compass-card p-4 mb-6">
        <div className="flex items-center justify-between mb-2.5">
          <span className="compass-label">Mój postęp w sprincie</span>
          <div className="flex items-center gap-1.5">
            <TrendingUp size={12} className="text-compass-muted" />
            <span className="font-display text-sm font-semibold text-compass-text">
              {doneCount}/{total}
            </span>
            <span className="font-mono text-2xs text-compass-dim">zadań</span>
          </div>
        </div>
        <div className="h-1.5 bg-compass-surface-2 rounded-full overflow-hidden">
          <div
            className="h-full bg-compass-accent rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center gap-3 mt-2.5">
          <StatPill icon={Clock4} color="text-compass-warning" count={inProgress.length} label="W toku" />
          <StatPill icon={Circle} color="text-compass-muted" count={todo.length} label="Do zrobienia" />
          <StatPill icon={CheckCircle2} color="text-compass-success" count={doneCount} label="Gotowe" />
        </div>
      </div>

      {/* Aktywne zadania */}
      {inProgress.length > 0 && (
        <Section label="Aktywne">
          {inProgress.map((task) => (
            <TaskCard key={task.id} task={task} profiles={profiles} />
          ))}
        </Section>
      )}

      {/* Do zrobienia */}
      {todo.length > 0 && (
        <Section label={
          activeCycle
            ? `Zadania ${activeCycle.name} · do ${formatDate(new Date(activeCycle.end_date))}`
            : 'Do zrobienia'
        }>
          {todo.map((task) => (
            <TaskCard key={task.id} task={task} profiles={profiles} />
          ))}
        </Section>
      )}

      {/* Ukończone */}
      {done.length > 0 && (
        <Section label="Ukończone">
          {done.map((task) => (
            <TaskCard key={task.id} task={task} profiles={profiles} />
          ))}
        </Section>
      )}

      {total === 0 && (
        <div className="text-center py-16">
          <div className="font-display text-5xl mb-3 text-compass-dim">✦</div>
          <p className="text-sm text-compass-muted">Brak przypisanych zadań w tym sprincie</p>
        </div>
      )}

      {/* Quick Add */}
      <div className="mt-6">
        <QuickAddTask projects={projects} assigneeId={currentUserId} />
      </div>
    </div>
  )
}

function Section({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <p className="compass-label mb-2 px-1">{label}</p>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  )
}

function StatPill({
  icon: Icon,
  color,
  count,
  label,
}: {
  icon: React.ElementType
  color: string
  count: number
  label: string
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon size={11} strokeWidth={1.5} className={color} />
      <span className="font-display text-sm font-semibold text-compass-text">{count}</span>
      <span className="font-mono text-2xs text-compass-dim">{label}</span>
    </div>
  )
}
