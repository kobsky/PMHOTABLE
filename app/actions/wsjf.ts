'use server'

// ============================================================
// app/actions/wsjf.ts — Server Actions dla SAFe WSJF (U5)
// ============================================================
// WSPOMAGANIE DECYZJI (decision support) — bez LLM, bez ML. Persystencja 4
// wejść WSJF na zadaniu oraz ranking liczony deterministycznie (lib/wsjf.ts).
// Logowanie do ai_feedback (feature='wsjf_prioritization') realizuje warstwa UI
// i rejestruje WYŁĄCZNIE surowe interakcje (apply/dismiss) — nie "skuteczność".
// ============================================================

import { z } from 'zod'
import { getAuthenticatedClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { computeWsjf, WSJF_FIBONACCI, type WsjfInputs } from '@/lib/wsjf'
import type { TaskWithRelations } from '@/lib/supabase/types'

// Supabase join select — zgodny z tasks.ts (zwraca TaskWithRelations).
const TASK_SELECT = `
  *,
  project:projects(*),
  assignee:profiles(*),
  subtasks:tasks!parent_task_id(*)
`

// Walidacja: każde wejście na skali Fibonacciego (modified Fibonacci SAFe),
// spójnej z CHECK w migracji 020 i ze stałą WSJF_FIBONACCI w lib/wsjf.ts.
const FibonacciValue = z
  .number()
  .int()
  .refine((v) => (WSJF_FIBONACCI as readonly number[]).includes(v), {
    message: `Nieprawidłowa wartość WSJF (dozwolone: ${WSJF_FIBONACCI.join(', ')})`,
  })

const WsjfInputsSchema = z.object({
  userValue: FibonacciValue,
  timeCriticality: FibonacciValue,
  riskReduction: FibonacciValue,
  jobSize: FibonacciValue.refine((v) => v > 0, {
    message: 'Job Size musi być dodatni',
  }),
})

/**
 * Zapisuje 4 wejścia WSJF na zadaniu (Tier 0 auth guard).
 * Nie liczy WSJF w bazie — wartość pochodna wyznacza getWsjfRanking / UI.
 */
export async function setWsjfInputs(
  taskId: string,
  inputs: WsjfInputs
): Promise<{ error: string | null }> {
  const parsed = WsjfInputsSchema.safeParse(inputs)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const auth = await getAuthenticatedClient()
  if (!auth) return { error: 'Brak autoryzacji' }

  const { error } = await auth.supabase
    .from('tasks')
    .update({
      wsjf_user_value: parsed.data.userValue,
      wsjf_time_criticality: parsed.data.timeCriticality,
      wsjf_risk_reduction: parsed.data.riskReduction,
      wsjf_job_size: parsed.data.jobSize,
    })
    .eq('id', taskId)
    .is('deleted_at', null)

  if (error) return { error: error.message }

  revalidatePath('/backlog')
  revalidatePath('/board')
  return { error: null }
}

export interface WsjfRankedTask {
  task: TaskWithRelations
  wsjf: number
}

/**
 * Zwraca aktywne zadania z kompletem 4 wejść WSJF, posortowane malejąco po
 * policzonym WSJF (najwyższy priorytet pierwszy). Zadania bez kompletu wejść
 * są pomijane (computeWsjf zwraca null). Sortowanie liczone w aplikacji —
 * WSJF jest wielkością pochodną, której nie persystujemy.
 */
export async function getWsjfRanking(): Promise<WsjfRankedTask[]> {
  const auth = await getAuthenticatedClient()
  if (!auth) return []

  const { data, error } = await auth.supabase
    .from('tasks')
    .select(TASK_SELECT)
    .neq('status', 'cancelled')
    .is('deleted_at', null)

  if (error) {
    console.error('getWsjfRanking:', error.message)
    return []
  }

  const tasks = (data ?? []) as unknown as TaskWithRelations[]

  const ranked: WsjfRankedTask[] = []
  for (const task of tasks) {
    const wsjf = computeWsjf({
      userValue: task.wsjf_user_value ?? undefined,
      timeCriticality: task.wsjf_time_criticality ?? undefined,
      riskReduction: task.wsjf_risk_reduction ?? undefined,
      jobSize: task.wsjf_job_size ?? undefined,
    })
    if (wsjf !== null) ranked.push({ task, wsjf })
  }

  ranked.sort((a, b) => b.wsjf - a.wsjf)
  return ranked
}
