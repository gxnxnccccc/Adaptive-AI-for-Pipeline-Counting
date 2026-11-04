import { useEffect, useState } from 'react'
import { NavLink, Navigate, Outlet, useLocation } from 'react-router'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getCountsTotal, getHealth } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { bi, t } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const POLL_MS = 30_000

const link = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex min-h-11 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-medium',
    isActive ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100',
  )

export default function AppShell() {
  const { operator, logout } = useAuth()
  const { pathname } = useLocation()
  const [online, setOnline] = useState<boolean | null>(null)
  const [total, setTotal] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    const check = () => void getHealth().then((ok) => alive && setOnline(ok))
    check()
    const id = setInterval(check, POLL_MS)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  // Refetch the badge on every navigation so it follows new records.
  useEffect(() => {
    let alive = true
    getCountsTotal().then(
      (n) => alive && setTotal(n),
      () => alive && setTotal(null), // API error: no badge
    )
    return () => {
      alive = false
    }
  }, [pathname])

  if (!operator) return <Navigate to="/login" replace />

  return (
    <div className="flex min-h-dvh flex-col bg-gray-50 md:flex-row">
      <nav
        aria-label="Main"
        className="flex gap-1 overflow-x-auto border-b border-gray-200 bg-white p-2 md:w-60 md:shrink-0 md:flex-col md:border-r md:border-b-0"
      >
        <NavLink to="/new" className={link}>
          {bi(t.navNew)}
        </NavLink>
        <NavLink to="/dashboard" className={link}>
          {bi(t.navDashboard)}
        </NavLink>
        <NavLink to="/records" className={link}>
          {bi(t.navRecords)}
          {total !== null && (
            <span data-testid="records-badge" className="rounded-full bg-gray-200 px-2 text-xs text-gray-800">
              {total}
            </span>
          )}
        </NavLink>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-white px-4 py-2">
          <h1 className="text-base font-bold text-blue-700">{t.appTitle.th}</h1>
          <div className="flex items-center gap-3 text-sm">
            {online !== null && (
              <span
                data-testid="api-status"
                className={cn('rounded-full px-2 py-1 font-medium', online ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')}
              >
                {online ? t.apiOnline.en : bi(t.apiOffline)}
              </span>
            )}
            <span className="text-gray-700">{operator}</span>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut aria-hidden="true" />
              {bi(t.logout)}
            </Button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-4 sm:px-6 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
