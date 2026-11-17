import { describe, expect, it } from 'vitest'
import type { Box } from '@/lib/detection'
import { MAX_ZOOM, nextScale, panBy, zoomAt, zoomToBox, zoomedViewBox } from '@/lib/zoom'

const base: Box = [0, 0, 200, 100]

describe('zoomedViewBox', () => {
  it('is the base view with no zoom or scale 1', () => {
    expect(zoomedViewBox(base, null)).toEqual(base)
    expect(zoomedViewBox(base, { scale: 1, cx: 10, cy: 10 })).toEqual(base)
  })
  it('shrinks around the centre', () => {
    expect(zoomedViewBox(base, { scale: 2, cx: 100, cy: 50 })).toEqual([50, 25, 100, 50])
  })
  it('stays inside the base view at the edges', () => {
    expect(zoomedViewBox(base, { scale: 2, cx: 0, cy: 0 })).toEqual([0, 0, 100, 50])
    expect(zoomedViewBox(base, { scale: 2, cx: 999, cy: 999 })).toEqual([100, 50, 100, 50])
  })
  it('respects a base view that does not start at 0 (crop view)', () => {
    expect(zoomedViewBox([40, 20, 100, 100], { scale: 4, cx: 0, cy: 0 })).toEqual([40, 20, 25, 25])
  })
})

describe('nextScale', () => {
  it('steps 1 -> 1.5 -> 2 -> 3 -> 4 and back, clamped', () => {
    expect(nextScale(1, 1)).toBe(1.5)
    expect(nextScale(2, 1)).toBe(3)
    expect(nextScale(MAX_ZOOM, 1)).toBe(MAX_ZOOM)
    expect(nextScale(3, -1)).toBe(2)
    expect(nextScale(1.5, -1)).toBe(1)
    expect(nextScale(1, -1)).toBe(1)
    expect(nextScale(2.4, 1)).toBe(3) // after a wheel zoom
  })
})

describe('zoomAt', () => {
  it('keeps the point under the cursor in place', () => {
    const z = zoomAt(base, base, { x: 50, y: 25 }, 2)
    const vb = zoomedViewBox(base, z)
    // 50 was 25% across the old view; it is still 25% across the new one.
    expect((50 - vb[0]) / vb[2]).toBeCloseTo(0.25)
    expect((25 - vb[1]) / vb[3]).toBeCloseTo(0.25)
  })
  it('clamps the scale to 1..MAX_ZOOM', () => {
    expect(zoomAt(base, base, { x: 1, y: 1 }, 0.2).scale).toBe(1)
    expect(zoomAt(base, base, { x: 1, y: 1 }, 99).scale).toBe(MAX_ZOOM)
  })
})

describe('panBy', () => {
  it('moves the view the opposite way of the drag and stops at the edge', () => {
    const z = { scale: 2, cx: 100, cy: 50 }
    expect(panBy(base, z, 10, 5)).toEqual({ scale: 2, cx: 90, cy: 45 })
    expect(panBy(base, z, 500, 500)).toEqual({ scale: 2, cx: 50, cy: 25 })
  })
})

it('zoomToBox centres the box at the given scale', () => {
  expect(zoomToBox(base, [90, 40, 20, 20], 2)).toEqual({ scale: 2, cx: 100, cy: 50 })
  expect(zoomToBox(base, [0, 0, 10, 10], 2)).toEqual({ scale: 2, cx: 50, cy: 25 }) // pushed inside
})
