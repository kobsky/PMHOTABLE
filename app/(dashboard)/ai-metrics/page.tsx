import type { Metadata } from 'next'
import { getAIFeedbackStats } from '@/app/actions/ai'
import { PageHeader } from '@/components/compass/page-header'
import { cn } from '@/lib/utils'
import { Sparkles, ThumbsUp, ThumbsDown, Tag } from 'lucide-react'
import type { AiFeature } from '@/lib/supabase/types'

export const metadata: Metadata = { title: 'AI Metryki' }

const FEATURE_LABELS: Record<AiFeature, string> = {
  auto_categorization: 'Auto-kategoryzacja',
  assignee_recommender: 'Rekomendacja assignee',
  workload_balancing: 'Balansowanie obciążeń',
}

function AcceptanceBar({ rate }: { rate: number }) {
  const color = rate >= 70 ? 'bg-compass-success' : rate >= 40 ? 'bg-compass-warning' : 'bg-compass-danger'
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-compass-surface-3 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${rate}%` }} />
      </div>
      <span className={cn(
        'font-mono text-xs font-semibold w-10 text-right',
        rate >= 70 ? 'text-compass-success' : rate >= 40 ? 'text-compass-warning' : 'text-compass-danger'
      )}>
        {rate}%
      </span>
    </div>
  )
}

export default async function AIMetricsPage() {
  const { stats, recent, error } = await getAIFeedbackStats()

  return (
    <div className="p-6 max-w-4xl space-y-8">
      <PageHeader
        title="AI Metryki"
        subtitle="Skuteczność funkcji AI — akceptacje vs. odrzucenia"
      />

      {error && (
        <div className="compass-card border-compass-danger/30 p-4 text-sm text-compass-danger">
          Błąd ładowania danych: {error}
        </div>
      )}

      {/* Stats cards */}
      {stats.length === 0 && !error ? (
        <div className="compass-card p-10 text-center">
          <Sparkles size={28} className="mx-auto mb-3 text-compass-dim" />
          <p className="font-mono text-sm text-compass-dim">Brak danych AI — zacznij używać sugestii</p>
          <p className="text-xs text-compass-dim/60 mt-1">
            Sugestie pojawią się gdy zaczniesz pisać tytuły zadań
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.map((s) => (
            <div key={s.feature} className="compass-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-compass-muted">
                  {FEATURE_LABELS[s.feature] ?? s.feature}
                </span>
                <Sparkles size={13} className="text-compass-accent" />
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-display font-semibold text-compass-text">
                  {s.total}
                </span>
                <span className="text-xs text-compass-dim">sugestii</span>
              </div>

              <AcceptanceBar rate={s.acceptanceRate} />

              <div className="flex items-center gap-4 pt-1">
                <div className="flex items-center gap-1 text-xs text-compass-success">
                  <ThumbsUp size={11} />
                  <span className="font-mono">{s.accepted}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-compass-danger">
                  <ThumbsDown size={11} />
                  <span className="font-mono">{s.total - s.accepted}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent feedback table */}
      {recent.length > 0 && (
        <div>
          <h2 className="font-display text-sm font-semibold text-compass-muted mb-3">
            Ostatnie sugestie
          </h2>
          <div className="compass-card overflow-hidden">
            <div className="divide-y divide-compass-border">
              {recent.map((row) => {
                const suggestion = row.suggestion as Record<string, unknown> | null
                const suggestedType = suggestion?.type as string | undefined
                return (
                  <div
                    key={row.id}
                    className="grid grid-cols-[1fr_120px_80px_80px] gap-3 px-4 py-2.5 items-center"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Tag size={11} className="text-compass-dim flex-shrink-0" />
                      <span className="font-mono text-xs text-compass-muted truncate">
                        {FEATURE_LABELS[row.feature as AiFeature] ?? row.feature}
                      </span>
                    </div>
                    <span className="font-mono text-xs text-compass-accent truncate">
                      {suggestedType ?? '—'}
                    </span>
                    <span className={cn(
                      'font-mono text-xs font-semibold',
                      row.accepted === true ? 'text-compass-success' :
                      row.accepted === false ? 'text-compass-danger' :
                      'text-compass-dim'
                    )}>
                      {row.accepted === true ? '✓ OK' : row.accepted === false ? '✕ Odrzucono' : '—'}
                    </span>
                    <span className="font-mono text-2xs text-compass-dim/60 text-right">
                      {new Date(row.created_at).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
