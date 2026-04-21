import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/compass/page-header'
import { getAllTasksWithRelations } from '@/app/actions/tasks'
import { getProfiles } from '@/app/actions/users'
import { getWorkloadSuggestions } from '@/app/actions/ai'
import { getActiveCycle } from '@/app/actions/cycles'
import { WorkloadSuggestionsPanel } from '@/components/compass/workload-suggestions'
import { TeamCapacityView } from '@/components/compass/team-capacity-view'
import { Settings2 } from 'lucide-react'

export const metadata: Metadata = { title: 'Zespół' }

export default async function TeamPage() {
  const [profiles, allTasks, { suggestions }, activeCycle] = await Promise.all([
    getProfiles(),
    getAllTasksWithRelations(),
    getWorkloadSuggestions(),
    getActiveCycle(),
  ])

  return (
    <div className="flex flex-col h-screen">
      <PageHeader
        title="Zespół"
        subtitle="Aktywność, obciążenie i pojemność sprintu"
        actions={
          <Link href="/team/members" className="compass-btn-outline text-xs flex items-center gap-1.5">
            <Settings2 size={12} />
            Zarządzaj członkami
          </Link>
        }
      />
      <div className="flex-1 overflow-auto p-6">
        <WorkloadSuggestionsPanel suggestions={suggestions} />
        <TeamCapacityView
          profiles={profiles}
          allTasks={allTasks}
          activeCycle={activeCycle}
        />
      </div>
    </div>
  )
}
