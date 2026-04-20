import { AlertTriangle } from 'lucide-react'

interface WipWarningProps {
  count: number
  limit: number
}

export function WipWarning({ count, limit }: WipWarningProps) {
  if (count < limit) return null

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-compass-danger-dim border border-compass-danger/30 rounded-[3px] animate-fade-in">
      <AlertTriangle size={12} className="text-compass-danger flex-shrink-0" />
      <p className="text-xs text-compass-danger font-medium">
        WIP limit osiągnięty ({count}/{limit})
      </p>
    </div>
  )
}
