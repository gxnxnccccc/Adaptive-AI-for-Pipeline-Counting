import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NO_EDITS, addBox, toggleRemoved } from '@/lib/corrections'
import type { DetectedPipe } from '@/lib/detection'
import PhotoViewer, { BoxLegend, toImagePoint, viewBoxFor } from './PhotoViewer'

const pipes: DetectedPipe[] = [
  { box: [100, 100, 50, 50], confidence: 0.9, lowConfidence: false },
  { box: [200, 100, 50, 50], confidence: 0.3, lowConfidence: true },
  { box: [300, 100, 50, 50], confidence: 0.8, lowConfidence: false },
]

function mockRect(el: Element, r: { left: number; top: number; width: number; height: number }) {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ ...r, x: r.left, y: r.top, right: r.left + r.width, bottom: r.top + r.height, toJSON: () => r } as DOMRect)
}

describe('viewBoxFor', () => {
  it('is the whole image in full view, or without a crop box', () => {
    expect(viewBoxFor('full', [100, 100, 200, 100], 1000, 800)).toEqual([0, 0, 1000, 800])
    expect(viewBoxFor('crop', null, 1000, 800)).toEqual([0, 0, 1000, 800])
  })

  it('is the crop box plus padding, kept inside the image', () => {
    // pad = 3% of the short side = 24
    expect(viewBoxFor('crop', [100, 100, 200, 100], 1000, 800)).toEqual([76, 76, 248, 148])
    expect(viewBoxFor('crop', [0, 10, 990, 100], 1000, 800)).toEqual([0, 0, 1000, 134])
  })
})

describe('toImagePoint', () => {
  it('scales screen pixels to image pixels', () => {
    const rect = { left: 10, top: 20, width: 400, height: 300 }
    expect(toImagePoint(10 + 62.5, 20 + 62.5, rect, [0, 0, 800, 600])).toEqual({ x: 125, y: 125 })
  })

  it('handles letterboxing (meet) and a cropped viewBox', () => {
    // 800x600 image in a 400x400 box: scale 0.5, 50 px bars top and bottom
    expect(toImagePoint(200, 50, { left: 0, top: 0, width: 400, height: 400 }, [0, 0, 800, 600])).toEqual({ x: 400, y: 0 })
    // crop viewBox starting at (76, 76), drawn at 2x
    expect(toImagePoint(10, 20, { left: 0, top: 0, width: 496, height: 296 }, [76, 76, 248, 148])).toEqual({ x: 81, y: 86 })
  })
})

describe('PhotoViewer', () => {
  it('draws one rect per pipe and per added box with the legend styles', () => {
    const edits = addBox(toggleRemoved(NO_EDITS, 2), [400, 100, 50, 50])
    const { container } = render(
      <PhotoViewer src="x.jpg" width={800} height={600} pipes={pipes} edits={edits} label="IMG_1.jpg" />,
    )
    const rects = [...container.querySelectorAll('rect.box')]
    expect(rects).toHaveLength(4)
    expect(rects[0]).toHaveClass('box-ok')
    expect(rects[1]).toHaveClass('box-low')
    expect(rects[2]).toHaveClass('box-removed')
    expect(rects[3]).toHaveClass('box-added')
    expect(container.querySelectorAll('line.strike')).toHaveLength(1)
    expect(screen.getByRole('img', { name: 'IMG_1.jpg' })).toBeInTheDocument()
  })

  it('reports a click on a box in image pixels (its centre)', () => {
    const onPick = vi.fn()
    const { container } = render(
      <PhotoViewer src="x.jpg" width={800} height={600} pipes={pipes} edits={NO_EDITS} view="full" onPick={onPick} />,
    )
    mockRect(container.querySelector('svg')!, { left: 0, top: 0, width: 400, height: 300 })
    fireEvent.click(container.querySelectorAll('rect.box')[0], { clientX: 62.5, clientY: 62.5 })
    expect(onPick).toHaveBeenCalledWith({ x: 125, y: 125 })
  })

  it('sets the viewBox to the padded crop box in crop view', () => {
    const { container } = render(
      <PhotoViewer src="x.jpg" width={1000} height={800} pipes={pipes} view="crop" cropBox={[100, 100, 200, 100]} />,
    )
    expect(container.querySelector('svg')).toHaveAttribute('viewBox', '76 76 248 148')
  })

  it('ignores clicks outside the image and in read-only mode', () => {
    const onPick = vi.fn()
    const { container, rerender } = render(
      <PhotoViewer src="x.jpg" width={800} height={600} pipes={pipes} view="full" onPick={onPick} />,
    )
    const svg = container.querySelector('svg')!
    mockRect(svg, { left: 0, top: 0, width: 400, height: 400 })
    fireEvent.click(svg, { clientX: 200, clientY: 20 }) // in the letterbox bar above the photo
    rerender(<PhotoViewer src="x.jpg" width={800} height={600} pipes={pipes} view="full" onPick={onPick} readOnly />)
    fireEvent.click(svg, { clientX: 200, clientY: 200 })
    expect(onPick).not.toHaveBeenCalled()
  })
})

describe('BoxLegend', () => {
  it('lists the 4 box styles in Thai and English', () => {
    render(<BoxLegend />)
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(4)
    expect(items[0]).toHaveTextContent('ตรวจพบ')
    expect(items[0]).toHaveTextContent('Detected')
    expect(items[3]).toHaveTextContent('Added by you')
  })
})
