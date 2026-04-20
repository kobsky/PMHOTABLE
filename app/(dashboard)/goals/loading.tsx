import { Skeleton, PageHeaderSkeleton, GoalRowSkeleton } from '@/components/compass/skeletons'

export default function GoalsLoading() {
  return (
    <div className="flex flex-col h-screen">
      <PageHeaderSkeleton withActions={1} />
      <div className="flex-1 overflow-auto p-6">
        {/* Tab bar */}
        <div className="flex items-center gap-1 mb-4">
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-7 w-28" />
        </div>

        {/* OKR tree */}
        <div className="max-w-2xl flex flex-col gap-3">
          {/* Objective 1 */}
          <GoalRowSkeleton />
          <GoalRowSkeleton indent />
          <GoalRowSkeleton indent />

          {/* Objective 2 */}
          <GoalRowSkeleton />
          <GoalRowSkeleton indent />

          {/* Grant milestones section */}
          <div className="mt-4">
            <Skeleton className="h-3 w-28 mb-3" />
            <div className="flex flex-col gap-2">
              <GoalRowSkeleton />
              <GoalRowSkeleton />
              <GoalRowSkeleton />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
