export function GanttSkeleton() {
  return (
    <div className="p-4 space-y-4 flex-1">
      <div className="h-8 bg-compass-surface rounded animate-pulse w-64" />
      <div className="h-10 bg-compass-surface rounded animate-pulse" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-9 bg-compass-surface-2 rounded animate-pulse" style={{ opacity: 1 - i * 0.08 }} />
        ))}
      </div>
    </div>
  )
}
