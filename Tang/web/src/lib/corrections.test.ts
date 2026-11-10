import { describe, expect, it } from 'vitest'
import type { DetectedImage, DetectedPipe } from './detection'
import {
  DEFAULT_BOX_FRACTION,
  NO_EDITS,
  addBox,
  boxAt,
  correctedCount,
  deleteAdded,
  hasEdits,
  hitTest,
  medianSize,
  toCorrections,
  toggleRemoved,
  totals,
  undo,
  type PhotoEdits,
} from './corrections'

const pipe = (box: DetectedPipe['box'], confidence = 0.9): DetectedPipe => ({
  box,
  confidence,
  lowConfidence: confidence < 0.5,
})

const image = (imageId: string, pipes: DetectedPipe[], error: string | null = null): DetectedImage => ({
  imageId,
  filename: `${imageId}.jpg`,
  count: error ? 0 : pipes.length,
  cropBox: null,
  pipes,
  brightness: null,
  originalBytes: 1000,
  error,
})

describe('toggleRemoved', () => {
  it('removes a model box, then restores it', () => {
    const removed = toggleRemoved(NO_EDITS, 3)
    expect(removed.removed).toEqual([3])
    expect(toggleRemoved(removed, 3).removed).toEqual([])
  })

  it('keeps removed indexes sorted', () => {
    const e = toggleRemoved(toggleRemoved(toggleRemoved(NO_EDITS, 5), 0), 2)
    expect(e.removed).toEqual([0, 2, 5])
  })

  it('does not mutate the input', () => {
    toggleRemoved(NO_EDITS, 1)
    expect(NO_EDITS).toEqual({ removed: [], added: [], history: [] })
  })
})

describe('addBox / deleteAdded', () => {
  it('adds a box and deletes it again', () => {
    const e = addBox(addBox(NO_EDITS, [1, 2, 3, 4]), [5, 6, 7, 8])
    expect(e.added).toEqual([
      [1, 2, 3, 4],
      [5, 6, 7, 8],
    ])
    expect(deleteAdded(e, 0).added).toEqual([[5, 6, 7, 8]])
  })
})

describe('undo', () => {
  it('reverts actions newest first', () => {
    let e: PhotoEdits = NO_EDITS
    e = toggleRemoved(e, 1) // remove 1
    e = addBox(e, [10, 10, 5, 5]) // add A
    e = toggleRemoved(e, 1) // restore 1
    e = undo(e)
    expect(e.removed).toEqual([1])
    expect(e.added).toEqual([[10, 10, 5, 5]])
    e = undo(e)
    expect(e.added).toEqual([])
    expect(e.removed).toEqual([1])
    e = undo(e)
    expect(e).toEqual(NO_EDITS)
  })

  it('puts a deleted added box back at its old place', () => {
    let e = addBox(addBox(NO_EDITS, [1, 1, 1, 1]), [2, 2, 2, 2])
    e = deleteAdded(e, 0)
    e = undo(e)
    expect(e.added).toEqual([
      [1, 1, 1, 1],
      [2, 2, 2, 2],
    ])
    e = undo(e) // undo "add [2,2,2,2]"
    expect(e.added).toEqual([[1, 1, 1, 1]])
  })

  it('does nothing with an empty history', () => {
    expect(undo(NO_EDITS)).toBe(NO_EDITS)
  })
})

describe('hasEdits / correctedCount', () => {
  it('is false after remove + restore (net no change)', () => {
    expect(hasEdits(NO_EDITS)).toBe(false)
    expect(hasEdits(toggleRemoved(toggleRemoved(NO_EDITS, 0), 0))).toBe(false)
    expect(hasEdits(addBox(NO_EDITS, [0, 0, 1, 1]))).toBe(true)
  })

  it('is model count - removed + added', () => {
    const e = addBox(addBox(toggleRemoved(NO_EDITS, 0), [0, 0, 1, 1]), [2, 2, 1, 1])
    expect(correctedCount(44, e)).toBe(45)
    expect(correctedCount(44, undefined)).toBe(44)
  })
})

describe('medianSize', () => {
  it('uses the median width and height of the model boxes', () => {
    const pipes = [pipe([0, 0, 10, 20]), pipe([0, 0, 30, 40]), pipe([0, 0, 50, 60])]
    expect(medianSize(pipes, 800, 600)).toEqual({ w: 30, h: 40 })
  })

  it('averages the two middle sizes for an even count', () => {
    const pipes = [pipe([0, 0, 10, 10]), pipe([0, 0, 20, 30]), pipe([0, 0, 40, 50]), pipe([0, 0, 90, 90])]
    expect(medianSize(pipes, 800, 600)).toEqual({ w: 30, h: 40 })
  })

  it('falls back to a square of DEFAULT_BOX_FRACTION of the short side with no pipes', () => {
    const side = DEFAULT_BOX_FRACTION * 600
    expect(medianSize([], 800, 600)).toEqual({ w: side, h: side })
  })
})

describe('boxAt', () => {
  it('centres the box on the point', () => {
    expect(boxAt({ x: 100, y: 200 }, { w: 40, h: 20 }, 800, 600)).toEqual([80, 190, 40, 20])
  })

  it('clamps the box inside the image at the edges', () => {
    expect(boxAt({ x: 5, y: 595 }, { w: 40, h: 20 }, 800, 600)).toEqual([0, 580, 40, 20])
    expect(boxAt({ x: 799, y: 2 }, { w: 40, h: 20 }, 800, 600)).toEqual([760, 0, 40, 20])
  })

  it('shrinks a box bigger than the image to the image', () => {
    expect(boxAt({ x: 50, y: 50 }, { w: 300, h: 300 }, 200, 100)).toEqual([0, 0, 200, 100])
  })
})

describe('hitTest', () => {
  const pipes = [pipe([0, 0, 100, 100]), pipe([50, 50, 100, 100])]

  it('returns null on empty space', () => {
    expect(hitTest({ x: 300, y: 300 }, pipes, [])).toBeNull()
  })

  it('returns the topmost (last drawn) model box', () => {
    expect(hitTest({ x: 10, y: 10 }, pipes, [])).toEqual({ kind: 'model', index: 0 })
    expect(hitTest({ x: 75, y: 75 }, pipes, [])).toEqual({ kind: 'model', index: 1 })
  })

  it('checks added boxes before model boxes', () => {
    const added: DetectedPipe['box'][] = [
      [60, 60, 20, 20],
      [70, 70, 20, 20],
    ]
    expect(hitTest({ x: 75, y: 75 }, pipes, added)).toEqual({ kind: 'added', index: 1 })
    expect(hitTest({ x: 65, y: 65 }, pipes, added)).toEqual({ kind: 'added', index: 0 })
  })

  it('counts the box edge as inside', () => {
    expect(hitTest({ x: 100, y: 0 }, [pipe([0, 0, 100, 100])], [])).toEqual({ kind: 'model', index: 0 })
  })
})

describe('totals / toCorrections', () => {
  const photos = [
    { id: 'p1', result: image('img_1', [pipe([0, 0, 1, 1]), pipe([2, 2, 1, 1]), pipe([4, 4, 1, 1])]) },
    { id: 'p2', result: image('img_2', [pipe([0, 0, 1, 1])]) },
    { id: 'p3', result: image('img_3', [], 'cannot decode image') },
    { id: 'p4', result: image('img_4', [pipe([0, 0, 1, 1]), pipe([3, 3, 1, 1])]) },
  ]
  const edits: Record<string, PhotoEdits> = {
    p1: addBox(toggleRemoved(toggleRemoved(NO_EDITS, 2), 0), [9.5, 9.5, 3, 3]),
    p2: toggleRemoved(toggleRemoved(NO_EDITS, 0), 0), // removed then restored = no change
    p3: addBox(NO_EDITS, [1, 1, 1, 1]), // failed photo: ignored
  }

  it('sums model and corrected counts over non-failed photos', () => {
    expect(totals(photos, edits)).toEqual({ model: 6, corrected: 5, removed: 2, added: 1 })
  })

  it('builds the confirm payload only for edited, non-failed photos', () => {
    expect(toCorrections(photos, edits)).toEqual([
      { image_id: 'img_1', removed: [0, 2], added: [[9.5, 9.5, 3, 3]] },
    ])
  })

  it('sends [] for an empty list (both fields required in the API type)', () => {
    const onlyAdd = { p4: addBox(NO_EDITS, [1, 1, 2, 2]) }
    expect(toCorrections(photos, onlyAdd)).toEqual([{ image_id: 'img_4', removed: [], added: [[1, 1, 2, 2]] }])
  })

  it('returns [] when nothing was edited', () => {
    expect(toCorrections(photos, {})).toEqual([])
  })
})
