import { Skeleton, ProgressCardSkeleton, TaskCardSkeleton } from '@/components/compass/skeletons'

export default function MyDayLoading() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      {/* Hero greeting */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Skeleton className="h-3 w-48" />
        </div>
        <Skeleton className="h-8 w-64 mt-2" />
        <Skeleton className="h-4 w-80 mt-2" />
      </div>

      {/* Progress card */}
      <ProgressCardSkeleton />

      {/* Section: Aktywne */}
      <div className="mb-6">
        <Skeleton className="h-3 w-16 mb-2 mx-1" />
        <div className="flex flex-col gap-1.5">
          <TaskCardSkeleton />
          <TaskCardSkeleton />
        </div>
      </div>

      {/* Section: Na dziś */}
      <div className="mb-6">
        <Skeleton className="h-3 w-16 mb-2 mx-1" />
        <div className="flex flex-col gap-1.5">
          <TaskCardSkeleton />
          <TaskCardSkeleton />
          <TaskCardSkeleton />
        </div>
      </div>
    </div>
  )
}
