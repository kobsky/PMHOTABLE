import Link from 'next/link'

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-0 h-screen">
      <nav className="w-44 border-r border-compass-border flex-shrink-0 pt-4 space-y-0.5 px-2">
        <p className="font-mono text-2xs text-compass-dim uppercase tracking-widest px-2 pb-2">
          Ustawienia
        </p>
        <Link
          href="/settings/account"
          className="block px-3 py-2 rounded text-sm text-compass-muted hover:text-compass-text hover:bg-compass-surface-2 transition-colors"
        >
          Konto
        </Link>
        <Link
          href="/settings/team"
          className="block px-3 py-2 rounded text-sm text-compass-muted hover:text-compass-text hover:bg-compass-surface-2 transition-colors"
        >
          Zespół
        </Link>
      </nav>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
