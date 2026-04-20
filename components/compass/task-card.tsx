import { cn, formatRelativeDate, getPriorityLabel, scopeColor } from '@/lib/utils'
import type { TaskWithRelations, UnavailabilityEntry, DbUser } from '@/lib/supabase/types'
import { Calendar, ChevronRight, CheckCircle2, Circle, Clock4, Ban } from 'lucide-react'

interface TaskCardProps {
  task: TaskWithRelations
  compact?: boolean
  dragging?: boolean
  className?: string
  unavailability?: Record<string, UnavailabilityEntry[]>
  profiles?: DbUser[]
}

export function TaskCard({ task, compact = false, dragging = false, className, unavailability, profiles = [] }: TaskCardProps) {
  const priorityColors: Record<string, string> = {
    low:    'bg-compass-dim',
    medium: 'bg-compass-muted',
    high:   'bg-compass-warning',
    urgent: 'bg-compass-danger',
  }

  const StatusIcon = {
    todo:        Circle,
    in_progress: Clock4,
    in_review:   Clock4,
    done:        CheckCircle2,
    cancelled:   Ban,
  }[task.status] ?? Circle

  const statusIconColor = {
    todo:        'text-compass-dim',
    in_progress: 'text-compass-warning',
    in_review:   'text-compass-accent',
    done:        'text-compass-success',
    cancelled:   'text-compass-danger',
  }[task.status] ?? 'text-compass-dim'

  const projectColor = scopeColor(task.project?.scope_tag ?? '')

  const isOverdue =
    task.due_date &&
    task.status !== 'done' &&
    task.status !== 'cancelled' &&
    new Date(task.due_date) < new Date()

  const isUnavailable = !!(
    task.assignee_id &&
    unavailability?.[task.assignee_id]?.length
  )

  const hasRaci = !!(
    task.raci &&
    (task.raci.responsible || task.raci.accountable.length > 0)
  )

  return (
    <div
      className={cn(
        'compass-card group relative task-card-interactive',
        dragging && 'shadow-lg shadow-black/40 rotate-[0.5deg] scale-[1.02]',
        isUnavailable && 'opacity-60 border-compass-warning',
        compact ? 'p-2.5' : 'p-3',
        className
      )}
    >
      {/* Pasek projektu — lewa krawędź */}
      <div
        className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r-full opacity-70"
        style={{ backgroundColor: projectColor }}
      />

      <div className="pl-2.5">
        {/* Header */}
        <div className="flex items-start gap-2">
          <StatusIcon
            size={13}
            strokeWidth={1.5}
            className={cn('flex-shrink-0 mt-0.5', statusIconColor)}
          />
          <p
            className={cn(
              'flex-1 text-sm font-medium leading-snug',
              task.status === 'done' && 'line-through text-compass-muted',
              task.status === 'cancelled' && 'line-through text-compass-dim'
            )}
          >
            {task.title}
          </p>
        </div>

        {!compact && task.description && (
          <p className="mt-1.5 text-xs text-compass-muted leading-relaxed line-clamp-2 pl-5">
            {task.description}
          </p>
        )}

        {/* Meta */}
        <div className="flex items-center gap-2 mt-2 pl-5">
          {/* Priority dot */}
          <span
            className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', priorityColors[task.priority])}
            title={getPriorityLabel(task.priority)}
          />

          {/* Project */}
          {task.project?.name && (
            <span
              className="font-mono text-2xs"
              style={{ color: projectColor }}
            >
              {task.project.name}
            </span>
          )}

          {/* Spacer */}
          <span className="flex-1" />

          {/* Size badge */}
          {task.size && task.size !== 'M' && (
            <span className="font-mono text-2xs text-compass-dim border border-compass-border px-1 rounded-[2px] leading-none py-px">
              {task.size}
            </span>
          )}

          {/* RACI compact */}
          {hasRaci && (() => {
            const roles = [
              { key: 'R', ids: task.raci!.responsible ? [task.raci!.responsible] : [] },
              { key: 'A', ids: task.raci!.accountable },
              { key: 'C', ids: task.raci!.consulted },
              { key: 'I', ids: task.raci!.informed },
            ].filter(r => r.ids.length > 0)
            return (
              <div className="flex items-center gap-2">
                {roles.map(({ key, ids }) => (
                  <div key={key} className="flex items-center gap-0.5">
                    <span className={cn(
                      'font-mono text-[10px] font-semibold',
                      key === 'R' ? 'text-compass-accent' : 'text-compass-dim'
                    )}>{key}</span>
                    {ids.slice(0, 2).map(id => {
                      const p = profiles.find(p => p.id === id)
                      const initial = (p?.full_name?.[0] ?? p?.email?.[0] ?? '?').toUpperCase()
                      return (
                        <span
                          key={id}
                          className={cn(
                            'w-3.5 h-3.5 rounded-full flex items-center justify-center font-mono text-[9px] flex-shrink-0',
                            key === 'R'
                              ? 'bg-compass-accent/20 border border-compass-accent/50 text-compass-accent'
                              : 'bg-compass-surface-3 border border-compass-border text-compass-muted'
                          )}
                          title={p?.full_name ?? p?.email ?? id}
                        >
                          {initial}
                        </span>
                      )
                    })}
                  </div>
                ))}
              </div>
            )
          })()}

          {/* Subtasks count */}
          {task.subtasks?.length > 0 && (
            <span className="flex items-center gap-0.5 font-mono text-2xs text-compass-dim">
              <ChevronRight size={10} />
              {task.subtasks.length}
            </span>
          )}

          {/* Due date */}
          {task.due_date && (
            <span
              className={cn(
                'flex items-center gap-1 font-mono text-2xs',
                isOverdue ? 'text-compass-danger' : 'text-compass-dim'
              )}
            >
              <Calendar size={10} />
              {formatRelativeDate(task.due_date)}
            </span>
          )}

        </div>
      </div>
    </div>
  )
}
