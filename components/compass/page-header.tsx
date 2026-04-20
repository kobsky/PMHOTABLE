import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  subtitle?: string
  badge?: string
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({ title, subtitle, badge, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 px-6 py-3 border-b border-compass-border flex-shrink-0',
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="font-display text-lg font-semibold text-compass-text tracking-tight whitespace-nowrap">
            {title}
          </h1>
          {badge && (
            <span className="compass-badge compass-badge-accent">{badge}</span>
          )}
          {subtitle && (
            <span className="text-xs text-compass-dim hidden sm:inline">· {subtitle}</span>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
      )}
    </div>
  )
}
