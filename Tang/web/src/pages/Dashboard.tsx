import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'
import {
  Check,
  CircleAlert,
  CircleCheck,
  Flag,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  TriangleAlert,
  createLucideIcon,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getDailyStats, getStats, listRecords, type DailyStat, type RecordRow, type Stats } from '@/lib/api'
import { formatVariance } from '@/lib/confirm'
import { bi, t, type Pair } from '@/lib/i18n'
import { useShell } from '@/lib/shell-context'
import { cn } from '@/lib/utils'

// Layout + states from docs/design/preview/dashboard.html (loaded, empty, loading, API error).
// No sample numbers are ever shown.

// recharts lives in its own chunk, loaded only when there is something to chart.
const DashboardCharts = lazy(() => import('@/components/DashboardCharts'))

type Data = { stats: Stats; recent: RecordRow[] }
type Result = { n: number; data?: Data; error?: string; at: Date }
// Charts have their own fetch + state, so a chart failure never hides the KPIs or Recent 10.
type ChartsResult = { key: string; data?: { days: DailyStat[]; confirmed: RecordRow[] }; error?: string }

// The preview's scan icon (corners + lens), which lucide has no exact match for.
const ScanLens = createLucideIcon('ScanLens', [
  ['path', { d: 'M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2' }],
  ['circle', { cx: 12, cy: 12, r: 4 }],
  ['circle', { cx: 12, cy: 12, r: 1 }],
])

const DASH = '—'
const hhmm = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
// Today -> "10:41"; older -> "08/11 10:41".
function when(iso: string, now: Date) {
  const d = new Date(iso)
  if (d.toDateString() === now.toDateString()) return hhmm(d)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${hhmm(d)}`
}
// Network failure: Thai line, then English line (preview).
const errText = (e: unknown) => (e instanceof TypeError ? `${t.apiDownHint.th}
${t.apiDownHint.en}` : e instanceof Error ? e.message : String(e))

const En = ({ children, className }: { children: ReactNode; className?: string }) => (
  <span className={cn('text-[12.5px] font-normal tracking-[.01em] text-tx-3', className)}>{children}</span>
)
const BiRow = ({ p }: { p: Pair }) => (
  <span className="flex flex-wrap items-baseline gap-x-1.5">
    <span>{p.th}</span>
    <En>{p.en}</En>
  </span>
)
const Skel = ({ className }: { className?: string }) => (
  <span aria-hidden="true" className={cn('block animate-pulse rounded-chip bg-raised', className)} />
)
// 4 placeholder cards while the chart data (or the recharts chunk) loads.
const ChartsSkeleton = () =>
  Array.from({ length: 4 }, (_, i) => (
    <div key={i} data-testid="chart-loading" className="rounded-card border border-line bg-surface p-4">
      <Skel className="mb-3 h-5 w-40" />
      <Skel className="h-[230px]" />
    </div>
  ))
const chip = 'inline-flex min-h-[30px] items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[13px] leading-tight font-semibold whitespace-nowrap'

// Status chip (preview statusChip): draft first, then flagged, else confirmed.
function StatusChip({ r }: { r: RecordRow }) {
  const [Icon, label, look] =
    r.status === 'draft'
      ? [Pencil, t.statusDraft, 'border-line bg-raised text-tx']
      : r.flagged
        ? [Flag, t.statusFlagged, 'border-warn/40 bg-warn/12 text-warn']
        : [Check, t.statusConfirmed, 'border-ok/40 bg-ok/12 text-ok']
  return (
    <span data-testid="status-chip" className={cn(chip, look)}>
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      <span>{label.th}</span>
      <span className="text-xs font-normal opacity-85">{label.en}</span>
    </span>
  )
}

type Kpi = { key: string; icon: LucideIcon; label: Pair; value: ReactNode; foot: Pair; meter?: number; alarm?: boolean }

function KpiCard({ k, loading }: { k: Kpi; loading: boolean }) {
  return (
    <article data-testid={`kpi-${k.key}`} className="flex min-w-0 flex-col gap-2.5 rounded-card border border-line bg-surface p-3.5 @min-[760px]:p-[18px]">
      <div className="flex items-start gap-2.5 text-sm font-semibold">
        <span
          data-testid={`kpi-${k.key}-icon`}
          data-alarm={k.alarm || undefined}
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-control border',
            k.alarm ? 'border-err/35 bg-err/12 text-err' : 'border-accent/30 bg-accent/12 text-accent',
          )}
        >
          <k.icon aria-hidden="true" className="size-5" />
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span>{k.label.th}</span>
          <En>{k.label.en}</En>
        </span>
      </div>
      {loading ? (
        <Skel className="h-9 w-20" />
      ) : (
        <b
          data-testid={`kpi-${k.key}-value`}
          className="mt-auto flex min-h-9 items-baseline gap-1 font-mono text-[32px] leading-none font-bold tabular-nums @min-[600px]:text-4xl @min-[760px]:min-h-11 @min-[760px]:text-[44px]"
        >
          {k.value}
        </b>
      )}
      {k.meter !== undefined && !loading && (
        <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-[3px] bg-raised">
          <i className="block h-full bg-accent" style={{ width: `${Math.min(100, k.meter)}%` }} />
        </div>
      )}
      <p className="mt-auto hidden text-[12.5px] leading-snug text-tx-3 @min-[600px]:block">{bi(k.foot)}</p>
    </article>
  )
}

function kpisOf(s: Stats | undefined): Kpi[] {
  const v = (x: number | undefined) => (x === undefined ? <span className="text-tx-3">{DASH}</span> : String(x))
  const rate = s?.correctionRate ?? null
  return [
    { key: 'today', icon: ScanLens, label: t.kpiToday, value: v(s?.detectionsToday), foot: t.kpiTodayFoot },
    { key: 'confirmed', icon: CircleCheck, label: t.kpiConfirmed, value: v(s?.confirmedTotal), foot: t.kpiConfirmedFoot },
    {
      key: 'correction',
      icon: Pencil,
      label: t.kpiCorrection,
      value:
        rate === null ? (
          <span className="text-tx-3">{DASH}</span>
        ) : (
          <>
            {Math.round(rate * 100)}
            <small className="text-xl text-tx-2">%</small>
          </>
        ),
      foot: s && rate === null ? t.nothingConfirmed : t.kpiCorrectionFoot,
      meter: rate === null ? undefined : rate * 100,
    },
    {
      key: 'failed',
      icon: TriangleAlert,
      label: t.kpiFailed,
      value: v(s?.failedImagesToday),
      foot: t.kpiFailedFoot,
      alarm: (s?.failedImagesToday ?? 0) > 0,
    },
  ]
}

const COLS: { p: Pair; right?: boolean }[] = [
  { p: t.colTime },
  { p: t.doNumber },
  { p: t.colOperator },
  { p: t.colPhotos, right: true },
  { p: t.colModel, right: true },
  { p: t.colActual, right: true },
  { p: t.varianceLabel, right: true },
  { p: t.colStatus },
]

// Per-cell label, only in the phone card layout (the table header is visually hidden there).
const Label = ({ p }: { p: Pair }) => <span className="font-sans text-xs text-tx-3 @min-[760px]:hidden">{bi(p)}</span>

// Table on wide cards; below 760 px each row becomes a 3-column card with its own labels (preview .recent).
function RecentTable({ rows, now }: { rows: RecordRow[]; now: Date }) {
  const dash = <span className="text-tx-3">{DASH}</span>
  const td = 'flex flex-col @min-[760px]:table-cell @min-[760px]:border-b @min-[760px]:border-line @min-[760px]:px-2.5 @min-[760px]:py-2.5 @min-[760px]:align-middle'
  const num = 'font-mono tabular-nums @min-[760px]:text-right'
  return (
    <table className="block w-full border-collapse text-sm @min-[760px]:table">
      <thead className="sr-only @min-[760px]:not-sr-only @min-[760px]:table-header-group">
        <tr>
          {COLS.map(({ p, right }) => (
            <th
              key={p.en}
              scope="col"
              className={cn('border-b border-line-2 px-2.5 py-2.5 text-left text-[13px] font-semibold whitespace-nowrap text-tx-2', right && 'text-right')}
            >
              {p.th}
              <span className="block text-xs font-normal text-tx-3">{p.en}</span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="block @min-[760px]:table-row-group">
        {rows.map((r) => (
          <tr
            key={r.batchId}
            data-testid="recent-row"
            className="grid grid-cols-3 gap-x-2 gap-y-1.5 border-b border-line py-3 hover:bg-raised/50 @min-[760px]:table-row @min-[760px]:border-0 @min-[760px]:py-0"
          >
            <td className={cn(td, 'font-mono tabular-nums')}>
              <Label p={t.colTime} />
              {when(r.createdAt, now)}
            </td>
            <td data-testid="recent-do" className={cn(td, 'col-span-2 font-mono text-base font-bold @min-[760px]:text-sm')}>
              <Label p={t.doNumber} />
              {r.doNumber ?? dash}
            </td>
            <td className={cn(td, 'font-mono')}>
              <Label p={t.colOperator} />
              {r.operatorId}
            </td>
            <td className={cn(td, num)}>
              <Label p={t.colPhotos} />
              {r.imageCount}
            </td>
            <td className={cn(td, num)}>
              <Label p={t.colModel} />
              {r.modelTotal}
            </td>
            <td className={cn(td, num)}>
              <Label p={t.colActual} />
              {r.actualAmount ?? dash}
            </td>
            <td data-testid="recent-variance" className={cn(td, num)}>
              <Label p={t.varianceLabel} />
              {r.variance === null ? dash : formatVariance(r.variance)}
            </td>
            <td className={cn(td, 'col-start-3 row-start-1 items-end @min-[760px]:text-left')}>
              <StatusChip r={r} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function Dashboard() {
  const { toolbarSlot: slot, recheckApi } = useShell()
  const [n, setN] = useState(0) // bump to refetch
  const [result, setResult] = useState<Result | null>(null)
  const [cn, setCn] = useState(0) // bump to refetch only the charts
  const [charts, setCharts] = useState<ChartsResult | null>(null)

  useEffect(() => {
    let alive = true
    Promise.all([getStats(), listRecords({ limit: 10 })]).then(
      ([stats, page]) => alive && setResult({ n, data: { stats, recent: page.items }, at: new Date() }),
      (e: unknown) => {
        if (!alive) return
        setResult({ n, error: errText(e), at: new Date() })
        recheckApi() // the API chip should not say Online while the dashboard cannot load
      },
    )
    return () => {
      alive = false
    }
  }, [n, recheckApi])

  const loading = result?.n !== n
  const data = loading ? undefined : result?.data
  const error = loading ? undefined : result?.error
  const empty = !!data && data.recent.length === 0
  const wantCharts = !!data && !empty // no chart requests while loading, empty or in the API-error state

  useEffect(() => {
    if (!wantCharts) return
    let alive = true
    const key = `${n}:${cn}`
    Promise.all([getDailyStats(7), listRecords({ filter: 'confirmed', limit: 10 })]).then(
      ([days, page]) => alive && setCharts({ key, data: { days, confirmed: page.items } }),
      (e: unknown) => alive && setCharts({ key, error: errText(e) }),
    )
    return () => {
      alive = false
    }
  }, [n, cn, wantCharts])

  const refetch = () => setN((x) => x + 1)

  const stamp = loading ? t.loading : error ? t.notUpdated : result ? t.updatedAt(hhmm(result.at)) : null
  const toolbar = (
    <div className="flex flex-wrap items-center justify-end gap-2">
        <span data-testid="updated-at" aria-live="polite" className="flex flex-col text-right text-[13px] leading-snug text-tx-3">
          {stamp && (
            <>
              <span>{stamp.th}</span>
              <En>{stamp.en}</En>
            </>
          )}
        </span>
        <Button variant="secondary" disabled={loading} onClick={refetch}>
          {loading ? (
            <LoaderCircle aria-hidden="true" className="size-5 motion-safe:animate-spin" />
          ) : (
            <RefreshCw aria-hidden="true" className="size-5" />
          )}
          <BiRow p={t.refresh} />
        </Button>
        {/* Hidden on phone: the tab bar already has New detection. */}
        <Button asChild className="hidden @min-[600px]:inline-flex">
          <Link to="/processing">
            <Plus aria-hidden="true" className="size-5" />
            <span className="flex flex-wrap items-baseline gap-x-1.5">
              <span>{t.navNew.th}</span>
              <span className="text-[12.5px] font-medium text-accent-ink/75">{t.navNew.en}</span>
            </span>
          </Link>
        </Button>
    </div>
  )

  return (
    <div className="@container flex flex-col gap-4">
      {/* Next to the page title when AppShell offers the slot, else inline (tests, standalone). */}
      {slot ? createPortal(toolbar, slot) : toolbar}

      {error && (
        <div
          role="alert"
          data-testid="dashboard-error"
          className="flex flex-wrap items-start gap-3 rounded-control border border-err/50 bg-err/12 px-3.5 py-3 text-[15px]"
        >
          <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-err" />
          <p className="flex min-w-0 flex-1 flex-col">
            <b>{t.dashLoadFailed.th}</b>
            <En>{t.dashLoadFailed.en}</En>
            <span className="mt-1 break-words whitespace-pre-line">{error}</span>
          </p>
          <Button variant="secondary" className="ml-auto" onClick={refetch}>
            <RefreshCw aria-hidden="true" className="size-5" />
            <BiRow p={t.retry} />
          </Button>
        </div>
      )}

      <section aria-label={bi(t.keyNumbers)} className="grid grid-cols-2 gap-3 @min-[760px]:grid-cols-4">
        {kpisOf(data?.stats).map((k) => (
          <KpiCard key={k.key} k={k} loading={loading} />
        ))}
      </section>

      {data && !empty && (
        <section
          data-testid="dashboard-charts"
          aria-label={bi(t.charts)}
          className="grid grid-cols-1 gap-3 @min-[900px]:grid-cols-2 @min-[900px]:gap-4"
        >
          {charts?.key !== `${n}:${cn}` ? (
            <ChartsSkeleton />
          ) : charts.error !== undefined ? (
            <div
              role="alert"
              data-testid="charts-error"
              className="flex flex-wrap items-start gap-3 rounded-card border border-err/50 bg-err/12 px-3.5 py-3 text-[15px] @min-[900px]:col-span-2"
            >
              <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-err" />
              <p className="flex min-w-0 flex-1 flex-col">
                <b>{t.chartsLoadFailed.th}</b>
                <En>{t.chartsLoadFailed.en}</En>
                <span className="mt-1 break-words whitespace-pre-line">{charts.error}</span>
              </p>
              <Button variant="secondary" className="ml-auto" onClick={() => setCn((x) => x + 1)}>
                <RefreshCw aria-hidden="true" className="size-5" />
                <BiRow p={t.retry} />
              </Button>
            </div>
          ) : (
            charts.data && (
              <Suspense fallback={<ChartsSkeleton />}>
                <DashboardCharts days={charts.data.days} confirmed={charts.data.confirmed} />
              </Suspense>
            )
          )}
        </section>
      )}

      {empty && (
        <section
          data-testid="dashboard-empty"
          className="flex flex-col items-center gap-1.5 rounded-card border border-line bg-surface px-4 py-12 text-center"
        >
          <svg viewBox="0 0 150 90" aria-hidden="true" fill="none" strokeWidth="2" className="mb-2 h-[90px] w-[150px]">
            <path d="M10 80h130" className="stroke-line-2" />
            <rect x="22" y="56" width="18" height="24" rx="3" strokeDasharray="4 4" className="stroke-line-2" />
            <rect x="52" y="40" width="18" height="40" rx="3" strokeDasharray="4 4" className="stroke-line-2" />
            <rect x="82" y="26" width="18" height="54" rx="3" strokeDasharray="4 4" className="stroke-line-2" />
            <rect x="112" y="12" width="18" height="68" rx="3" strokeDasharray="4 4" className="stroke-accent" />
          </svg>
          <b className="text-lg">{t.dashEmpty.th}</b>
          <En>{t.dashEmpty.en}</En>
          <p className="text-sm text-tx-3">{bi(t.chartsAfterFirst)}</p>
          <Button asChild size="lg" className="mt-3">
            <Link to="/processing">
              <Plus aria-hidden="true" className="size-5" />
              <span className="flex flex-wrap items-baseline gap-x-1.5">
                <span>{t.navNew.th}</span>
                <span className="text-[12.5px] font-medium text-accent-ink/75">{t.navNew.en}</span>
              </span>
            </Link>
          </Button>
        </section>
      )}

      {!error && (
        <section aria-labelledby="rt-t" className="@container rounded-card border border-line bg-surface">
          <h2 id="rt-t" className="flex flex-col px-4 pt-4 pb-1 text-base leading-snug font-bold">
            <span>{t.recent10.th}</span>
            <En>{t.recent10.en}</En>
          </h2>
          <div className="px-4 pb-4">
            {loading ? (
              <div data-testid="recent-loading">
                {Array.from({ length: 5 }, (_, i) => (
                  <Skel key={i} className="my-2 h-11" />
                ))}
              </div>
            ) : data && data.recent.length > 0 ? (
              <RecentTable rows={data.recent} now={result?.at ?? new Date()} />
            ) : (
              <p className="py-4 text-sm text-tx-3">{bi(t.noRecords)}</p>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
