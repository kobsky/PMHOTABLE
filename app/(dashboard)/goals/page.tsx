import type { Metadata } from 'next'
import { getGoals } from '@/app/actions/goals'
import { getProjects } from '@/app/actions/projects'
import { GoalsView } from '@/components/compass/goals-view'
import { PageHeader } from '@/components/compass/page-header'

export const metadata: Metadata = { title: 'Cele & OKR' }

export default async function GoalsPage() {
  const [goals, projects] = await Promise.all([getGoals(), getProjects()])

  const objectives = goals.filter((g) => g.type === 'objective').length
  const milestones = goals.filter((g) => g.type === 'grant_milestone').length

  return (
    <div className="flex flex-col h-screen">
      <PageHeader
        title="Cele & OKR"
        subtitle={`${objectives} objectives · ${milestones} milestoneów`}
      />
      <GoalsView goals={goals} projects={projects} />
    </div>
  )
}
