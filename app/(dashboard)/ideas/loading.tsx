import { Skeleton, PageHeaderSkeleton, IdeaCardSkeleton } from '@/components/compass/skeletons'

export default function IdeasLoading() {
  return (
    <div className="flex flex-col h-screen">
      <PageHeaderSkeleton withActions={1} />

      {/* Status columns */}
      <div className="flex-1 overflow-auto p-4">
        <div className="flex gap-4 min-w-[600px]">
          {/* Inbox column */}
          <div className="flex flex-col gap-2 flex-1">
            <div className="flex items-center justify-between px-1 py-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-6 rounded-[2px]" />
            </div>
            <IdeaCardSkeleton />
            <IdeaCardSkeleton />
            <IdeaCardSkeleton />
          </div>
          {/* Accepted column */}
          <div className="flex flex-col gap-2 flex-1">
            <div className="flex items-center justify-between px-1 py-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-6 rounded-[2px]" />
            </div>
            <IdeaCardSkeleton />
            <IdeaCardSkeleton />
          </div>
          {/* Rejected column */}
          <div className="flex flex-col gap-2 flex-1">
            <div className="flex items-center justify-between px-1 py-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-6 rounded-[2px]" />
            </div>
            <IdeaCardSkeleton />
          </div>
        </div>
      </div>
    </div>
  )
}
