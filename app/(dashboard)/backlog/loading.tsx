import { Skeleton, PageHeaderSkeleton, TaskCardSkeleton } from '@/components/compass/skeletons'

export default function BacklogLoading() {
  return (
    <div className="flex flex-col h-screen">
      <PageHeaderSkeleton />

      {/* Filter bar */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-compass-border">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-20 ml-auto" />
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-auto px-6 py-3">
        <div className="flex flex-col gap-1.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <TaskCardSkeleton key={i} />
          ))}
        </div>
      </div>

      {/* Quick add bar */}
      <div className="flex-shrink-0 px-6 py-3 border-t border-compass-border">
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  )
}
