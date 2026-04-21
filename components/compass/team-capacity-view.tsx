import { cn } from '@/lib/utils'
import { calculateUsedCapacity, getLoadStatus, STORY_POINTS_LIMIT } from '@/lib/capacity'
import { SprintCapacityBar } from '@/components/compass/sprint-capacity-bar'
import type { DbCycle, DbUser, TaskWithRelations } from '@/lib/supabase/types'
import { Clock4, CheckCircle2, Circle, BarChart3 } from 'lucide-react'

interface TeamCapacityViewProps {
  profiles: DbUser[]
  allTasks: TaskWithRelations[]
  activeCycle: DbCycle | null
}

export function TeamCapacityView({ profiles, allTasks, activeCycle }: TeamCapacityViewProps) {
  const cycleTasks = activeCycle
    ? allTasks.filter((t) => t.cycle_id === activeCycle.id)
    : []

  const unassignedTasks = cycleTasks.filter(
    (t) => !t.assignee_id && t.status !== 'done' && t.status !== 'cancelled'
  )

  const teamData = profiles.map((profile) => {
    const allUserTasks = allTasks.filter((t) => t.assignee_id === profile.id)
    const inProgress = allUserTasks.filter((t) => t.status === 'in_progress').length
    const todo = allUserTasks.filter((t) => t.status === 'todo').length
    const done = allUserTasks.filter((t) => t.status === 'done').length
    const initial = (profile.full_name?.[0] ?? profile.email?.[0] ?? '?').toUpperCase()

    let capacityUsed = 0
    let loadStatus: 'ok' | 'warning' | 'danger' = 'ok'

    if (activeCycle) {
      const cycleUserTasks = cycleTasks.filter(
        (t) => t.assignee_id === profile.id && t.status !== 'done' && t.status !== 'cancelled'
      )
      capacityUsed = calculateUsedCapacity(cycleUserTasks)
      loadStatus = getLoadStatus(capacityUsed)
    }

    return { profile, inProgress, todo, done, allUserTasks, capacityUsed, loadStatus, initial }
  })

  const teamCapacityTotal = profiles.length * STORY_POINTS_LIMIT
  const totalUsed = teamData.reduce((s, m) => s + m.capacityUsed, 0)
  const utilization = teamCapacityTotal > 0 ? Math.round((totalUsed / teamCapacityTotal) * 100) : 0
  const totalUnassignedPts = calculateUsedCapacity(unassignedTasks)

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Capacity summary — only when sprint active */}
      {activeCycle ? (
        <div>
          <h2 className="text-sm font-semibold text-compass-text mb-3 flex items-center gap-2">
            <BarChart3 size={14} className="text-compass-accent" strokeWidth={1.5} />
            Pojemność sprintu — {activeCycle.name}
          </h2>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: 'Pojemność', value: `${totalUsed} / ${teamCapacityTotal}`, unit: 'story points' },
              { label: 'Wykorzystanie', value: `${utilization}%`, unit: `${profiles.length} × ${STORY_POINTS_LIMIT} pkt` },
              { label: 'Nieprzypisane', value: String(totalUnassignedPts), unit: 'pkt', warn: totalUnassignedPts > 0 },
            ].map(({ label, value, unit, warn }) => (
              <div key={label} className="p-3 border border-compass-border rounded bg-compass-surface">
                <div className="text-2xs text-compass-muted font-mono uppercase tracking-wide">{label}</div>
                <div className={cn('text-xl font-bold mt-1', warn && 'text-compass-warning')}>{value}</div>
                <div className="text-2xs text-compass-dim">{unit}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 p-3 border border-dashed border-compass-border rounded text-xs text-compass-dim">
          <BarChart3 size={13} strokeWidth={1.5} />
          Brak aktywnego sprintu — pojemność niedostępna
        </div>
      )}

      {/* Unified member rows */}
      <div className="space-y-3">
        {teamData.map(({ profile, inProgress, todo, done, allUserTasks, capacityUsed, loadStatus, initial }) => (
          <div key={profile.id} className="compass-card p-4">
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div className="w-9 h-9 rounded-full bg-compass-surface-3 border border-compass-border flex-shrink-0 flex items-center justify-center font-mono text-sm text-compass-muted uppercase font-medium">
                {initial}
              </div>

              <div className="flex-1 min-w-0">
                {/* Name + roles */}
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-compass-text">
                      {profile.full_name ?? profile.email?.split('@')[0] ?? 'Nieznany'}
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      {profile.email && (
                        <p className="font-mono text-2xs text-compass-dim">{profile.email}</p>
                      )}
                      {Array.isArray(profile.role) && profile.role.slice(0, 2).map((r) => (
                        <span key={r} className="font-mono text-2xs px-1 py-0.5 rounded-[2px] bg-compass-accent/10 text-compass-accent">
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Capacity badge (sprint only) */}
                  {activeCycle && (
                    <span className={cn(
                      'px-2 py-0.5 rounded text-xs font-semibold font-mono flex-shrink-0',
                      loadStatus === 'ok' && 'bg-compass-success/15 text-compass-success',
                      loadStatus === 'warning' && 'bg-compass-warning/15 text-compass-warning',
                      loadStatus === 'danger' && 'bg-compass-danger/15 text-compass-danger',
                    )}>
                      {capacityUsed} / {STORY_POINTS_LIMIT} pkt
                    </span>
                  )}
                </div>

                {/* Activity stats */}
                <div className="flex items-center gap-4 mt-2">
                  <StatItem icon={Clock4} color="text-compass-warning" count={inProgress} label="W toku" />
                  <StatItem icon={Circle} color="text-compass-muted" count={todo} label="Todo" />
                  <StatItem icon={CheckCircle2} color="text-compass-success" count={done} label="Gotowe" />
                  {inProgress >= 3 && (
                    <span className="ml-auto compass-badge compass-badge-danger text-2xs">WIP limit</span>
                  )}
                </div>

                {/* Progress bar */}
                {activeCycle ? (
                  <SprintCapacityBar
                    used={capacityUsed}
                    limit={STORY_POINTS_LIMIT}
                    showLabel={false}
                    className="mt-2"
                  />
                ) : (
                  <div className="mt-2 h-1 bg-compass-surface-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-compass-accent to-compass-success rounded-full"
                      style={{ width: allUserTasks.length > 0 ? `${(done / allUserTasks.length) * 100}%` : '0%' }}
                    />
                  </div>
                )}

                {/* Skills */}
                {Array.isArray(profile.skills) && profile.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {profile.skills.map((skill) => (
                      <span key={skill} className="font-mono text-2xs px-1.5 py-0.5 rounded-[2px] bg-compass-surface-3 text-compass-muted">
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {profiles.length === 0 && (
          <div className="text-center py-12">
            <p className="font-mono text-2xs text-compass-dim uppercase tracking-wider">Brak profili</p>
          </div>
        )}
      </div>

      {/* Unassigned tasks */}
      {activeCycle && unassignedTasks.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-compass-text mb-3">
            Nieprzypisane ({totalUnassignedPts.toFixed(1)} pkt)
          </h2>
          <div className="space-y-2">
            {unassignedTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-3 border border-compass-border rounded bg-compass-surface-2"
              >
                <span className="text-sm text-compass-text">{task.title}</span>
                <span className="font-mono text-xs text-compass-dim ml-4 flex-shrink-0">
                  {task.story_points ?? 3} pkt · {task.priority}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
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
