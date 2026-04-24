'use client'

import { useState, useTransition } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { updateCycle } from '@/app/actions/cycles'
import type { DbCycle } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'
import { calculateBands } from '@/lib/velocity/tolerance'

interface EditSprintButtonProps {
  cycle: DbCycle
}

export function EditSprintButton({ cycle }: EditSprintButtonProps) {
  const [open, setOpen] = useState(false)
  const [goal, setGoal] = useState(cycle.goal ?? '')
  const [velocity, setVelocity] = useState(cycle.velocity_planned?.toString() ?? '')
  const [tolerance, setTolerance] = useState((cycle.tolerance_percent ?? 20).toString())
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleOpenChange(v: boolean) {
    setOpen(v)
    if (v) {
      setGoal(cycle.goal ?? '')
      setVelocity(cycle.velocity_planned?.toString() ?? '')
      setTolerance((cycle.tolerance_percent ?? 20).toString())
    }
  }

  function handleSave() {
    if (goal.length > 500) {
      toast.error('Cel sprintu nie może przekraczać 500 znaków')
      return
    }
    const velocityNum = velocity.trim() ? parseInt(velocity, 10) : null
    if (velocityNum !== null && (isNaN(velocityNum) || velocityNum <= 0)) {
      toast.error('Velocity musi być liczbą całkowitą większą od 0')
      return
    }
    const toleranceNum = parseInt(tolerance, 10)
    if (isNaN(toleranceNum) || toleranceNum < 0 || toleranceNum > 100) {
      toast.error('Tolerancja musi być liczbą całkowitą od 0 do 100')
      return
    }

    startTransition(async () => {
      const { error } = await updateCycle(cycle.id, {
        goal: goal.trim() || null,
        velocity_planned: velocityNum,
        tolerance_percent: toleranceNum,
      })
      if (error) {
        toast.error(error)
      } else {
        toast.success('Sprint zaktualizowany')
        setOpen(false)
        router.refresh()
      }
    })
  }

  const velocityNum = parseInt(velocity, 10)
  const toleranceNum = parseInt(tolerance, 10)
  const previewBands =
    !isNaN(velocityNum) && velocityNum > 0 && !isNaN(toleranceNum) && toleranceNum >= 0
      ? calculateBands(velocityNum, toleranceNum)
      : null

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <button
          className="compass-btn-ghost p-1.5 rounded-[3px]"
          title="Edytuj cel i velocity sprintu"
        >
          <Pencil size={13} />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md compass-card p-6 flex flex-col gap-4 focus:outline-none">
          <Dialog.Title className="font-display text-lg text-compass-text">
            Edytuj sprint
          </Dialog.Title>

          <div className="flex flex-col gap-1.5">
            <label className="compass-label">Cel sprintu</label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Co chcemy osiągnąć w tym sprincie?"
              rows={3}
              maxLength={500}
              className="compass-input resize-none text-sm"
            />
            <span className={cn('font-mono text-2xs text-right', goal.length > 480 ? 'text-compass-warning' : 'text-compass-dim')}>
              {goal.length}/500
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="compass-label">Velocity planowane (liczba zadań)</label>
            <input
              type="number"
              min={1}
              value={velocity}
              onChange={(e) => setVelocity(e.target.value)}
              placeholder="np. 8"
              className="compass-input text-sm"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="compass-label">Tolerancja velocity (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={tolerance}
              onChange={(e) => setTolerance(e.target.value)}
              placeholder="20"
              className="compass-input text-sm"
            />
            {previewBands && (
              <p className="font-mono text-2xs text-compass-muted">
                <span className="text-compass-success">Zielona</span>{' '}
                {Math.round(previewBands.greenMin)}–{Math.round(previewBands.greenMax)} pkt
                {'  ·  '}
                <span className="text-compass-warning">Żółta</span>{' '}
                {Math.round(previewBands.yellowMin)}–{Math.round(previewBands.yellowMax)} pkt
                {'  ·  '}
                <span className="text-compass-danger">Czerwona</span>{' '}
                poza tymi widełkami
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Dialog.Close asChild>
              <button className="compass-btn-ghost px-3 py-1.5 text-sm">Anuluj</button>
            </Dialog.Close>
            <button
              onClick={handleSave}
              disabled={isPending}
              className="compass-btn-primary px-3 py-1.5 text-sm"
            >
              {isPending ? 'Zapisuję…' : 'Zapisz'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
