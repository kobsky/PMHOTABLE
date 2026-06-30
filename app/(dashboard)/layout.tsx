import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/compass/sidebar'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const supabase = await createClient()

  // Mock user dozwolony WYŁĄCZNIE w trybie dev (NODE_ENV==='development').
  // W produkcji brak sesji/ENV → fail-closed (redirect /login).
  const isDev = process.env.NODE_ENV === 'development'

  let user = null
  if (supabase) {
    const { data } = await supabase.auth.getUser()
    user = data.user
  }

  const mockUser = isDev
    ? { email: 'dev@hotable.pl', user_metadata: { full_name: 'Dev User' } }
    : null

  const currentUser = user ?? (isDev ? mockUser : null)

  if (!currentUser) {
    redirect('/login')
  }

  const email = currentUser.email ?? ''
  const fullName = (currentUser.user_metadata as { full_name?: string })?.full_name ?? null
  const displayName = fullName ?? email.split('@')[0] ?? 'Ty'
  const initial = (fullName?.[0] ?? email[0] ?? 'U').toUpperCase()

  return (
    <div className="flex min-h-screen bg-compass-bg">
      <Sidebar
        userInitial={initial}
        userName={displayName}
        userEmail={email}
      />
      <main className="flex-1 ml-52 min-h-screen overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
