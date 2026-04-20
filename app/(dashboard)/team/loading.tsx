import { PageHeaderSkeleton, TeamCardSkeleton } from '@/components/compass/skeletons'

export default function TeamLoading() {
  return (
    <div className="flex flex-col h-screen">
      <PageHeaderSkeleton withBadge />
      <div className="flex-1 overflow-auto p-6">
        <div className="grid gap-3 max-w-2xl">
          <TeamCardSkeleton />
          <TeamCardSkeleton />
          <TeamCardSkeleton />
        </div>
      </div>
    </div>
  )
}
