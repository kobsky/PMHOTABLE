import type { Metadata } from 'next'
import Link from 'next/link'
import { getAllCycles } from '@/app/actions/cycles'
import { PageHeader } from '@/components/compass/page-header'
import { NewSprintModal } from '@/components/compass/new-sprint-modal'
import { DeleteSprintButton } from '@/components/compass/delete-sprint-button'
import { formatShortDate } from '@/lib/utils'
import { CheckCircle2, Archive, Zap, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Historia sprintów' }

export default async function SprintsPage() {
  const cycles = await getAllCycles()

  const active = cycles.filter((c) => c.is_active)
  const closed = cycles.filter((c) => !c.is_active)
  const nextSprintNumber = cycles.length + 1

  return (
    <div className="flex flex-col h-screen">
      <PageHeader
        title="Historia sprintów"
        subtitle={`${cycles.length} sprintów łącznie · ${closed.length} zamkniętych`}
        actions={<NewSprintModal suggestedName={`Sprint ${nextSprintNumber}`} />}
      />

      <div className="flex-1 overflow-auto p-6 space-y-8 max-w-3xl">
        {/* Empty state when no sprints at all */}
        {cycles.length === 0 && (
          <div className="text-center py-16">
            <div className="font-display text-4xl mb-3 text-compass-dim">✦</div>
            <p className="text-sm text-compass-muted mb-1">Brak sprintów</p>
            <p className="text-xs text-compass-dim mb-5">Utwórz pierwszy sprint, aby zacząć planowanie.</p>
            <NewSprintModal
              suggestedName="Sprint 1"
              trigger={
                <button className="compass-btn-primary text-xs px-4 py-2">
                  Utwórz pierwszy sprint
                </button>
              }
            />
          </div>
        )}

        {/* Active sprints */}
        {active.length > 0 && (
          <section>
            <h2 className="compass-label mb-3 flex items-center gap-2">
              <Zap size={11} className="text-compass-success" />
              Aktywny sprint
            </h2>
            <div className="flex flex-col gap-2">
              {active.map((c) => (
                <SprintRow key={c.id} cycle={c} isActive />
              ))}
            </div>
          </section>
        )}

        {/* Closed sprints */}
        {cycles.length > 0 && (
          <section>
            <h2 className="compass-label mb-3 flex items-center gap-2">
              <Archive size={11} className="text-compass-muted" />
              Zamknięte sprinty
            </h2>
            {closed.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-compass-border rounded-[4px]">
                <Archive size={20} className="text-compass-dim mx-auto mb-2" strokeWidth={1} />
                <p className="text-sm text-compass-muted">Brak zamkniętych sprintów</p>
                <p className="text-xs text-compass-dim mt-1">Zamknij sprint z widoku tablicy, aby pojawił się tutaj.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {closed.map((c) => (
                  <SprintRow key={c.id} cycle={c} isActive={false} />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}

function SprintRow({
  cycle,
  isActive,
}: {
  cycle: {
    id: string
    name: string
    start_date: string
    end_date: string
    goal?: string | null
    is_active: boolean
    velocity_planned?: number | null
    velocity_actual?: number | null
  }
  isActive: boolean
}) {
  const completionPct =
    cycle.velocity_planned && cycle.velocity_planned > 0
      ? Math.min(100, Math.round(((cycle.velocity_actual ?? 0) / cycle.velocity_planned) * 100))
      : null

  return (
    <div className="group relative flex items-stretch gap-0">
      <Link
        href={`/board?cycleId=${cycle.id}`}
        className="flex-1 compass-card p-4 hover:border-compass-border-strong transition-colors block"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {isActive ? (
                <span className="font-mono text-2xs px-1.5 py-0.5 rounded-[2px] bg-compass-success/15 text-compass-success">
                  Aktywny
                </span>
              ) : (
                <CheckCircle2 size={12} className="text-compass-dim flex-shrink-0" strokeWidth={1.5} />
              )}
              <h3 className="text-sm font-semibold text-compass-text truncate">{cycle.name}</h3>
            </div>

            {cycle.goal && (
              <p className="text-xs text-compass-muted truncate mb-2">{cycle.goal}</p>
            )}

            <div className="flex items-center gap-3">
              <span className="font-mono text-2xs text-compass-dim flex items-center gap-1">
                <Calendar size={9} />
                {formatShortDate(cycle.start_date)} — {formatShortDate(cycle.end_date)}
              </span>
            </div>
          </div>

          {/* Velocity stats */}
          <div className="flex-shrink-0 text-right">
            {cycle.velocity_actual != null || cycle.velocity_planned != null ? (
              <div>
                <p className="font-display text-lg font-semibold text-compass-text leading-none">
                  {cycle.velocity_actual ?? '—'}
                  <span className="text-compass-dim text-xs font-normal">/{cycle.velocity_planned ?? '—'}</span>
                </p>
                <p className="font-mono text-2xs text-compass-dim mt-0.5">velocity</p>
                {completionPct !== null && (
                  <div className="mt-1.5 w-20">
                    <div className="h-1 bg-compass-surface-2 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          completionPct >= 80 ? 'bg-compass-success' :
                          completionPct >= 50 ? 'bg-compass-accent' :
                          'bg-compass-warning'
                        )}
                        style={{ width: `${completionPct}%` }}
                      />
                    </div>
                    <p className="font-mono text-2xs text-compass-dim text-right mt-0.5">{completionPct}%</p>
                  </div>
                )}
              </div>
            ) : (
              <span className="font-mono text-2xs text-compass-dim">Brak danych</span>
            )}
          </div>
        </div>
      </Link>

      {/* Delete button — only for closed sprints */}
      {!isActive && (
        <div className="flex items-center pl-2">
          <DeleteSprintButton cycleId={cycle.id} cycleName={cycle.name} />
        </div>
      )}
    </div>
  )
}
