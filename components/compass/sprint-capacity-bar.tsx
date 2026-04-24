import { cn } from '@/lib/utils'
import { STORY_POINTS_LIMIT } from '@/lib/capacity'
import type { VelocityZone } from '@/lib/velocity/tolerance'

interface SprintCapacityBarProps {
  used: number
  limit?: number
  zone?: VelocityZone
  showLabel?: boolean
  className?: string
}

export function SprintCapacityBar({
  used,
  limit = STORY_POINTS_LIMIT,
  zone,
  showLabel = true,
  className,
}: SprintCapacityBarProps) {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0
  const overflow = used > limit

  const resolvedZone: VelocityZone = zone ?? (used > limit * 1.25 ? 'red' : used > limit ? 'yellow' : 'green')

  const color =
    resolvedZone === 'red'
      ? 'bg-compass-danger'
      : resolvedZone === 'yellow'
        ? 'bg-compass-warning'
        : 'bg-compass-success'

  const textColor =
    resolvedZone === 'red'
      ? 'text-compass-danger'
      : resolvedZone === 'yellow'
        ? 'text-compass-warning'
        : 'text-compass-success'

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center justify-between mb-1">
        {showLabel && (
          <span className="font-mono text-2xs text-compass-dim">
            {used} pkt / {limit} pkt
          </span>
        )}
        {overflow && (
          <span className={cn('font-mono text-2xs font-semibold', textColor)}>
            +{used - limit} pkt
          </span>
        )}
      </div>
      <div className="h-1.5 rounded-full bg-compass-surface-3 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-300', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
