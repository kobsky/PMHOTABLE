'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { toast } from 'sonner'
import { ChevronDown, Check, Zap, Clock } from 'lucide-react'
import { activateCycle } from '@/app/actions/cycles'
import { formatShortDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { DbCycle } from '@/lib/supabase/types'

interface CycleSelectorProps {
  cycles: DbCycle[]
  selectedCycleId: string
}

export function CycleSelector({ cycles, selectedCycleId }: CycleSelectorProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const selected = cycles.find((c) => c.id === selectedCycleId)

  function selectCycle(cycleId: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('cycleId', cycleId)
    router.push(`/board?${params.toString()}`)
  }

  function handleActivate(cycle: DbCycle) {
    if (cycle.is_active) return
    startTransition(async () => {
      const { error } = await activateCycle(cycle.id)
      if (error) {
        toast.error('Nie udało się aktywować sprintu', { description: error })
      } else {
        toast.success(`Sprint "${cycle.name}" jest teraz aktywny`)
        router.refresh()
      }
    })
  }

  if (!selected) return null

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-[3px] border text-xs transition-colors',
            'border-compass-border bg-compass-surface hover:bg-compass-surface-2',
            'text-compass-text focus:outline-none focus:ring-1 focus:ring-compass-accent/40',
            isPending && 'opacity-50 pointer-events-none'
          )}
        >
          {selected.is_active && (
            <Zap size={10} className="text-compass-accent flex-shrink-0" strokeWidth={2} />
          )}
          <span className="font-mono max-w-[180px] truncate">{selected.name}</span>
          <ChevronDown size={11} className="text-compass-muted flex-shrink-0" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-50 min-w-[260px] bg-compass-surface border border-compass-border rounded-[4px] shadow-xl p-1"
          align="start"
          sideOffset={4}
        >
          <p className="compass-label px-2 py-1.5 mb-0.5">Sprinty</p>

          {cycles.map((cycle) => {
            const isSelected = cycle.id === selectedCycleId
            return (
              <DropdownMenu.Item
                key={cycle.id}
                onSelect={() => selectCycle(cycle.id)}
                className={cn(
                  'flex items-center gap-2 px-2 py-2 rounded-[3px] text-xs cursor-pointer outline-none',
                  'hover:bg-compass-surface-2 focus:bg-compass-surface-2',
                  isSelected ? 'text-compass-text' : 'text-compass-muted'
                )}
              >
                {/* Status icon */}
                <span className="w-4 flex-shrink-0 flex items-center justify-center">
                  {cycle.is_active ? (
                    <Zap size={10} className="text-compass-accent" strokeWidth={2} />
                  ) : (
                    <Clock size={10} className="text-compass-dim" strokeWidth={1.5} />
                  )}
                </span>

                {/* Name + dates */}
                <span className="flex-1 min-w-0">
                  <span className="block truncate">{cycle.name}</span>
                  <span className="font-mono text-2xs text-compass-dim block">
                    {formatShortDate(cycle.start_date)} — {formatShortDate(cycle.end_date)}
                  </span>
                </span>

                {/* Selected check */}
                {isSelected && (
                  <Check size={11} className="text-compass-accent flex-shrink-0" />
                )}
              </DropdownMenu.Item>
            )
          })}

          {/* Activate section for non-active cycles */}
          {selected && !selected.is_active && (
            <>
              <DropdownMenu.Separator className="my-1 h-px bg-compass-border" />
              <DropdownMenu.Item
                onSelect={() => handleActivate(selected)}
                className="flex items-center gap-2 px-2 py-2 rounded-[3px] text-xs cursor-pointer outline-none text-compass-accent hover:bg-compass-accent/10 focus:bg-compass-accent/10"
              >
                <Zap size={10} strokeWidth={2} />
                Aktywuj ten sprint
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
