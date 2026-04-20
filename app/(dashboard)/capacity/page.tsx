'use client'

import { useEffect, useState } from 'react'
import type { DbCycle, DbUser, TaskWithRelations } from '@/lib/supabase/types'
import { getActiveCycle } from '@/app/actions/cycles'
import { getTasksForCycle } from '@/app/actions/tasks'
import { getTeamMembers } from '@/app/actions/team'
import { calculateUsedCapacity, calculateEffectiveCapacity, getLoadStatus } from '@/lib/capacity'
import { cn } from '@/lib/utils'
import { BarChart3 } from 'lucide-react'

export default function CapacityPage() {
  const [cycle, setCycle] = useState<DbCycle | null>(null)
  const [team, setTeam] = useState<DbUser[]>([])
  const [tasks, setTasks] = useState<TaskWithRelations[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getActiveCycle(), getTeamMembers()])
      .then(([activeCycle, members]) => {
        setCycle(activeCycle)
        setTeam(members)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (cycle) {
      getTasksForCycle(cycle.id).then(setTasks)
    }
  }, [cycle])

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 bg-compass-surface rounded animate-pulse w-64" />
        <div className="h-48 bg-compass-surface-2 rounded animate-pulse" />
      </div>
    )
  }

  if (!cycle) {
    return (
      <div className="p-6 flex flex-col items-center justify-center py-24 gap-4">
        <BarChart3 size={32} className="text-compass-muted/40" strokeWidth={1} />
        <div className="text-center">
          <p className="text-sm font-medium text-compass-muted">Brak aktywnego sprintu</p>
          <p className="text-xs text-compass-dim mt-1">Utwórz i aktywuj sprint, aby zobaczyć planowanie pojemności</p>
        </div>
      </div>
    )
  }

  const unassignedTasks = tasks.filter((t) => !t.assignee_id && t.status !== 'done' && t.status !== 'cancelled')
  const totalUnassignedPts = calculateUsedCapacity(unassignedTasks)

  const teamCapacities = team.map((profile) => {
    const assignedTasks = tasks.filter(
      (t) => t.assignee_id === profile.id && t.status !== 'done' && t.status !== 'cancelled'
    )
    const used = calculateUsedCapacity(assignedTasks)
    const effective = calculateEffectiveCapacity(profile, cycle)
    const status = getLoadStatus(used, effective)
    return { profile, used, effective, status, assignedTasks }
  })

  const totalCapacity = teamCapacities.reduce((s, m) => s + m.effective, 0)
  const totalUsed = teamCapacities.reduce((s, m) => s + m.used, 0)
  const utilization = totalCapacity > 0 ? Math.round((totalUsed / totalCapacity) * 100) : 0

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-compass-text">Planowanie pojemności</h1>
        <p className="text-sm text-compass-muted mt-1">{cycle.name}</p>
      </div>

      {/* Team totals */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pojemność', value: totalCapacity.toFixed(1), unit: 'pkt' },
          { label: 'Wykorzystane', value: totalUsed.toFixed(1), unit: `${utilization}%` },
          { label: 'Nieprzypisane', value: totalUnassignedPts.toFixed(1), unit: 'pkt', warn: totalUnassignedPts > 0 },
        ].map(({ label, value, unit, warn }) => (
          <div key={label} className="p-4 border border-compass-border rounded bg-compass-surface">
            <div className="text-xs text-compass-muted font-mono uppercase tracking-wide">{label}</div>
            <div className={cn('text-2xl font-bold mt-1', warn && 'text-compass-warning')}>
              {value}
            </div>
            <div className="text-xs text-compass-dim">{unit}</div>
          </div>
        ))}
      </div>

      {/* Per-person workload */}
      <div>
        <h2 className="text-base font-semibold text-compass-text mb-3">Obciążenie zespołu</h2>
        <div className="space-y-3">
          {teamCapacities.map(({ profile, used, effective, status, assignedTasks }) => {
            const pct = effective > 0 ? Math.min((used / effective) * 100, 100) : 0
            return (
              <div key={profile.id} className="p-4 border border-compass-border rounded bg-compass-surface">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-semibold text-sm text-compass-text">
                      {profile.full_name ?? profile.email ?? 'Nieznany'}
                    </span>
                    {profile.role && profile.role.length > 0 && (
                      <span className="ml-2 text-xs text-compass-dim">{profile.role[0]}</span>
                    )}
                  </div>
                  <span
                    className={cn(
                      'px-2.5 py-1 rounded text-xs font-semibold font-mono',
                      status === 'ok' && 'bg-compass-success/15 text-compass-success',
                      status === 'warning' && 'bg-compass-warning/15 text-compass-warning',
                      status === 'danger' && 'bg-compass-danger/15 text-compass-danger'
                    )}
                  >
                    {used.toFixed(1)} / {effective.toFixed(1)} pkt
                  </span>
                </div>

                <div className="w-full h-1.5 bg-compass-surface-2 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      status === 'ok' && 'bg-compass-success',
                      status === 'warning' && 'bg-compass-warning',
                      status === 'danger' && 'bg-compass-danger'
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="mt-1.5 text-xs text-compass-dim">
                  {assignedTasks.length} zadań przypisanych
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Unassigned tasks */}
      {unassignedTasks.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-compass-text mb-3">
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
                  {task.size ?? 'M'} · {task.priority}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
