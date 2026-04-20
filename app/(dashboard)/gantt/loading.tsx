import { Skeleton, PageHeaderSkeleton, GanttRowSkeleton } from '@/components/compass/skeletons'

export default function GanttLoading() {
  return (
    <div className="flex flex-col h-screen">
      <PageHeaderSkeleton />
      <div className="flex-1 overflow-auto p-6">
        {/* Month header */}
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="h-3 w-16 flex-shrink-0" />
          <div className="flex-1 flex gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-3 flex-1" />
            ))}
          </div>
        </div>

        {/* Gantt rows */}
        <div className="flex flex-col">
          <GanttRowSkeleton wide />
          <GanttRowSkeleton />
          <GanttRowSkeleton wide />
          <GanttRowSkeleton />
          <GanttRowSkeleton wide />
          <GanttRowSkeleton />
          <GanttRowSkeleton />
        </div>
      </div>
    </div>
  )
}
