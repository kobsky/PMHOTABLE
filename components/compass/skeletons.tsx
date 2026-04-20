import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Base Skeleton block
// ---------------------------------------------------------------------------

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse bg-compass-surface-2 rounded-[3px]',
        className
      )}
    />
  )
}

// ---------------------------------------------------------------------------
// Page Header
// ---------------------------------------------------------------------------

export function PageHeaderSkeleton({
  withBadge = false,
  withActions = 0,
}: {
  withBadge?: boolean
  withActions?: number
}) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-compass-border bg-compass-bg flex-shrink-0">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-40" />
          {withBadge && <Skeleton className="h-4 w-20 rounded-[2px]" />}
        </div>
        <Skeleton className="h-3 w-56" />
      </div>
      {withActions > 0 && (
        <div className="flex items-center gap-2">
          {Array.from({ length: withActions }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24" />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Task card row (backlog / my-day)
// ---------------------------------------------------------------------------

export function TaskCardSkeleton() {
  return (
    <div className="compass-card px-3 py-2.5 flex items-center gap-3">
      <Skeleton className="w-1.5 h-1.5 rounded-full flex-shrink-0" />
      <Skeleton className="h-3.5 flex-1 max-w-xs" />
      <Skeleton className="h-3.5 w-16 ml-auto" />
      <Skeleton className="h-5 w-5 rounded-full flex-shrink-0" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Kanban column (board)
// ---------------------------------------------------------------------------

export function KanbanColumnSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="flex flex-col gap-2 flex-1 min-w-[220px]">
      <div className="flex items-center justify-between px-2 py-1.5">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-4 w-4 rounded-[2px]" />
      </div>
      <div className="flex flex-col gap-1.5">
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="compass-card p-3 flex flex-col gap-2">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3 w-3/4" />
            <div className="flex items-center gap-2 mt-0.5">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-4 w-4 rounded-full ml-auto" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// User / team card
// ---------------------------------------------------------------------------

export function TeamCardSkeleton() {
  return (
    <div className="compass-card p-4">
      <div className="flex items-center gap-3 mb-3">
        <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
        <div className="flex flex-col gap-1.5 flex-1">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3 w-44" />
        </div>
      </div>
      <div className="flex items-center gap-4 mb-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-18" />
      </div>
      <Skeleton className="h-1 w-full rounded-full" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Document row (decisions / weekly)
// ---------------------------------------------------------------------------

export function DocumentRowSkeleton() {
  return (
    <div className="px-4 py-3 border-b border-compass-border flex items-center gap-3">
      <div className="flex flex-col gap-1.5 flex-1">
        <Skeleton className="h-3.5 w-52" />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="h-5 w-12 rounded-[2px] flex-shrink-0" />
      <Skeleton className="h-3 w-16 flex-shrink-0" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Idea card
// ---------------------------------------------------------------------------

export function IdeaCardSkeleton() {
  return (
    <div className="compass-card p-3 flex flex-col gap-2">
      <Skeleton className="h-3.5 w-full" />
      <Skeleton className="h-3 w-4/5" />
      <div className="flex items-center gap-2 mt-1">
        <Skeleton className="h-5 w-16 rounded-[2px]" />
        <Skeleton className="h-5 w-12 rounded-[2px]" />
        <Skeleton className="h-3 w-10 ml-auto" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Goal row (OKR tree item)
// ---------------------------------------------------------------------------

export function GoalRowSkeleton({ indent = false }: { indent?: boolean }) {
  return (
    <div className={cn('compass-card p-3 flex flex-col gap-2', indent && 'ml-6')}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-3.5 w-48" />
        <Skeleton className="h-5 w-16 rounded-[2px]" />
      </div>
      <Skeleton className="h-1.5 w-full rounded-full" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-12 ml-auto" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Progress card (my-day)
// ---------------------------------------------------------------------------

export function ProgressCardSkeleton() {
  return (
    <div className="compass-card p-4 mb-6">
      <div className="flex items-center justify-between mb-2.5">
        <Skeleton className="h-3 w-36" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-1.5 w-full rounded-full mb-2.5" />
      <div className="flex items-center gap-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-14" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Gantt row
// ---------------------------------------------------------------------------

export function GanttRowSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-compass-border">
      <Skeleton className="h-3 w-32 flex-shrink-0" />
      <div className="flex-1 relative h-6">
        <Skeleton
          className={cn('h-full rounded-[3px] absolute', wide ? 'w-2/3 left-1/6' : 'w-1/3 left-1/4')}
        />
      </div>
    </div>
  )
}
