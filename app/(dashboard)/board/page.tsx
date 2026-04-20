import { Suspense } from 'react'
import type { Metadata } from 'next'
import { getTasksForCycle, getProjects } from '@/app/actions/tasks'
import { getAllCycles, getCycleById, getActiveCycle } from '@/app/actions/cycles'
import { getAuthenticatedClient } from '@/lib/supabase/server'
import { getProfiles } from '@/app/actions/users'
import { SprintBoard } from '@/components/compass/sprint-board'
import { PageHeader } from '@/components/compass/page-header'
import { CloseSprintButton } from '@/components/compass/close-sprint-button'
import { EditSprintButton } from '@/components/compass/edit-sprint-button'
import { NewSprintModal } from '@/components/compass/new-sprint-modal'
import { CycleSelector } from '@/components/compass/cycle-selector'
import { KanbanColumnSkeleton } from '@/components/compass/skeletons'
import { formatShortDate } from '@/lib/utils'
import { Target } from 'lucide-react'
import type { DbCycle, DbProject, DbUser } from '@/lib/supabase/types'

export const metadata: Metadata = { title: 'Sprint Board' }

interface BoardPageProps {
  searchParams: Promise<{ cycleId?: string }>
}

// ---------------------------------------------------------------------------
// Async sub-component: fetches tasks and renders board (streamed in Suspense)
// ---------------------------------------------------------------------------

async function BoardContent({
  cycleId,
  projects,
  assigneeId,
  velocityPlanned,
  cycles,
  activeCycle,
}: {
  cycleId: string
  projects: DbProject[]
  assigneeId: string | null
  velocityPlanned: number | null
  cycles: DbCycle[]
  activeCycle: DbCycle | null
}) {
  const [tasks, profiles] = await Promise.all([
    getTasksForCycle(cycleId),
    getProfiles(),
  ])
  return (
    <SprintBoard
      initialTasks={tasks}
      cycleId={cycleId}
      projects={projects}
      profiles={profiles}
      cycles={cycles}
      assigneeId={assigneeId}
      velocityPlanned={velocityPlanned}
      activeCycle={activeCycle}
    />
  )
}

function BoardContentSkeleton() {
  return (
    <div className="flex gap-4 h-full">
      <KanbanColumnSkeleton cards={4} />
      <KanbanColumnSkeleton cards={2} />
      <KanbanColumnSkeleton cards={3} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function BoardPage({ searchParams }: BoardPageProps) {
  const { cycleId: paramCycleId } = await searchParams

  const [allCycles, activeCycle, projects, auth] = await Promise.all([
    getAllCycles(),
    getActiveCycle(),
    getProjects(),
    getAuthenticatedClient(),
  ])

  // Resolve which cycle to display: param > active > first in list
  let cycle: DbCycle | null = null
  if (paramCycleId) {
    cycle = await getCycleById(paramCycleId)
  }
  if (!cycle) {
    cycle = activeCycle
  }
  if (!cycle && allCycles.length > 0) {
    cycle = allCycles[0]
  }

  const nextSprintNumber = allCycles.length + 1
  const suggestedSprintName = `Sprint ${nextSprintNumber}`

  // No sprints at all — show empty state with "Start New Sprint" CTA
  if (!cycle) {
    return (
      <div className="flex flex-col h-screen">
        <PageHeader
          title="Sprint Board"
          actions={<NewSprintModal suggestedName={suggestedSprintName} />}
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="font-display text-5xl mb-3 text-compass-muted">✦</div>
            <p className="text-sm text-compass-muted mb-1">Brak sprintów</p>
            <p className="text-xs text-compass-dim mb-5">Utwórz pierwszy sprint, aby zacząć pracę.</p>
            <NewSprintModal
              suggestedName={suggestedSprintName}
              trigger={
                <button className="compass-btn-primary text-xs px-4 py-2">
                  Utwórz pierwszy sprint
                </button>
              }
            />
          </div>
        </div>
      </div>
    )
  }

  const isViewingActive = cycle.is_active

  return (
    <div className="flex flex-col h-screen">
      {/* Header renders immediately — no async data needed beyond cycle list */}
      <PageHeader
        title={cycle.name}
        badge={isViewingActive ? 'Aktywny sprint' : undefined}
        subtitle={`${formatShortDate(cycle.start_date)} — ${formatShortDate(cycle.end_date)}`}
        actions={
          <div className="flex items-center gap-2">
            {allCycles.length > 1 && (
              <CycleSelector
                cycles={allCycles}
                selectedCycleId={cycle.id}
              />
            )}
            <EditSprintButton cycle={cycle} />
            <NewSprintModal suggestedName={suggestedSprintName} />
            {isViewingActive && (
              <CloseSprintButton cycleId={cycle.id} cycleName={cycle.name} />
            )}
          </div>
        }
      />

      {cycle.goal && (
        <div className="flex items-start gap-2.5 px-6 py-3 bg-compass-surface/50 border-b border-compass-border">
          <Target size={13} className="text-compass-accent mt-0.5 flex-shrink-0" strokeWidth={1.5} />
          <p className="text-xs text-compass-muted">
            <span className="text-compass-dim font-mono uppercase tracking-wide text-2xs mr-2">Cel:</span>
            {cycle.goal}
          </p>
        </div>
      )}

      {!isViewingActive && (
        <div className="flex items-center gap-2 px-6 py-2 bg-compass-surface-2/60 border-b border-compass-border">
          <span className="font-mono text-2xs text-compass-muted uppercase tracking-wide">
            Podgląd archiwum — ten sprint nie jest aktywny
          </span>
        </div>
      )}

      {/* Board content streams in while header is visible */}
      <div className="flex-1 overflow-auto p-4 min-w-0">
        <div className="min-w-[700px] h-full">
          <Suspense fallback={<BoardContentSkeleton />}>
            <BoardContent
              cycleId={cycle.id}
              projects={projects}
              assigneeId={auth?.userId ?? null}
              velocityPlanned={cycle.velocity_planned}
              cycles={allCycles}
              activeCycle={cycle}
            />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
