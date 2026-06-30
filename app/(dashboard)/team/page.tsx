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
  // PERF-004: fetch profiles + tasks once here, then hand the already-fetched
  // rows to getWorkloadSuggestions() instead of letting it re-query the DB.
  const [profiles, allTasks, activeCycle] = await Promise.all([
    getProfiles(),
    getAllTasksWithRelations(),
    getActiveCycle(),
  ])

  // Decision-support workload balancing computed over the rows already loaded
  // above (no second round-trip). DbUser[] / TaskWithRelations[] satisfy the
  // ProfileLike / TaskLike structural shapes the action accepts.
  const { suggestions, imbalance } = await getWorkloadSuggestions(profiles, allTasks)

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
        <WorkloadSuggestionsPanel suggestions={suggestions} imbalance={imbalance} />
        <TeamCapacityView
          profiles={profiles}
          allTasks={allTasks}
          activeCycle={activeCycle}
        />
      </div>
    </div>
  )
}
