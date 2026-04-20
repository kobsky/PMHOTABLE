'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import * as Dialog from '@radix-ui/react-dialog'
import { toast } from 'sonner'
import { Trash2, X, Loader2 } from 'lucide-react'
import { deleteCycle } from '@/app/actions/cycles'

interface DeleteSprintButtonProps {
  cycleId: string
  cycleName: string
}

export function DeleteSprintButton({ cycleId, cycleName }: DeleteSprintButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      const { error } = await deleteCycle(cycleId)
      if (error) {
        toast.error(error)
        setOpen(false)
        return
      }
      toast.success(`Sprint usunięty`, { description: cycleName })
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-[2px] text-compass-muted hover:text-compass-danger hover:bg-compass-danger/10"
          title="Usuń sprint"
        >
          <Trash2 size={13} strokeWidth={1.5} />
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-40 animate-in fade-in-0 duration-150" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm"
          aria-describedby="delete-sprint-desc"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="compass-card border border-compass-border shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="font-display text-base text-compass-text">
                Usuń sprint
              </Dialog.Title>
              <Dialog.Close className="compass-btn-ghost p-1 rounded-[2px]" disabled={isPending}>
                <X size={14} />
              </Dialog.Close>
            </div>

            <Dialog.Description id="delete-sprint-desc" className="text-sm text-compass-muted mb-5">
              Czy na pewno chcesz usunąć{' '}
              <span className="text-compass-text font-medium">{cycleName}</span>?{' '}
              Tej operacji nie można cofnąć.
            </Dialog.Description>

            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <button
                  className="compass-btn-ghost text-xs px-3 py-1.5"
                  disabled={isPending}
                >
                  Anuluj
                </button>
              </Dialog.Close>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="text-xs px-3 py-1.5 rounded-[3px] bg-compass-danger/15 text-compass-danger hover:bg-compass-danger/25 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {isPending && <Loader2 size={11} className="animate-spin" />}
                Usuń sprint
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
