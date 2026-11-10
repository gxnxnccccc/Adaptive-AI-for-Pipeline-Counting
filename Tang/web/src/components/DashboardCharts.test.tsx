import { fireEvent, render } from '@testing-library/react'
import { cloneElement, type ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DailyStat, RecordRow } from '@/lib/api'
import DashboardCharts, { TodayBarLabel } from './DashboardCharts'

const day = (date: string, detections: number, pipesActual: number, confirmed = 0): DailyStat => ({
  date,
  detections,
  pipesActual,
  confirmed,
  corrected: 0,
  correctionRate: confirmed ? 0 : null,
})
// jsdom has no layout, so ResponsiveContainer would render nothing: give the chart a fixed size instead.
vi.mock('recharts', async (orig) => ({
  ...(await orig<typeof import('recharts')>()),
  ResponsiveContainer: ({ children, height }: { children: ReactElement<{ width: number; height: number }>; height: number }) =>
    cloneElement(children, { width: 480, height }),
}))

// A 0 day sits before today (weekend): Recharts drops its bar, which used to shift the label index.
const WEEK = [
  day('2026-11-03', 7, 612, 3),
  day('2026-11-04', 10, 845, 5),
  day('2026-11-05', 8, 702, 7),
  day('2026-11-06', 11, 930, 9),
  day('2026-11-07', 4, 310, 4),
  day('2026-11-08', 0, 0),
  day('2026-11-09', 12, 796, 8),
]

describe('TodayBarLabel', () => {
  it('prints the value above the bar; nothing when the entry has no label value', () => {
    const { container } = render(
      <svg>
        <TodayBarLabel value={12} x={10} y={50} width={20} />
        <TodayBarLabel value={null} x={40} y={50} width={20} />
      </svg>,
    )
    const texts = container.querySelectorAll('text')
    expect(texts).toHaveLength(1)
    expect(texts[0]).toHaveTextContent('12')
    expect(texts[0]).toHaveAttribute('x', '20')
    expect(texts[0]).toHaveAttribute('y', '43')
  })
})

describe('DashboardCharts', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('labels today even when an earlier day is 0, and names every chart svg', () => {
    // reduced motion -> no animation, so the label list is in the DOM right away
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))
    const { container } = render(<DashboardCharts days={WEEK} confirmed={[] as RecordRow[]} />)
    const labels = [...container.querySelectorAll('.recharts-label-list text')].map((n) => n.textContent)
    expect(labels).toContain('12') // detections today
    expect(labels).toContain('796') // pipes today
    for (const svg of container.querySelectorAll('svg[role="application"]')) {
      expect(svg.getAttribute('aria-label') ?? '').not.toBe('')
    }
  })
})

describe('correction-rate tooltip', () => {
  it('a day with nothing confirmed still gets a tooltip ("nothing confirmed")', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))
    const { container } = render(<DashboardCharts days={WEEK} confirmed={[]} />)
    const svg = container.querySelectorAll('svg.recharts-surface')[2]
    // Keyboard path of the accessibility layer: focus, then ArrowRight (focus lands on day 0) until the 0 day (index 5).
    ;(svg as SVGElement).focus()
    for (let i = 0; i < 5; i++) fireEvent.keyDown(svg, { key: 'ArrowRight' })
    const tips = [...container.querySelectorAll('.recharts-tooltip-wrapper')].map((n) => n.textContent)
    expect(tips.join('|')).toMatch(/08\/11.*nothing confirmed/)
    vi.unstubAllGlobals()
  })
})
