import { Skeleton, PageHeaderSkeleton } from '@/components/compass/skeletons'

export default function WsjfLoading() {
  return (
    <div className="flex flex-col h-screen">
      <PageHeaderSkeleton />
      <div className="flex-1 overflow-auto p-6">
        {/* Banner ograniczeń */}
        <Skeleton className="h-28 w-full max-w-3xl mb-6" />
        {/* Lista rankingowa */}
        <div className="max-w-3xl flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}
