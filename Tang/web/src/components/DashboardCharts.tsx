// Dashboard charts (task 10b), lazy-loaded so recharts stays out of the main bundle.
// Layout + marks from docs/design/ui-v2.md section 6 and preview/dashboard.html. Every chart has a
// "View as table" <details> with the same numbers, so the tooltip never gates a value.
import { useState, type ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type LabelProps,
  type TooltipContentProps,
  type XAxisTickContentProps,
} from 'recharts'
import type { DailyStat, RecordRow } from '@/lib/api'
import { formatPct, toDaySeries, toModelVsActual, total, valueDomain, type DayPoint, type MvaRow } from '@/lib/chart-data'
import { bi, t, type Pair } from '@/lib/i18n'
import { cn } from '@/lib/utils'

// Colours only from the @theme tokens in index.css (grid = raised, baseline = line-2).
const C = {
  viz1: 'var(--color-viz-1)',
  viz2: 'var(--color-viz-2)',
  grid: 'var(--color-raised)',
  base: 'var(--color-line-2)',
  surface: 'var(--color-surface)',
  tx: 'var(--color-tx)',
  tx2: 'var(--color-tx-2)',
  tx3: 'var(--color-tx-3)',
}
const MONO = 'var(--font-mono)'
const H = 230
const axisTick = { fill: C.tx3, fontSize: 12, fontFamily: MONO }
const hoverBand = { fill: 'rgb(31 41 55 / 0.06)' }

const En = ({ children }: { children: ReactNode }) => <span className="text-xs font-normal text-tx-3">{children}</span>

function Card({ id, title, aside, legend, note, table, children }: {
  id: string
  title: Pair
  aside?: ReactNode
  legend?: ReactNode
  note?: Pair
  table: ReactNode
  children: ReactNode
}) {
  return (
    <article aria-labelledby={`${id}-t`} className="flex min-w-0 flex-col rounded-card border border-line bg-surface shadow-card">
      <div className="flex items-start justify-between gap-2.5 px-4 pt-4 pb-1">
        <h2 id={`${id}-t`} className="flex flex-col text-base leading-snug font-bold">
          <span>{title.th}</span>
          <span className="text-[12.5px] font-normal text-tx-3">{title.en}</span>
        </h2>
        {aside}
      </div>
      {legend}
      <div className="px-2 pt-1">{children}</div>
      {note && <p className="px-4 text-[12.5px] text-tx-3">{bi(note)}</p>}
      {table && (
        <details className="px-4 pt-1 pb-3.5">
          <summary className="flex min-h-11 w-fit cursor-pointer items-center text-sm font-semibold text-accent">{bi(t.viewTable)}</summary>
          {table}
        </details>
      )}
    </article>
  )
}

function DataTable({ id, head, rows }: { id: string; head: Pair[]; rows: (string | number)[][] }) {
  const cell = (j: number) => cn('border-b border-line px-2 py-1.5', j > 0 && 'text-right')
  return (
    <table data-testid={`table-${id}`} className="w-full border-collapse text-[13px]">
      <thead>
        <tr>
          {head.map((h, j) => (
            <th key={h.en} scope="col" className={cn(cell(j), 'font-semibold text-tx-2')}>
              {h.th} <En>{h.en}</En>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td key={j} className={cn(cell(j), 'font-mono tabular-nums')}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const Total = ({ id, value }: { id: string; value: string }) => (
  <span className="flex flex-col text-right text-[12.5px] leading-tight whitespace-nowrap text-tx-3">
    <b data-testid={`total-${id}`} className="font-mono text-xl text-tx">
      {value}
    </b>
    <span>{bi(t.total7)}</span>
  </span>
)

const Tip = ({ children }: { children: ReactNode }) => (
  <div className="rounded-lg border border-line-2 bg-surface px-2.5 py-2 text-[13px] leading-snug whitespace-nowrap text-tx shadow-pop">
    {children}
  </div>
)
const rowOf = <T,>(p: TooltipContentProps) => (p.active && p.payload?.length ? (p.payload[0].payload as T) : null)
const dayName = (d: DayPoint) => `${d.today ? t.today.th : d.th} ${d.dm}`

// X tick: Thai day over dd/mm; today bold and named "วันนี้".
const dayTickOf = (points: DayPoint[]) =>
  function DayTick(p: XAxisTickContentProps) {
    const d = points.find((x) => x.date === p.payload.value)
    if (!d) return null
    return (
      <g transform={`translate(${p.x},${p.y})`} fontWeight={d.today ? 700 : 400}>
        <text textAnchor="middle" dy={10} fontSize={12} fill={d.today ? C.tx : C.tx2}>
          {d.today ? t.today.th : d.th}
        </text>
        <text textAnchor="middle" dy={25} fontSize={12} fontFamily={MONO} fill={d.today ? C.tx : C.tx3}>
          {d.dm}
        </text>
      </g>
    )
  }

// Name the focusable chart SVG (otherwise it is an unnamed tab stop).
const a11y = (title: Pair) => ({ title: bi(title), 'aria-label': bi(title) })

const dataLabel = { fill: C.tx, fontSize: 13, fontWeight: 700, fontFamily: MONO, textAnchor: 'middle' as const }

// Value label for the one bar that carries a `label` value (today). Looked up by value, never by index:
// Recharts leaves zero-height bars out of the label list, so indexes shift after an earlier 0 day.
export function TodayBarLabel(p: LabelProps) {
  if (p.value == null || p.value === '') return null
  return (
    <text {...dataLabel} x={Number(p.x) + Number(p.width) / 2} y={Number(p.y) - 7}>
      {p.value}
    </text>
  )
}

function DayBars({ points, field, color, unit, title }: { points: DayPoint[]; field: 'detections' | 'pipesActual'; color: string; unit: Pair; title: Pair }) {
  const animate = useAnimate()
  const data = points.map((d) => ({ ...d, label: d.today ? d[field] : null }))
  return (
    <ResponsiveContainer width="100%" height={H} initialDimension={{ width: 320, height: H }}>
      <BarChart data={data} margin={{ top: 24, right: 6, bottom: 0, left: 0 }} {...a11y(title)}>
        <CartesianGrid vertical={false} stroke={C.grid} />
        <XAxis dataKey="date" interval={0} height={42} tickLine={false} axisLine={{ stroke: C.base }} tick={dayTickOf(points)} />
        <YAxis width={44} allowDecimals={false} tickLine={false} axisLine={false} tick={axisTick} />
        <Tooltip
          cursor={hoverBand}
          isAnimationActive={false}
          content={(p) => {
            const d = rowOf<DayPoint>(p)
            return (
              d && (
                <Tip>
                  {dayName(d)}
                  <br />
                  <b className="font-mono">{d[field].toLocaleString('en-US')}</b> {unit.th} <En>{unit.en}</En>
                </Tip>
              )
            )
          }}
        />
        <Bar dataKey={field} fill={color} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={animate}>
          <LabelList dataKey="label" content={TodayBarLabel} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function RateLine({ points }: { points: DayPoint[] }) {
  const animate = useAnimate()
  const max = points.some((p) => (p.pct ?? 0) > 50) ? 100 : 50
  const ticks = Array.from({ length: 6 }, (_, i) => (max / 5) * i)
  const last = points.length - 1
  // `gap: 0` feeds an invisible line so every day (even a null-rate one) has a tooltip payload.
  const data = points.map((p) => ({ ...p, gap: 0 }))
  const endLabel = (p: LabelProps) => {
    const d = points[p.index ?? -1]
    if (p.index !== last || d?.pct == null) return null
    return (
      <text {...dataLabel} x={Number(p.x)} y={Number(p.y) - 16}>
        {formatPct(d.correctionRate)}
      </text>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={H} initialDimension={{ width: 320, height: H }}>
      <LineChart data={data} margin={{ top: 24, right: 12, bottom: 0, left: 0 }} {...a11y(t.chartRate)}>
        <CartesianGrid vertical={false} stroke={C.grid} />
        <XAxis dataKey="date" interval={0} height={42} tickLine={false} axisLine={{ stroke: C.base }} tick={dayTickOf(points)} padding={{ left: 16, right: 16 }} />
        <YAxis width={44} domain={[0, max]} ticks={ticks} tickFormatter={(v: number) => `${v}%`} tickLine={false} axisLine={false} tick={axisTick} />
        <Tooltip
          cursor={{ stroke: C.tx3, strokeWidth: 1 }}
          isAnimationActive={false}
          content={(p) => {
            const d = rowOf<DayPoint>(p)
            if (!d) return null
            return (
              <Tip>
                {dayName(d)}
                <br />
                {d.correctionRate === null ? (
                  bi(t.dayNothingConfirmed)
                ) : (
                  <>
                    <b className="font-mono">{formatPct(d.correctionRate)}</b> {bi(t.rateOf(d.corrected, d.confirmed))}
                  </>
                )}
              </Tip>
            )
          }}
        />
        <Line dataKey="gap" stroke="none" dot={false} activeDot={false} isAnimationActive={false} legendType="none" />
        {/* null days stay gaps (connectNulls off), never drawn as 0 %. */}
        <Line
          dataKey="pct"
          stroke={C.viz1}
          strokeWidth={2}
          connectNulls={false}
          dot={{ r: 5, fill: C.viz1, stroke: C.surface, strokeWidth: 2 }}
          activeDot={{ r: 6, fill: C.viz1, stroke: C.surface, strokeWidth: 2 }}
          isAnimationActive={animate}
        >
          <LabelList dataKey="pct" content={endLabel} />
        </Line>
      </LineChart>
    </ResponsiveContainer>
  )
}

// Dot plot: model = hollow blue ring, actual = violet square, grey connector when they differ.
// The signed difference sits in a column on the right (design flag 8: 1-3 pipes vs ~100 look tiny).
function ModelVsActual({ rows }: { rows: MvaRow[] }) {
  const animate = useAnimate()
  const [lo, hi] = valueDomain(rows)
  const ticks = Array.from({ length: (hi - lo) / 20 + 1 }, (_, i) => lo + i * 20)
  const data = rows.map((r) => ({ ...r, edge: hi }))
  const height = 8 + rows.length * 27 + 28
  const byKey = (k: unknown) => rows.find((r) => r.key === k)
  type Dot = { cx?: number; cy?: number; index?: number }
  const ring = ({ cx, cy, index }: Dot) => <circle key={index} cx={cx} cy={cy} r={7.5} fill="none" stroke={C.viz1} strokeWidth={2.5} />
  const square = ({ cx = 0, cy = 0, index }: Dot) => <rect key={index} x={cx - 4} y={cy - 4} width={8} height={8} rx={1.5} fill={C.viz2} />
  const diffLabel = (p: LabelProps) => {
    const r = rows[p.index ?? -1]
    if (!r) return null
    return (
      <text
        x={Number(p.x) + 44}
        y={Number(p.y) + 4}
        textAnchor="end"
        fontSize={13}
        fontFamily={MONO}
        fontWeight={r.diff ? 700 : 400}
        fill={r.diff ? C.tx : C.tx3}
      >
        {r.diffLabel}
      </text>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={height} initialDimension={{ width: 320, height }}>
      <ComposedChart layout="vertical" data={data} margin={{ top: 8, right: 48, bottom: 0, left: 0 }} accessibilityLayer={false}>
        <CartesianGrid horizontal={false} stroke={C.grid} />
        <XAxis type="number" domain={[lo, hi]} ticks={ticks} tickLine={false} axisLine={false} tick={axisTick} height={28} />
        <YAxis
          type="category"
          dataKey="key"
          width={96}
          tickLine={false}
          axisLine={false}
          tick={{ fill: C.tx2, fontSize: 12, fontFamily: MONO }}
          tickFormatter={(k: string) => byKey(k)?.label ?? ''}
        />
        <Tooltip
          cursor={hoverBand}
          isAnimationActive={false}
          content={(p) => {
            const r = rowOf<MvaRow>(p)
            return (
              r && (
                <Tip>
                  <b className="font-mono">{r.label}</b>
                  <br />
                  {t.colModel.th} <En>{t.colModel.en}</En> <b className="font-mono">{r.model}</b> · {t.colActual.th} <En>{t.colActual.en}</En>{' '}
                  <b className="font-mono">{r.actual}</b> ({r.diffLabel})
                </Tip>
              )
            )
          }}
        />
        <Bar dataKey="range" barSize={2} fill={C.base} isAnimationActive={animate} />
        <Line dataKey="actual" stroke="none" dot={square} activeDot={false} isAnimationActive={false} />
        <Line dataKey="model" stroke="none" dot={ring} activeDot={false} isAnimationActive={false} />
        <Line dataKey="edge" stroke="none" dot={false} activeDot={false} isAnimationActive={false}>
          <LabelList dataKey="diffLabel" content={diffLabel} />
        </Line>
      </ComposedChart>
    </ResponsiveContainer>
  )
}

// Recharts animation off under prefers-reduced-motion.
function useAnimate() {
  const [animate] = useState(() => !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  return animate
}

export default function DashboardCharts({ days, confirmed }: { days: DailyStat[]; confirmed: RecordRow[] }) {
  const points = toDaySeries(days)
  const rows = toModelVsActual(confirmed)
  const dayRows = (f: (p: DayPoint) => string | number) => points.map((p) => [p.date, f(p)])
  return (
    <>
      <Card
        id="c-det"
        title={t.chartDetections}
        aside={<Total id="detections" value={String(total(points, 'detections'))} />}
        table={<DataTable id="detections" head={[t.colDate, t.colBatches]} rows={dayRows((p) => p.detections)} />}
      >
        <DayBars points={points} field="detections" color={C.viz1} unit={t.colBatches} title={t.chartDetections} />
      </Card>
      <Card
        id="c-pipes"
        title={t.chartPipes}
        aside={<Total id="pipes" value={total(points, 'pipesActual').toLocaleString('en-US')} />}
        table={<DataTable id="pipes" head={[t.colDate, t.colPipes]} rows={dayRows((p) => p.pipesActual)} />}
      >
        <DayBars points={points} field="pipesActual" color={C.viz2} unit={t.colPipes} title={t.chartPipes} />
      </Card>
      <Card
        id="c-rate"
        title={t.chartRate}
        note={t.rateGapNote}
        table={
          <DataTable
            id="rate"
            head={[t.colDate, t.colRate, t.colConfirmedN]}
            rows={points.map((p) => [p.date, formatPct(p.correctionRate), p.confirmed])}
          />
        }
      >
        <RateLine points={points} />
      </Card>
      <Card
        id="c-mva"
        title={t.chartMva}
        legend={
          rows.length > 0 && (
            <ul aria-label={bi(t.legend)} className="flex flex-wrap gap-x-4 gap-y-1 px-4 pt-1 text-[13px] text-tx-2">
              <li className="flex items-center gap-1.5">
                <span aria-hidden="true" className="size-3.5 rounded-full border-[2.5px] border-viz-1" />
                {t.colModel.th} <En>{t.colModel.en}</En>
              </li>
              <li className="flex items-center gap-1.5">
                <span aria-hidden="true" className="size-[11px] rounded-[2px] bg-viz-2" />
                {t.colActual.th} <En>{t.colActual.en}</En>
              </li>
            </ul>
          )
        }
        table={
          rows.length > 0 && (
            <DataTable
              id="mva"
              head={[t.doNumber, t.colModel, t.colActual, t.colDiff]}
              rows={rows.map((r) => [r.label, r.model, r.actual, r.diffLabel])}
            />
          )
        }
      >
        {rows.length > 0 ? (
          <ModelVsActual rows={rows} />
        ) : (
          <p data-testid="mva-empty" className="flex min-h-[120px] items-center justify-center px-2 text-sm text-tx-3">
            {bi(t.nothingConfirmed)}
          </p>
        )}
      </Card>
    </>
  )
}
