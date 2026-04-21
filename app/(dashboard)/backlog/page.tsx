import { Suspense } from 'react'
import type { Metadata } from 'next'
import { getAllTasksWithRelations, getProjects } from '@/app/actions/tasks'
import { getAllCycles, getActiveCycle } from '@/app/actions/cycles'
import { getAuthenticatedClient } from '@/lib/supabase/server'
import { getProfiles } from '@/app/actions/users'
import { BacklogView } from '@/components/compass/backlog-view'
import { PageHeader } from '@/components/compass/page-header'
import { QuickAddTask } from '@/components/compass/quick-add-task'
import { TaskCardSkeleton, Skeleton } from '@/components/compass/skeletons'

export const metadata: Metadata = { title: 'Backlog' }

// ---------------------------------------------------------------------------
// Async sub-component: fetches tasks and renders list (streamed in Suspense)
// ---------------------------------------------------------------------------

async function BacklogContent({ initialCycleId }: { initialCycleId?: string }) {
  const [tasks, projects, cycles, profiles] = await Promise.all([
    getAllTasksWithRelations(),
    getProjects(),
    getAllCycles(),
    getProfiles(),
  ])
  return <BacklogView tasks={tasks} projects={projects} profiles={profiles} cycles={cycles} initialCycleId={initialCycleId} />
}

function BacklogContentSkeleton() {
  return (
    <div className="flex flex-col gap-1.5 px-6 py-3">
      {/* Filter bar skeleton */}
      <div className="flex items-center gap-2 pb-3 border-b border-compass-border mb-1">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-28" />
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <TaskCardSkeleton key={i} />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function BacklogPage() {
  const [projects, cycle, auth] = await Promise.all([
    getProjects(),
    getActiveCycle(),
    getAuthenticatedClient(),
  ])

  return (
    <div className="flex flex-col h-screen">
      {/* Header renders immediately */}
      <PageHeader
        title="Backlog"
        subtitle="Wszystkie zadania"
      />

      {/* Task list streams in */}
      <div className="flex-1 overflow-auto">
        <Suspense fallback={<BacklogContentSkeleton />}>
          <BacklogContent initialCycleId={cycle?.id} />
        </Suspense>
      </div>

      {/* Quick add bar renders immediately */}
      <div className="flex-shrink-0 px-6 py-3 border-t border-compass-border bg-compass-bg">
        <QuickAddTask
          projects={projects}
          assigneeId={auth?.userId ?? null}
          cycleId={cycle?.id ?? null}
        />
      </div>
    </div>
  )
}
