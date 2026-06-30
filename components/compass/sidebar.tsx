'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Sun,
  LayoutGrid,
  AlignLeft,
  Lightbulb,
  LogOut,
  Target,
  GanttChart,
  Sparkles,
  TrendingUp,
  History,
  Users,
  FlaskConical,
  Settings2,
  ListOrdered,
} from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    label: 'Dashboard',
    items: [
      { href: '/my-day',   label: 'Moje Zadania', icon: Sun },
      { href: '/board',    label: 'Sprint Board', icon: LayoutGrid },
      { href: '/sprints',  label: 'Sprinty',      icon: History },
      { href: '/backlog',  label: 'Backlog',       icon: AlignLeft },
    ],
  },
  {
    label: 'Planowanie',
    items: [
      { href: '/ideas',      label: 'Pomysły',   icon: Lightbulb },
      { href: '/goals',      label: 'Cele & OKR', icon: Target },
      { href: '/wsjf',       label: 'WSJF',       icon: ListOrdered },
    ],
  },
  {
    label: 'Zespół',
    items: [
      { href: '/team',          label: 'Obciążenie',    icon: TrendingUp },
      { href: '/team/members', label: 'Członkowie',    icon: Users },
      { href: '/ai-metrics',  label: 'AI Metryki',   icon: Sparkles },
      { href: '/ai-testing', label: 'AI Testing',   icon: FlaskConical },
    ],
  },
  {
    label: 'Przegląd',
    items: [
      { href: '/gantt', label: 'Gantt', icon: GanttChart },
    ],
  },
  {
    label: 'Ustawienia',
    items: [
      { href: '/settings/team', label: 'Zespół', icon: Settings2 },
    ],
  },
]

interface SidebarProps {
  userInitial: string
  userName: string
  userEmail: string
}

export function Sidebar({ userInitial, userName, userEmail }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 h-full w-52 bg-compass-surface border-r border-compass-border flex flex-col z-40">
      {/* Logo */}
      <div className="px-4 pt-5 pb-4 border-b border-compass-border flex-shrink-0">
        <Link href="/my-day" className="flex items-center gap-2.5 group">
          <div className="w-6 h-6 flex-shrink-0">
            <svg viewBox="0 0 24 24" fill="none" stroke="#E8622A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
            </svg>
          </div>
          <div>
            <div className="font-display text-sm font-semibold text-compass-text leading-tight tracking-tight">
              Compass
            </div>
            <div className="font-mono text-2xs text-compass-dim tracking-widest uppercase leading-tight">
              Hotable
            </div>
          </div>
        </Link>
      </div>

      {/* Nawigacja */}
      <nav className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto no-scrollbar">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-1">
            <p className="compass-label px-2 pt-3 pb-1">{group.label}</p>
            {group.items.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </div>
        ))}
      </nav>

      {/* Footer użytkownika */}
      <div className="flex-shrink-0 border-t border-compass-border p-2">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-[3px] group">
          <div className="w-6 h-6 rounded-full bg-compass-surface-3 border border-compass-border flex-shrink-0 flex items-center justify-center font-mono text-xs text-compass-muted uppercase select-none">
            {userInitial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-compass-text truncate leading-tight">
              {userName}
            </p>
            <p className="font-mono text-2xs text-compass-dim truncate leading-tight">
              {userEmail}
            </p>
          </div>
        </div>
        <form action="/auth/signout" method="POST">
          <button
            type="submit"
            className="mt-1 w-full flex items-center gap-2 px-2 py-1.5 rounded-[3px] text-xs text-compass-dim hover:text-compass-muted hover:bg-compass-surface-2 transition-colors"
          >
            <LogOut size={11} strokeWidth={1.5} />
            Wyloguj
          </button>
        </form>
      </div>
    </aside>
  )
}

interface NavLinkProps {
  item: NavItem
  pathname: string
}

function NavLink({ item, pathname }: NavLinkProps) {
  const Icon = item.icon
  const isActive = pathname === item.href || (item.href !== '/my-day' && pathname.startsWith(item.href + '/') && item.href !== '/team')

  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-2.5 px-2 py-1.5 rounded-[3px] text-sm transition-colors duration-100',
        isActive
          ? 'bg-compass-surface-3 text-compass-text'
          : 'text-compass-muted hover:text-compass-text hover:bg-compass-surface-2'
      )}
    >
      <Icon
        size={14}
        strokeWidth={isActive ? 2 : 1.5}
        className={isActive ? 'text-compass-accent' : 'text-current'}
      />
      <span className="font-medium truncate">{item.label}</span>
      {isActive && (
        <span className="ml-auto w-1 h-1 rounded-full bg-compass-accent flex-shrink-0" />
      )}
    </Link>
  )
}
