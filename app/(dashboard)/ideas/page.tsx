import type { Metadata } from 'next'
import { PageHeader } from '@/components/compass/page-header'
import { IdeasView } from '@/components/compass/ideas-view'
import { getIdeas } from '@/app/actions/ideas'
import { getProjects } from '@/app/actions/projects'

export const metadata: Metadata = { title: 'Pomysły' }

export default async function IdeasPage() {
  const [ideas, projects] = await Promise.all([
    getIdeas(),
    getProjects(),
  ])

  const inboxCount = ideas.filter((i) => i.status === 'inbox').length

  return (
    <div className="flex flex-col h-screen">
      <PageHeader
        title="Idea Inbox"
        subtitle="ICE-scored pomysły — sortowane automatycznie"
        badge={inboxCount > 0 ? `${inboxCount} nowych` : undefined}
      />
      <IdeasView ideas={ideas} projects={projects} />
    </div>
  )
}
