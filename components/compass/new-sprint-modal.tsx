'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import * as Dialog from '@radix-ui/react-dialog'
import { toast } from 'sonner'
import { Plus, X, Loader2, CalendarDays } from 'lucide-react'
import { createCycle, type CreateCycleInput } from '@/app/actions/cycles'

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function today(): string {
  return new Date().toISOString().split('T')[0]
}

interface NewSprintModalProps {
  /** If provided, renders a custom trigger instead of the default button */
  trigger?: React.ReactNode
  /** Pre-fill the sprint name field (e.g. "Sprint 1") */
  suggestedName?: string
}

export function NewSprintModal({ trigger, suggestedName }: NewSprintModalProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const defaultStart = today()
  const defaultEnd = addDays(defaultStart, 13) // 2 weeks

  const [form, setForm] = useState<{
    name: string
    start_date: string
    end_date: string
    goal: string
    velocity_planned: string
  }>({
    name: suggestedName ?? '',
    start_date: defaultStart,
    end_date: defaultEnd,
    goal: '',
    velocity_planned: '',
  })

  const [fieldError, setFieldError] = useState<string | null>(null)

  function handleStartDateChange(val: string) {
    setForm((f) => ({
      ...f,
      start_date: val,
      // Auto-update end date to keep 14-day window if user hasn't manually changed it
      end_date: addDays(val, 13),
    }))
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      // Reset form on close
      setForm({
        name: suggestedName ?? '',
        start_date: today(),
        end_date: addDays(today(), 13),
        goal: '',
        velocity_planned: '',
      })
      setFieldError(null)
    }
    setOpen(next)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldError(null)

    const input: CreateCycleInput = {
      name: form.name.trim(),
      start_date: form.start_date,
      end_date: form.end_date,
      goal: form.goal.trim() || null,
      velocity_planned: form.velocity_planned ? Number(form.velocity_planned) : null,
    }

    startTransition(async () => {
      const { error } = await createCycle(input)
      if (error) {
        setFieldError(error)
        return
      }
      toast.success('Sprint utworzony', {
        description: input.name,
      })
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        {trigger ?? (
          <button className="compass-btn-primary text-xs flex items-center gap-1.5">
            <Plus size={13} strokeWidth={2} />
            Nowy sprint
          </button>
        )}
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-40 animate-in fade-in-0 duration-150" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md"
          aria-describedby={undefined}
        >
          <div className="compass-card border border-compass-border shadow-2xl p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <Dialog.Title className="font-display text-lg text-compass-text">
                Nowy sprint
              </Dialog.Title>
              <Dialog.Close className="compass-btn-ghost p-1 rounded-[2px]">
                <X size={15} />
              </Dialog.Close>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <label className="compass-label">Nazwa *</label>
                <input
                  className="compass-input"
                  placeholder="np. Sprint 5 — Ideas & Decisions"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  disabled={isPending}
                />
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="compass-label flex items-center gap-1">
                    <CalendarDays size={10} />
                    Start *
                  </label>
                  <input
                    type="date"
                    className="compass-input font-mono text-xs"
                    value={form.start_date}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    required
                    disabled={isPending}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="compass-label flex items-center gap-1">
                    <CalendarDays size={10} />
                    Koniec *
                  </label>
                  <input
                    type="date"
                    className="compass-input font-mono text-xs"
                    value={form.end_date}
                    min={form.start_date}
                    onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                    required
                    disabled={isPending}
                  />
                </div>
              </div>

              {/* Goal */}
              <div className="flex flex-col gap-1.5">
                <label className="compass-label">Cel sprintu</label>
                <textarea
                  className="compass-input resize-none"
                  rows={2}
                  placeholder="Co chcemy osiągnąć w tym sprincie?"
                  value={form.goal}
                  onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))}
                  disabled={isPending}
                />
              </div>

              {/* Velocity planned */}
              <div className="flex flex-col gap-1.5">
                <label className="compass-label">PLANOWANA POJEMNOŚĆ (STORY POINTS)</label>
                <input
                  type="number"
                  min={20}
                  max={50}
                  className="compass-input font-mono"
                  placeholder="np. 36 (3 osoby × 12 pkt)"
                  value={form.velocity_planned}
                  onChange={(e) => setForm((f) => ({ ...f, velocity_planned: e.target.value }))}
                  disabled={isPending}
                />
                {form.velocity_planned && (Number(form.velocity_planned) < 20 || Number(form.velocity_planned) > 50) && (
                  <p className="text-xs text-compass-warning">Pojemność musi wynosić 20–50 story points</p>
                )}
              </div>

              {/* Error */}
              {fieldError && (
                <p className="text-xs text-compass-danger">{fieldError}</p>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-1">
                <Dialog.Close
                  className="compass-btn-ghost text-xs"
                  disabled={isPending}
                >
                  Anuluj
                </Dialog.Close>
                <button
                  type="submit"
                  disabled={isPending || !form.name.trim()}
                  className="compass-btn-primary text-xs flex items-center gap-1.5"
                >
                  {isPending && <Loader2 size={12} className="animate-spin" />}
                  Utwórz sprint
                </button>
              </div>
            </form>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
