import type { Metadata } from 'next'
import { getAllCycles } from '@/app/actions/cycles'
import { getGoals } from '@/app/actions/goals'
import { getAllTasksWithRelations } from '@/app/actions/tasks'
import { PageHeader } from '@/components/compass/page-header'
import { GanttView } from '@/components/compass/gantt-view'

export const metadata: Metadata = { title: 'Gantt — Oś czasu' }
export const revalidate = 60

export default async function GanttPage() {
  const [cycles, goals, tasks] = await Promise.all([getAllCycles(), getGoals(), getAllTasksWithRelations()])

  const activeCycle = cycles.find((c) => c.is_active)
  const milestones = goals.filter((g) => g.type === 'grant_milestone')
  const doneMilestones = milestones.filter((m) => m.progress === 100).length

  return (
    <div className="flex flex-col h-screen">
      <PageHeader
        title="Gantt — Oś czasu"
        subtitle={`${cycles.length} sprintów · ${activeCycle ? `aktywny: ${activeCycle.name}` : 'brak aktywnego'} · PARP: ${doneMilestones}/${milestones.length}`}
      />
      <GanttView cycles={cycles} goals={goals} tasks={tasks} />
    </div>
  )
}
