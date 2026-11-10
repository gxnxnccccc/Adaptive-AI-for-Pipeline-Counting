import { Fragment, useMemo, useState } from 'react'
import { Link, Navigate, Outlet, useLocation } from 'react-router'
import { ArrowLeft, ChartColumn, LogOut, ScanLine, type LucideIcon } from 'lucide-react'
import ApiChip, { useApiStatus } from '@/components/ApiChip'
import BrandMark from '@/components/BrandMark'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
import { useDetectionSession } from '@/lib/detection-session'
import type { ShellContext } from '@/lib/shell-context'
import { bi, t, type Pair } from '@/lib/i18n'

// Layout copied from docs/design/preview/processing.html (.side / .topbar / .ph / .tabs).
type NavItem = { to: string; icon: LucideIcon; side: Pair; tab: Pair; activeOn: string[] }
const NAV: NavItem[] = [
  // Result counts as part of Processing in the nav (ui-v2.md section 2).
  { to: '/processing', icon: ScanLine, side: t.navProcessing, tab: t.navNew, activeOn: ['/processing', '/result'] },
  { to: '/dashboard', icon: ChartColumn, side: t.navDashboard, tab: t.navDashboard, activeOn: ['/dashboard'] },
]

// step = position in the 2-step flow shown in the header (Processing and Result only).
const PAGES: Record<string, { tag: string; title: Pair; step?: 1 | 2 }> = {
  '/processing': { tag: 'processing', title: t.navNew, step: 1 },
  '/result': { tag: 'result', title: t.resultTitle, step: 2 },
  '/dashboard': { tag: 'dashboard', title: t.navDashboard },
}
const FLOW: Pair[] = [t.flowCapture, t.resultTitle]

const En = ({ children }: { children: string }) => (
  <span className="text-[12.5px] font-normal tracking-[.01em] text-tx-3">{children}</span>
)

function Brand({ withSub }: { withSub: boolean }) {
  return (
    <Link to="/processing" aria-label={bi(t.home)} className="flex min-h-11 items-center gap-2.5 rounded-control">
      <BrandMark withSub={withSub} />
    </Link>
  )
}

// "1 Capture — 2 Review & confirm", current step highlighted. Hidden on phones (preview .flow).
function Flow({ step }: { step: 1 | 2 }) {
  return (
    <ol aria-label={bi(t.stepper)} data-testid="flow" className="m-0 hidden list-none items-center gap-1.5 p-0 text-[13px] text-tx-3 sm:flex">
      {FLOW.map((s, i) => (
        <Fragment key={s.en}>
          {i > 0 && (
            <li aria-hidden="true">
              <span className="block h-px w-5 bg-line-2" />
            </li>
          )}
          <li
            aria-current={i + 1 === step ? 'step' : undefined}
            className="group flex items-center gap-1.5 aria-[current=step]:font-semibold aria-[current=step]:text-tx"
          >
            <span className="grid size-6 place-items-center rounded-full border border-line-2 font-mono text-xs group-aria-[current=step]:border-accent group-aria-[current=step]:bg-accent/12 group-aria-[current=step]:text-accent">
              {i + 1}
            </span>
            <span className="flex flex-col leading-tight">
              <span>{s.th}</span>
              <span className="text-xs font-normal text-tx-3">{s.en}</span>
            </span>
          </li>
        </Fragment>
      ))}
    </ol>
  )
}

// "3f9c…a21e": first and last 4 characters of the batch id.
const shortId = (id: string) => (id.length > 9 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id)

export default function AppShell() {
  const { operator, logout } = useAuth()
  const { pathname } = useLocation()
  const { status, recheck } = useApiStatus()
  const { batchId } = useDetectionSession()
  // Pages portal their toolbar here (Dashboard: Updated, Refresh, New detection).
  const [toolbarSlot, setToolbarSlot] = useState<HTMLElement | null>(null)
  const shell = useMemo<ShellContext>(() => ({ toolbarSlot, recheckApi: recheck }), [toolbarSlot, recheck])

  if (!operator) return <Navigate to="/login" replace />

  const page = PAGES[pathname]
  const onResult = pathname === '/result'
  const current = (n: NavItem) => (n.activeOn.includes(pathname) ? ('page' as const) : undefined)

  return (
    <div className="flex min-h-dvh flex-col desk:grid desk:grid-cols-[248px_minmax(0,1fr)] desk:items-start">
      <aside
        aria-label={bi(t.mainMenu)}
        className="sticky top-0 hidden h-dvh flex-col gap-5 border-r border-line bg-surface/78 px-3.5 py-5 backdrop-blur-sm desk:flex"
      >
        <Brand withSub />
        <nav aria-label={bi(t.menu)} className="flex flex-col gap-1">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              aria-current={current(n)}
              className="group flex min-h-14 items-center gap-3 rounded-control px-3 py-2 font-semibold text-tx-2 hover:bg-raised hover:text-tx aria-[current=page]:bg-accent/12 aria-[current=page]:text-tx aria-[current=page]:shadow-[inset_3px_0_0_var(--color-accent)]"
            >
              <n.icon aria-hidden="true" className="size-5 shrink-0 group-aria-[current=page]:text-accent" />
              <span className="flex min-w-0 flex-col leading-tight">
                <span>{n.side.th}</span>
                <En>{n.side.en}</En>
              </span>
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2 border-t border-line pt-4">
          <div className="flex items-center gap-2.5 p-1">
            <span
              aria-hidden="true"
              className="grid size-10 place-items-center rounded-control border border-line bg-raised font-mono text-[13px] font-bold text-accent"
            >
              {operator.slice(-2).toUpperCase()}
            </span>
            <span className="flex min-w-0 flex-col leading-tight">
              <span data-testid="operator" className="truncate font-mono tabular-nums">
                {operator}
              </span>
              <En>{bi(t.operator)}</En>
            </span>
          </div>
          <Button variant="ghost" className="w-full justify-start" onClick={logout}>
            <LogOut aria-hidden="true" className="size-5" />
            <span>{t.logout.th}</span>
            <En>{t.logout.en}</En>
          </Button>
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col">
        <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-bg/90 py-2 pr-2 pl-4 backdrop-blur-md desk:hidden">
          <Brand withSub={false} />
          <span className="ml-auto truncate font-mono text-[13px] text-tx-2">{operator}</span>
          <Button variant="ghost" size="icon" aria-label={bi(t.logout)} onClick={logout}>
            <LogOut aria-hidden="true" className="size-5" />
          </Button>
        </div>

        <header className="mx-auto flex w-full max-w-[1440px] flex-wrap items-end gap-x-4 gap-y-3 px-4 pt-[18px] desk:px-8 desk:pt-7">
          {page && (
            <div>
              {onResult ? (
                // Back keeps the detection session (Tang, 2026-11-09).
                <Button asChild variant="ghost" className="mb-1 -ml-3">
                  <Link to="/processing">
                    <ArrowLeft aria-hidden="true" className="size-5" />
                    <span>{t.backToProcessing.th}</span>
                    <En>{t.backToProcessing.en}</En>
                  </Link>
                </Button>
              ) : (
                <span className="mb-1.5 block font-mono text-xs font-medium tracking-[.08em] text-tx-3 uppercase">SPDS / {page.tag}</span>
              )}
              <h1 className="flex flex-col gap-0.5 text-[22px] leading-tight font-bold desk:text-[28px]">
                <span>{page.title.th}</span>
                <span className="text-[13px] font-medium text-tx-3 desk:text-sm">{page.title.en}</span>
              </h1>
            </div>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {page?.step && <Flow step={page.step} />}
            {onResult && batchId && (
              <span
                data-testid="batch-chip"
                className="inline-flex min-h-[30px] items-center gap-1.5 rounded-full border border-line bg-raised px-2.5 py-0.5 text-[13px] whitespace-nowrap"
              >
                <span className="text-tx-3">Batch</span>
                <span className="font-mono tabular-nums">{shortId(batchId)}</span>
                <span className="text-tx-3">· draft</span>
              </span>
            )}
            <div ref={setToolbarSlot} className="contents" />
            <ApiChip status={status} />
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-4 px-4 pt-4 pb-6 desk:gap-5 desk:px-8 desk:pt-5 desk:pb-10">
          <Outlet context={shell} />
        </main>

        <nav
          aria-label={bi(t.menu)}
          className="sticky bottom-0 z-30 grid grid-cols-2 border-t border-line bg-bg/94 pb-[env(safe-area-inset-bottom)] backdrop-blur-md desk:hidden"
        >
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              aria-current={current(n)}
              className="relative flex min-h-15 flex-col items-center justify-center gap-px text-sm font-semibold text-tx-2 aria-[current=page]:text-accent"
            >
              {current(n) && <span aria-hidden="true" className="absolute inset-x-[28%] -top-px h-[3px] rounded-b-[3px] bg-accent" />}
              <n.icon aria-hidden="true" className="size-5" />
              <span>{n.tab.th}</span>
              <span className="text-xs font-normal opacity-85">{n.tab.en}</span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  )
}
