import { PageHeaderSkeleton, KanbanColumnSkeleton } from '@/components/compass/skeletons'

export default function BoardLoading() {
  return (
    <div className="flex flex-col h-screen">
      <PageHeaderSkeleton withBadge withActions={2} />

      <div className="flex-1 overflow-auto p-4 min-w-0">
        <div className="min-w-[700px] h-full flex gap-4">
          <KanbanColumnSkeleton cards={4} />
          <KanbanColumnSkeleton cards={2} />
          <KanbanColumnSkeleton cards={3} />
        </div>
      </div>
    </div>
  )
}
