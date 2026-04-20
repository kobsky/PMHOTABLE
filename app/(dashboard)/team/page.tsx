import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/compass/page-header'
import { getAllTasksWithRelations } from '@/app/actions/tasks'
import { getProfiles } from '@/app/actions/users'
import { getWorkloadSuggestions } from '@/app/actions/ai'
import { WorkloadSuggestionsPanel } from '@/components/compass/workload-suggestions'
import { Clock4, CheckCircle2, Circle, Settings2 } from 'lucide-react'

export const metadata: Metadata = { title: 'Zespół' }

export default async function TeamPage() {
  const [profiles, tasks, { suggestions }] = await Promise.all([
    getProfiles(),
    getAllTasksWithRelations(),
    getWorkloadSuggestions(),
  ])

  return (
    <div className="flex flex-col h-screen">
      <PageHeader
        title="Zespół"
        subtitle="Widok aktywności i obciążenia"
        actions={
          <Link href="/team/members" className="compass-btn-outline text-xs flex items-center gap-1.5">
            <Settings2 size={12} />
            Zarządzaj członkami
          </Link>
        }
      />
      <div className="flex-1 overflow-auto p-6">
        <WorkloadSuggestionsPanel suggestions={suggestions} />

        <div className="grid gap-3 max-w-2xl">
          {profiles.map((user) => {
            const userTasks = tasks.filter((t) => t.assignee_id === user.id)
            const inProgress = userTasks.filter((t) => t.status === 'in_progress').length
            const todo = userTasks.filter((t) => t.status === 'todo').length
            const done = userTasks.filter((t) => t.status === 'done').length
            const initial = (user.full_name?.[0] ?? user.email?.[0] ?? '?').toUpperCase()

            return (
              <div key={user.id} className="compass-card p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full bg-compass-surface-3 border border-compass-border flex items-center justify-center font-mono text-sm text-compass-muted uppercase font-medium">
                    {initial}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-compass-text">
                      {user.full_name ?? user.email?.split('@')[0] ?? 'Nieznany'}
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {user.email && (
                        <p className="font-mono text-2xs text-compass-dim">{user.email}</p>
                      )}
                      {Array.isArray(user.role) && user.role.slice(0, 2).map((r) => (
                        <span key={r} className="font-mono text-2xs px-1 py-0.5 rounded-[2px] bg-compass-accent/10 text-compass-accent">
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                  {inProgress >= 3 && (
                    <span className="ml-auto compass-badge compass-badge-danger">WIP limit</span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <StatItem icon={Clock4} color="text-compass-warning" count={inProgress} label="W toku" />
                  <StatItem icon={Circle} color="text-compass-muted" count={todo} label="Todo" />
                  <StatItem icon={CheckCircle2} color="text-compass-success" count={done} label="Gotowe" />
                </div>
                <div className="mt-3 h-1 bg-compass-surface-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-compass-accent to-compass-success rounded-full"
                    style={{ width: userTasks.length > 0 ? `${(done / userTasks.length) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            )
          })}

          {profiles.length === 0 && (
            <div className="text-center py-12">
              <p className="font-mono text-2xs text-compass-dim uppercase tracking-wider">
                Brak profili
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatItem({
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
      <Icon size={12} strokeWidth={1.5} className={color} />
      <span className="font-display text-sm font-semibold text-compass-text">{count}</span>
      <span className="font-mono text-2xs text-compass-dim">{label}</span>
    </div>
  )
}
