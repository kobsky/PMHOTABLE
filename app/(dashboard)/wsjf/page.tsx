import type { Metadata } from 'next'
import { getAllTasksWithRelations } from '@/app/actions/tasks'
import { getWsjfRanking } from '@/app/actions/wsjf'
import { WsjfView } from '@/components/compass/wsjf-view'
import { PageHeader } from '@/components/compass/page-header'

export const metadata: Metadata = { title: 'WSJF — Priorytetyzacja' }

// ============================================================
// /wsjf — U5 SAFe WSJF (Weighted Shortest Job First)
// ============================================================
// WSPOMAGANIE DECYZJI (decision support) — bez LLM, bez ML. RSC pobiera komplet
// aktywnych zadań (do edycji 4 wejść WSJF) oraz gotowy ranking liczony
// deterministycznie po stronie serwera (getWsjfRanking → lib/wsjf.ts).
// ============================================================

export default async function WsjfPage() {
  const [tasks, ranking] = await Promise.all([
    getAllTasksWithRelations(),
    getWsjfRanking(),
  ])

  const estimated = ranking.length
  const total = tasks.length

  return (
    <div className="flex flex-col h-screen">
      <PageHeader
        title="WSJF"
        badge="Wspomaganie decyzji"
        subtitle={`${estimated} z ${total} zadań oszacowanych`}
      />
      <WsjfView tasks={tasks} ranking={ranking} />
    </div>
  )
}
