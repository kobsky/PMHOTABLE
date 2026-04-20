'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, CheckSquare, X, Archive, AlertTriangle } from 'lucide-react'
import { closeCycle } from '@/app/actions/cycles'

interface CloseSprintButtonProps {
  cycleId: string
  cycleName: string
}

export function CloseSprintButton({ cycleId, cycleName }: CloseSprintButtonProps) {
  const [open, setOpen] = useState(false)
  const [moveToBacklog, setMoveToBacklog] = useState(true)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleConfirm() {
    startTransition(async () => {
      const { error } = await closeCycle(cycleId, { moveIncompleteToBacklog: moveToBacklog })
      if (error) {
        toast.error('Nie udało się zamknąć sprintu', { description: error })
      } else {
        toast.success(`Sprint "${cycleName}" zamknięty`, {
          description: moveToBacklog ? 'Nieukończone zadania przeniesione do backlogu.' : undefined,
        })
        setOpen(false)
        router.push('/backlog')
      }
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="compass-btn-outline text-xs flex items-center gap-1.5"
      >
        <CheckSquare size={12} strokeWidth={1.5} />
        Zamknij sprint
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget && !isPending) setOpen(false) }}
        >
          <div className="w-full max-w-sm mx-4 compass-card border border-compass-border shadow-2xl animate-fade-in">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 p-5 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-[4px] bg-compass-warning/10 border border-compass-warning/20">
                  <AlertTriangle size={14} className="text-compass-warning" strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-compass-text">Zamknij sprint</h2>
                  <p className="text-2xs text-compass-muted font-mono mt-0.5 truncate max-w-[180px]">{cycleName}</p>
                </div>
              </div>
              <button
                onClick={() => !isPending && setOpen(false)}
                className="compass-btn-ghost p-1 rounded-[2px] text-compass-muted hover:text-compass-text flex-shrink-0"
              >
                <X size={14} />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 pb-4 space-y-4">
              <p className="text-xs text-compass-muted leading-relaxed">
                Sprint zostanie oznaczony jako ukończony, a velocity zostanie obliczone na podstawie
                liczby zadań ze statusem <span className="text-compass-success font-mono">gotowe</span>.
              </p>

              {/* Move to backlog toggle */}
              <label className="flex items-start gap-3 p-3 rounded-[4px] bg-compass-surface-2 border border-compass-border cursor-pointer hover:border-compass-border-strong transition-colors">
                <div className="flex-shrink-0 mt-0.5">
                  <div
                    className={`w-4 h-4 rounded-[3px] border flex items-center justify-center transition-colors ${
                      moveToBacklog
                        ? 'bg-compass-accent border-compass-accent'
                        : 'bg-transparent border-compass-border-strong'
                    }`}
                    onClick={() => setMoveToBacklog((v) => !v)}
                  >
                    {moveToBacklog && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <Archive size={11} className="text-compass-muted" strokeWidth={1.5} />
                    <span className="text-xs font-medium text-compass-text">Przenieś nieukończone do backlogu</span>
                  </div>
                  <p className="text-2xs text-compass-muted mt-0.5">
                    Zadania todo, w toku i review zostaną odłączone od sprintu.
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={moveToBacklog}
                  onChange={(e) => setMoveToBacklog(e.target.checked)}
                />
              </label>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-compass-border">
              <button
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="compass-btn-ghost text-xs px-3 py-1.5"
              >
                Anuluj
              </button>
              <button
                onClick={handleConfirm}
                disabled={isPending}
                className="compass-btn-danger text-xs flex items-center gap-1.5 px-3 py-1.5"
              >
                {isPending ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <CheckSquare size={12} strokeWidth={1.5} />
                )}
                {isPending ? 'Zamykanie…' : 'Zamknij sprint'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
