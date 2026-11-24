import { useEffect } from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AppShell from '@/components/AppShell'
import { downloadBlob, renderAnnotatedPng } from '@/lib/annotate'
import { confirmBatch, findSavedDo, getHealth, getStats, type RecordRow } from '@/lib/api'
import { AuthProvider } from '@/lib/auth'
import type { Box } from '@/lib/detection'
import { DetectionSessionProvider, useDetectionSession, type SessionPhoto } from '@/lib/detection-session'
import Processing from '@/pages/Processing'
import Result from '@/pages/Result'

vi.mock('@/lib/api', () => ({
  uploadImages: vi.fn(),
  getHealth: vi.fn(),
  confirmBatch: vi.fn(),
  getStats: vi.fn(),
  findSavedDo: vi.fn(),
}))
vi.mock('@/lib/annotate', async (orig) => ({
  ...(await orig<typeof import('@/lib/annotate')>()),
  renderAnnotatedPng: vi.fn(),
  downloadBlob: vi.fn(),
}))

// 100x100 photos. A: 2 pipes (2nd low confidence), no crop box. B: 1 pipe, crop box. F: detection failed.
const pipe = (x: number, confidence: number) => ({ box: [x, 10, 20, 20] as Box, confidence, lowConfidence: confidence < 0.5 })
function photo(id: string, pipes: ReturnType<typeof pipe>[], extra: Partial<SessionPhoto['result']> = {}): SessionPhoto {
  return {
    id,
    original: new File(['original'], `${id}.jpg`, { type: 'image/jpeg' }),
    upload: new File(['up'], `${id}-small.jpg`, { type: 'image/jpeg' }),
    originalBytes: 8,
    uploadBytes: 2,
    width: 100,
    height: 100,
    quality: null,
    result: {
      imageId: `img_${id}`,
      filename: `${id}-small.jpg`,
      count: pipes.length,
      cropBox: null,
      pipes,
      brightness: 'ok',
      originalBytes: 8,
      error: null,
      ...extra,
    },
  }
}
const A = photo('a', [pipe(10, 0.9), pipe(50, 0.3)])
const B = photo('b', [pipe(10, 0.8)], { cropBox: [0, 0, 50, 50] })
const F = photo('f', [], { count: 0, error: 'Could not read the image', brightness: null })

let api: { session: ReturnType<typeof useDetectionSession>; navigate: ReturnType<typeof useNavigate> }
function Probe() {
  const session = useDetectionSession()
  const navigate = useNavigate()
  useEffect(() => {
    api = { session, navigate }
  })
  return null
}

// Seeds the session like Processing does, then opens /result inside the real shell.
async function openResult(photos: SessionPhoto[] = [A, B, F]) {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/processing']}>
      <AuthProvider>
        <DetectionSessionProvider>
          <Probe />
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/processing" element={<Processing />} />
              <Route path="/result" element={<Result />} />
            </Route>
          </Routes>
        </DetectionSessionProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
  act(() => api.session.start('3f9c0000-1111-2222-3333-4444a21e', photos))
  act(() => api.navigate('/result'))
  await screen.findByRole('img', { name: /^a\.jpg/ })
  return { user }
}

const viewer = (name: RegExp = /^a\.jpg/) => screen.getByRole('img', { name })
// Client px = image px: the svg is mocked to 100x100 at (0, 0), same as the photo.
const tap = (x: number, y: number, name?: RegExp) => fireEvent.click(viewer(name), { clientX: x, clientY: y })
const count = () => screen.getByTestId('photo-count')
const thumbs = () => screen.getAllByTestId('strip-thumb')
const undoBtn = () => screen.getByRole('button', { name: /Undo/ })

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  localStorage.setItem('spds.operator', 'OP-7')
  let n = 0
  URL.createObjectURL = vi.fn(() => `blob:fake-${n++}`)
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, x: 0, y: 0, width: 100, height: 100, right: 100, bottom: 100, toJSON: () => ({}),
  } as DOMRect)
  vi.mocked(getHealth).mockResolvedValue(true)
  vi.mocked(getStats).mockResolvedValue({ detectionsToday: 0, confirmedTotal: 0, correctionRate: null, failedImagesToday: 0 })
  vi.mocked(confirmBatch).mockReset()
  vi.mocked(findSavedDo).mockReset().mockResolvedValue(null)
  vi.mocked(renderAnnotatedPng).mockReset().mockResolvedValue(new Blob(['png']))
  vi.mocked(downloadBlob).mockReset()
})
afterEach(() => vi.restoreAllMocks())

describe('Result viewer card', () => {
  it('shows the header (back, step 2, batch chip) and the first photo with its count and to-check chip', async () => {
    await openResult()
    expect(screen.getByRole('link', { name: /Back to processing/ })).toHaveAttribute('href', '/processing')
    expect(screen.getByTestId('flow').querySelector('[aria-current="step"]')).toHaveTextContent(/2.*Review & confirm/)
    expect(screen.getByTestId('batch-chip')).toHaveTextContent('Batch3f9c…a21e· draft')
    expect(screen.getByText('Photo 1 of 3', { exact: false })).toBeInTheDocument()
    expect(count()).toHaveTextContent('2')
    expect(screen.getByTestId('to-check')).toHaveTextContent(/ควรตรวจ 1/)
    expect(thumbs()).toHaveLength(3)
    expect(thumbs()[0]).toHaveAttribute('aria-pressed', 'true')
    // Numbered, so two photos with the same name are still told apart.
    expect(thumbs().map((b) => within(b).getByTestId('thumb-num').textContent)).toEqual(['1', '2', '3'])
    expect(thumbs()[1]).toHaveAccessibleName(/^รูปที่ 2\/3 · Photo 2 of 3: /)
    // Cancel is a quiet text link, not a second red button next to Submit.
    expect(screen.getByTestId('cancel-detection')).not.toHaveClass('text-err')
    expect(screen.getByTestId('cancel-detection')).toHaveClass('underline')
  })

  it('to-check chip toggles "show only boxes to check": confident boxes fade, low ones stay', async () => {
    const user = userEvent.setup()
    await openResult()
    const chip = screen.getByTestId('to-check')
    expect(chip).toHaveAttribute('aria-pressed', 'false')
    expect(viewer().querySelectorAll('.box-faded')).toHaveLength(0)
    await user.click(chip)
    expect(chip).toHaveAttribute('aria-pressed', 'true')
    expect(viewer().querySelectorAll('.box-faded')).toHaveLength(1)
    expect(viewer().querySelectorAll('.box-low')).toHaveLength(1)
    expect(viewer().querySelector('.box-low')).not.toHaveClass('box-faded')
    await user.click(chip)
    expect(viewer().querySelectorAll('.box-faded')).toHaveLength(0)
  })

  describe('zoom + shortcuts', () => {
    const vb = () => viewer().getAttribute('viewBox')
    const level = () => screen.getByTestId('zoom-level')
    const key = (code: string, target: Element | Window = window) => fireEvent.keyDown(target, { code })

    it('zoom buttons step 100 -> 150 -> 200 % and reset; taps still hit the right box when zoomed', async () => {
      const user = userEvent.setup()
      await openResult()
      expect(level()).toHaveTextContent('100%')
      expect(screen.getByRole('button', { name: /Zoom out/ })).toBeDisabled()
      await user.click(screen.getByRole('button', { name: /Zoom in/ }))
      expect(level()).toHaveTextContent('150%')
      await user.click(screen.getByRole('button', { name: /Zoom in/ }))
      expect(level()).toHaveTextContent('200%')
      expect(vb()).toBe('25 25 50 50')
      // Low box (50,10 20x20) at image (60, 27) = client ((60-25)*2, (27-25)*2) in the zoomed view.
      tap(70, 4)
      expect(count()).toHaveTextContent('1')
      await user.click(level())
      expect(level()).toHaveTextContent('100%')
      expect(vb()).toBe('0 0 100 100')
    })

    it('dragging a zoomed photo pans it and is not a tap', async () => {
      const user = userEvent.setup()
      await openResult()
      await user.click(screen.getByRole('button', { name: /Zoom in/ }))
      await user.click(screen.getByRole('button', { name: /Zoom in/ }))
      fireEvent.pointerDown(viewer(), { pointerId: 1, button: 0, clientX: 50, clientY: 50 })
      fireEvent.pointerMove(viewer(), { pointerId: 1, clientX: 30, clientY: 50 })
      fireEvent.pointerUp(viewer(), { pointerId: 1, clientX: 30, clientY: 50 })
      fireEvent.click(viewer(), { clientX: 30, clientY: 50 })
      expect(vb()).toBe('35 25 50 50') // dragged 20 px left = 10 image px right
      expect(count()).toHaveTextContent('2')
      expect(screen.getByText(/Drag to move/)).toBeInTheDocument()
    })

    it('Ctrl + wheel zooms around the cursor, a plain wheel does not', async () => {
      await openResult()
      fireEvent.wheel(viewer(), { deltaY: -300, clientX: 50, clientY: 50 })
      expect(level()).toHaveTextContent('100%')
      fireEvent.wheel(viewer(), { deltaY: -300, ctrlKey: true, clientX: 50, clientY: 50 })
      expect(level()).toHaveTextContent('272%')
    })

    it('N rings + zooms to the next box to check, Z undoes; both by key position and not while typing', async () => {
      await openResult()
      expect(screen.queryByTestId('box-current')).toBeNull()
      key('KeyN', screen.getByLabelText(/หมายเหตุ/)) // typing in Notes: ignored
      expect(screen.queryByTestId('box-current')).toBeNull()
      key('KeyN')
      expect(screen.getByTestId('box-current')).toBeInTheDocument()
      expect(screen.getByTestId('box-pos')).toHaveTextContent('Box to check 1 of 1')
      expect(level()).toHaveTextContent('300%')
      tap(20, 20) // remove a box (zoomed view: lands somewhere on the photo; any edit will do)
      const after = count().textContent
      expect(undoBtn()).toBeEnabled()
      key('KeyZ')
      expect(count().textContent).not.toBe(after)
      expect(undoBtn()).toBeDisabled()
      // Switching photo clears the ring and the zoom.
      fireEvent.click(thumbs()[1])
      expect(screen.queryByTestId('box-current')).toBeNull()
      expect(level()).toHaveTextContent('100%')
    })
  })

  it('tap a model box removes it (count + strip badge), tap again restores it', async () => {
    await openResult()
    tap(20, 20)
    expect(count()).toHaveTextContent('1')
    expect(viewer().querySelectorAll('.box-removed')).toHaveLength(1)
    expect(within(thumbs()[0]).getByTestId('edited-badge')).toBeInTheDocument()
    expect(thumbs()[0]).toHaveAccessibleName(/a\.jpg, 1 ท่อ · pipes, แก้ไขแล้ว · edited/)
    tap(20, 20)
    expect(count()).toHaveTextContent('2')
    expect(within(thumbs()[0]).queryByTestId('edited-badge')).not.toBeInTheDocument()
  })

  it('tap empty space adds a median-size box; tapping that box deletes it', async () => {
    await openResult()
    tap(80, 80)
    expect(count()).toHaveTextContent('3')
    const added = viewer().querySelector('.box-added')!
    expect([added.getAttribute('x'), added.getAttribute('y'), added.getAttribute('width')]).toEqual(['70', '70', '20'])
    expect(within(thumbs()[0]).getByTestId('edited-badge')).toBeInTheDocument()
    tap(80, 80)
    expect(count()).toHaveTextContent('2')
    expect(viewer().querySelector('.box-added')).toBeNull()
  })

  it('Undo is enabled only with history and reverts the last tap', async () => {
    const { user } = await openResult()
    expect(undoBtn()).toBeDisabled()
    tap(20, 20)
    tap(80, 80)
    expect(count()).toHaveTextContent('2')
    await user.click(undoBtn())
    expect(count()).toHaveTextContent('1')
    await user.click(undoBtn())
    expect(count()).toHaveTextContent('2')
    expect(undoBtn()).toBeDisabled()
  })

  it('Pipe area / Full photo toggle switches the viewBox (default Pipe area)', async () => {
    const { user } = await openResult()
    await user.click(thumbs()[1])
    const crop = screen.getByRole('button', { name: /Pipe area/ })
    const full = screen.getByRole('button', { name: /Full photo/ })
    expect(crop).toHaveAttribute('aria-pressed', 'true')
    expect(viewer(/^b\.jpg/)).toHaveAttribute('viewBox', '0 0 53 53')
    await user.click(full)
    expect(full).toHaveAttribute('aria-pressed', 'true')
    expect(viewer(/^b\.jpg/)).toHaveAttribute('viewBox', '0 0 100 100')
  })

  it('switching photos keeps each photo its own edits', async () => {
    const { user } = await openResult()
    tap(20, 20) // A: 2 -> 1
    await user.click(thumbs()[1])
    expect(count()).toHaveTextContent('1')
    await user.click(screen.getByRole('button', { name: /Full photo/ }))
    tap(20, 20, /^b\.jpg/) // B: 1 -> 0
    expect(count()).toHaveTextContent('0')
    await user.click(thumbs()[0])
    expect(count()).toHaveTextContent('1')
    await user.click(thumbs()[1])
    expect(count()).toHaveTextContent('0')
    expect(screen.getAllByTestId('edited-badge')).toHaveLength(2)
  })

  it('Remove photo drops the photo and its edits; disabled when 1 photo is left', async () => {
    const { user } = await openResult()
    tap(20, 20)
    const removeBtn = () => screen.getByRole('button', { name: /Remove photo/ })
    await user.click(removeBtn())
    expect(thumbs()).toHaveLength(2)
    expect(api.session.edits).toEqual({})
    expect(viewer(/^b\.jpg/)).toBeInTheDocument()
    await user.click(removeBtn())
    expect(thumbs()).toHaveLength(1)
    expect(removeBtn()).toBeDisabled()
  })

  it('a failed photo shows the reason, hides count and toggle, and cannot be edited or saved as result', async () => {
    const { user } = await openResult()
    await user.click(thumbs()[2])
    expect(thumbs()[2]).toHaveAccessibleName(/f\.jpg, ล้มเหลว · failed/)
    expect(screen.getByTestId('viewer-failed')).toHaveTextContent('Could not read the image')
    expect(screen.getByTestId('viewer-failed')).toHaveTextContent('Not counted in the totals')
    expect(screen.queryByTestId('photo-count')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Pipe area/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Save result PNG/ })).toBeDisabled()
    tap(50, 50, /^f\.jpg/)
    expect(api.session.edits).toEqual({})
    expect(undoBtn()).toBeDisabled()
  })

  it('Save original downloads the original file; Save result PNG draws the corrected boxes on the upload file', async () => {
    const { user } = await openResult()
    tap(20, 20)
    await user.click(screen.getByRole('button', { name: /Save original/ }))
    expect(downloadBlob).toHaveBeenCalledWith(A.original, 'a.jpg')
    await user.click(screen.getByRole('button', { name: /Save result PNG/ }))
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(2))
    const [file, pipes, edits] = vi.mocked(renderAnnotatedPng).mock.calls[0]
    expect(file).toBe(A.upload)
    expect(pipes).toBe(A.result.pipes)
    expect(edits?.removed).toEqual([0])
    expect(vi.mocked(downloadBlob).mock.calls[1][1]).toBe('a_result.png')
    expect(screen.getByText(/Downloaded a_result\.png/)).toBeInTheDocument()
  })
})

const saved: RecordRow = {
  batchId: 'abcdef12-0000', createdAt: '2026-11-04T03:00:00Z', operatorId: 'OP-7', doNumber: 'DX1', imageCount: 3,
  modelTotal: 3, actualAmount: 3, variance: 0, status: 'confirmed', flagged: false, notes: 'two hidden', confirmedAt: '2026-11-04T03:05:00Z',
}
const submitBtn = () => screen.getByRole('button', { name: /Submit Detection|Submitting|Try again/ })
const actualInput = () => screen.getByLabelText(/Actual Amount/)
const BATCH = '3f9c0000-1111-2222-3333-4444a21e'

describe('Result panel: totals + confirm (8c)', () => {
  it('totals: model -> corrected over non-failed photos, edit chips, photos counted, per-photo list', async () => {
    await openResult()
    expect(screen.getByTestId('model-total')).toHaveTextContent('3')
    expect(screen.getByTestId('corrected-total')).toHaveTextContent('3')
    expect(screen.getByTestId('edit-chips')).toHaveTextContent('No corrections yet')
    expect(screen.getByTestId('photos-counted')).toHaveTextContent('2/3')
    expect(screen.getByTestId('photos-counted')).toHaveTextContent('1 failed')
    expect(screen.getByTestId('mean-conf')).toHaveTextContent('67%') // (0.9 + 0.3 + 0.8) / 3
    tap(20, 20) // remove a box on A
    tap(80, 80) // add one on A
    tap(80, 50) // and another
    expect(screen.getByTestId('corrected-total')).toHaveTextContent('4')
    expect(screen.getByTestId('edit-chips')).toHaveTextContent(/1ลบremoved/)
    expect(screen.getByTestId('edit-chips')).toHaveTextContent(/2เพิ่มadded/)
    const per = screen.getByRole('list', { name: /Per photo/ })
    expect(per).toHaveTextContent('a.jpg2 → 3')
    expect(per).toHaveTextContent(/f\.jpg— ล้มเหลว/)
  })

  it('submit says what is missing above the button; tapping it shows the errors and focuses the first bad field', async () => {
    const { user } = await openResult()
    expect(submitBtn()).toBeEnabled()
    expect(screen.getByText(/Fill in DO number, Notes to submit/)).toBeInTheDocument()
    await user.click(submitBtn())
    expect(screen.getByLabelText(/DO number/)).toHaveFocus()
    expect(screen.getByText(/DO number is required/)).toBeInTheDocument()
    expect(screen.getByText(/Notes are required/)).toBeInTheDocument()
    await user.type(screen.getByLabelText(/DO number/), 'DX1')
    expect(screen.getByText(/Fill in Notes to submit/)).toBeInTheDocument()
    await user.type(screen.getByLabelText(/Notes/), 'ok')
    expect(screen.queryByText(/to submit/)).not.toBeInTheDocument()
    expect(screen.getByTestId('notes-count')).toHaveTextContent('2/2000')
    await user.clear(actualInput())
    await user.type(actualInput(), '-1')
    expect(actualInput()).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText(/Whole number, 0 or more/)).toBeInTheDocument()
    await user.click(submitBtn())
    expect(actualInput()).toHaveFocus()
  })

  it('DO / notes errors show after leaving the field empty (whitespace does not count)', async () => {
    const { user } = await openResult()
    await user.type(screen.getByLabelText(/DO number/), '   ')
    await user.tab()
    expect(screen.getByLabelText(/DO number/)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText(/DO number is required/)).toBeInTheDocument()
    expect(screen.queryByText(/Notes are required/)).not.toBeInTheDocument()
  })

  it('Actual follows the corrected total until the operator edits it, then stays', async () => {
    const { user } = await openResult()
    expect(actualInput()).toHaveValue('3')
    tap(20, 20) // remove 1
    expect(actualInput()).toHaveValue('2')
    expect(screen.getByTestId('actual-help')).toHaveTextContent('Defaults to the corrected total (2)')
    await user.clear(actualInput())
    await user.type(actualInput(), '5')
    tap(80, 80) // add 1: corrected 3, actual stays 5
    expect(screen.getByTestId('corrected-total')).toHaveTextContent('3')
    expect(actualInput()).toHaveValue('5')
    expect(screen.getByTestId('actual-help')).toHaveTextContent('Differs from the corrected total (3)')
  })

  it('variance badge = actual - model total; stepper buttons change actual', async () => {
    const { user } = await openResult()
    expect(screen.getByTestId('variance')).toHaveTextContent('matches model')
    await user.click(screen.getByRole('button', { name: /Plus 1/ }))
    await user.click(screen.getByRole('button', { name: /Plus 1/ }))
    expect(actualInput()).toHaveValue('5')
    expect(screen.getByTestId('variance')).toHaveTextContent(/\+2.*vs model/)
    expect(screen.getByText(/this batch will be flagged/)).toBeInTheDocument()
    tap(20, 20) // corrected changes; the edited actual and the model total do not
    expect(screen.getByTestId('variance')).toHaveTextContent(/\+2.*vs model/)
    for (let i = 0; i < 6; i++) await user.click(screen.getByRole('button', { name: /Minus 1/ }))
    expect(actualInput()).toHaveValue('0')
    expect(screen.getByTestId('variance')).toHaveTextContent(/-3.*vs model/)
  })

  it('a DO that is already saved: first Submit only warns, a second Submit with the same DO saves', async () => {
    vi.mocked(confirmBatch).mockResolvedValue(saved)
    vi.mocked(findSavedDo).mockResolvedValue({ ...saved, operatorId: 'OP-9', confirmedAt: '2026-11-17T05:26:00Z' })
    const { user } = await openResult()
    await user.type(screen.getByLabelText(/DO number/), 'DX1')
    await user.type(screen.getByLabelText(/Notes/), 'n')
    await user.click(submitBtn())
    expect(findSavedDo).toHaveBeenCalledWith('DX1')
    expect(confirmBatch).not.toHaveBeenCalled()
    expect(await screen.findByTestId('do-taken')).toHaveTextContent(/already saved \(17 Nov, \d\d:\d\d, OP-9\)/)
    expect(screen.getByLabelText(/DO number/)).toHaveFocus()

    await user.click(submitBtn())
    expect(confirmBatch).toHaveBeenCalledTimes(1)
  })

  it('duplicate-DO lookup failing does not block saving', async () => {
    vi.mocked(confirmBatch).mockResolvedValue(saved)
    vi.mocked(findSavedDo).mockRejectedValue(new Error('offline'))
    const { user } = await openResult()
    await user.type(screen.getByLabelText(/DO number/), 'DX1')
    await user.type(screen.getByLabelText(/Notes/), 'n')
    await user.click(submitBtn())
    expect(confirmBatch).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('do-taken')).toBeNull()
  })

  it('submit sends batch id, kept image ids and the corrections, then Processing shows the toast', async () => {
    vi.mocked(confirmBatch).mockResolvedValue(saved)
    const { user } = await openResult()
    tap(20, 20) // A: remove pipe 0
    tap(80, 80) // A: add [70, 70, 20, 20]
    await user.click(thumbs()[1])
    await user.click(screen.getByRole('button', { name: /Full photo/ }))
    tap(20, 20, /^b\.jpg/) // B: remove pipe 0, nothing added
    await user.type(screen.getByLabelText(/DO number/), ' DX1 ')
    await user.type(screen.getByLabelText(/Notes/), 'two hidden')
    expect(actualInput()).toHaveValue('2')
    await user.click(submitBtn())
    expect(confirmBatch).toHaveBeenCalledTimes(1)
    expect(confirmBatch).toHaveBeenCalledWith(BATCH, {
      doNumber: 'DX1',
      actualAmount: 2,
      notes: 'two hidden',
      imageIds: ['img_a', 'img_b', 'img_f'],
      corrections: [
        { image_id: 'img_a', removed: [0], added: [[70, 70, 20, 20]] },
        { image_id: 'img_b', removed: [0], added: [] },
      ],
    })
    expect(await screen.findByTestId('saved-toast')).toHaveTextContent('Saved DO DX1')
    expect(screen.getByRole('heading', { name: /ถ่าย \/ อัปโหลดรูป/ })).toBeInTheDocument()
    expect(api.session.batchId).toBeNull()
    expect(api.session.photos).toEqual([])
    expect(api.session.edits).toEqual({})
    expect(api.session.lastSavedDo).toBe('DX1')
  })

  it('removed photos are left out of image_ids', async () => {
    vi.mocked(confirmBatch).mockResolvedValue(saved)
    const { user } = await openResult()
    await user.click(screen.getByRole('button', { name: /Remove photo/ })) // drops A
    await user.type(screen.getByLabelText(/DO number/), 'DX1')
    await user.type(screen.getByLabelText(/Notes/), 'n')
    await user.click(submitBtn())
    expect(vi.mocked(confirmBatch).mock.calls[0][1]).toMatchObject({ imageIds: ['img_b', 'img_f'], corrections: [], actualAmount: 1 })
  })

  it('while submitting everything is locked; an API error keeps form + edits and offers Try again', async () => {
    let reject!: (e: Error) => void
    vi.mocked(confirmBatch).mockReturnValue(new Promise((_, r) => (reject = r)))
    const { user } = await openResult()
    tap(20, 20)
    await user.type(screen.getByLabelText(/DO number/), 'DX1')
    await user.type(screen.getByLabelText(/Notes/), 'keep me')
    await user.click(submitBtn())
    expect(submitBtn()).toBeDisabled()
    expect(submitBtn()).toHaveTextContent('Submitting')
    expect(screen.getByLabelText(/Notes/)).toBeDisabled()
    expect(undoBtn()).toBeDisabled()
    expect(screen.getByRole('button', { name: /Cancel this detection/ })).toBeDisabled()
    tap(80, 80) // viewer locked: no edit
    expect(count()).toHaveTextContent('1')
    await user.click(submitBtn())
    expect(confirmBatch).toHaveBeenCalledTimes(1)
    reject(new Error('database not configured: set SUPABASE_URL'))
    expect(await screen.findByTestId('submit-error')).toHaveTextContent('database not configured')
    expect(screen.getByTestId('submit-error')).toHaveTextContent('Your corrections are kept')
    expect(screen.getByLabelText(/DO number/)).toHaveValue('DX1')
    expect(screen.getByLabelText(/Notes/)).toHaveValue('keep me')
    expect(api.session.edits.a.removed).toEqual([0])
    expect(submitBtn()).toBeEnabled()
    expect(submitBtn()).toHaveTextContent('Try again')
    expect(undoBtn()).toBeEnabled()
  })

  it('Back to processing keeps the session', async () => {
    const { user } = await openResult()
    tap(20, 20)
    await user.click(screen.getByRole('link', { name: /Back to processing/ }))
    expect(screen.getByRole('heading', { name: /ถ่าย \/ อัปโหลดรูป/ })).toBeInTheDocument()
    expect(api.session.batchId).not.toBeNull()
    expect(api.session.edits.a.removed).toEqual([0])
  })

  it('cancel opens a dialog with No focused; No and Esc keep the session, Yes clears it', async () => {
    const { user } = await openResult()
    tap(20, 20)
    const cancel = () => screen.getByRole('button', { name: /Cancel this detection/ })
    await user.click(cancel())
    expect(screen.getByRole('alertdialog')).toHaveAccessibleName(/Cancel this detection and start over\?/)
    expect(screen.getByRole('button', { name: /No, keep going/ })).toHaveFocus()
    await user.click(screen.getByTestId('dialog-backdrop')) // backdrop click keeps focus inside, so Esc still works
    expect(screen.getByRole('button', { name: /No, keep going/ })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(cancel()).toHaveFocus()
    expect(api.session.edits.a.removed).toEqual([0])
    await user.click(cancel())
    await user.click(screen.getByRole('button', { name: /No, keep going/ }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(api.session.batchId).toBe(BATCH)
    await user.click(cancel())
    await user.click(screen.getByRole('button', { name: /Yes, cancel/ }))
    expect(screen.getByRole('heading', { name: /ถ่าย \/ อัปโหลดรูป/ })).toBeInTheDocument()
    expect(api.session.batchId).toBeNull()
  })

  it('the per-photo message (download / remove) clears when switching photos', async () => {
    const { user } = await openResult()
    await user.click(screen.getByRole('button', { name: /Save original/ }))
    expect(screen.getByText(/Downloaded a\.jpg/)).toBeInTheDocument()
    await user.click(thumbs()[1])
    expect(screen.queryByText(/Downloaded a\.jpg/)).not.toBeInTheDocument()
  })
})
