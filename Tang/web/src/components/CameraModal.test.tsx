import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CameraModal from './CameraModal'

// jsdom has no getUserMedia, no video frames and no canvas: all faked here.
function fakeStream() {
  const track = { stop: vi.fn() }
  return { stream: { getTracks: () => [track] } as unknown as MediaStream, track }
}
function mockMedia(getUserMedia: () => Promise<MediaStream>) {
  const fn = vi.fn(getUserMedia)
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: fn } })
  return fn
}
const domErr = (name: string) => new DOMException('camera', name)

function setup(props: Partial<Parameters<typeof CameraModal>[0]> = {}) {
  const onShots = vi.fn()
  const onClose = vi.fn()
  const onPickInstead = vi.fn()
  const user = userEvent.setup()
  const view = render(<CameraModal onShots={onShots} onClose={onClose} onPickInstead={onPickInstead} {...props} />)
  return { user, onShots, onClose, onPickInstead, ...view }
}
const shutter = () => screen.findByRole('button', { name: /Capture/ })

beforeEach(() => {
  let n = 0
  URL.createObjectURL = vi.fn(() => `blob:cam-${n++}`)
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, get: () => 1280 })
  Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, get: () => 960 })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as never)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (cb, type) {
    cb(new Blob(['jpg'], { type }))
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  Reflect.deleteProperty(navigator, 'mediaDevices')
  Reflect.deleteProperty(HTMLVideoElement.prototype, 'videoWidth')
  Reflect.deleteProperty(HTMLVideoElement.prototype, 'videoHeight')
})

describe('CameraModal', () => {
  it('is a labelled modal dialog: asking, then live with the rear camera', async () => {
    let resolve!: (s: MediaStream) => void
    const gum = mockMedia(() => new Promise((r) => (resolve = r)))
    setup()
    const dialog = screen.getByRole('dialog', { name: /Camera/ })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('Asking for camera permission')
    expect(gum).toHaveBeenCalledWith({ video: { facingMode: 'environment' }, audio: false })

    await act(async () => resolve(fakeStream().stream))
    expect(await shutter()).toHaveFocus()
    expect(dialog).toHaveAttribute('data-cam', 'live')
    expect(screen.getByText('Live')).toBeInTheDocument()
  })

  it('NotAllowedError -> denied with Try again and Choose photos instead', async () => {
    const gum = mockMedia(() => Promise.reject(domErr('NotAllowedError')))
    const { user } = setup()
    expect(await screen.findByRole('alert')).toHaveTextContent('Camera permission denied')

    gum.mockResolvedValueOnce(fakeStream().stream)
    await user.click(screen.getByRole('button', { name: /Try again/ }))
    expect(await shutter()).toBeInTheDocument()
    expect(gum).toHaveBeenCalledTimes(2)

  })

  it('denied -> Choose photos instead calls onPickInstead', async () => {
    mockMedia(() => Promise.reject(domErr('NotAllowedError')))
    const { user, onPickInstead } = setup()
    await user.click(await screen.findByRole('button', { name: /Choose photos instead/ }))
    expect(onPickInstead).toHaveBeenCalledOnce()
  })

  it('NotFoundError -> no camera found, only Choose photos instead', async () => {
    mockMedia(() => Promise.reject(domErr('NotFoundError')))
    setup()
    expect(await screen.findByRole('alert')).toHaveTextContent('No camera found')
    expect(screen.queryByRole('button', { name: /Try again/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Choose photos instead/ })).toBeInTheDocument()
  })

  it('no navigator.mediaDevices (plain http) -> no camera state, no getUserMedia call', () => {
    setup()
    expect(screen.getByRole('alert')).toHaveTextContent('No camera found')
    expect(screen.getByRole('button', { name: /Close camera/ })).toHaveFocus()
  })

  it('takes 2 shots and Done hands over 2 JPEG files', async () => {
    mockMedia(() => Promise.resolve(fakeStream().stream))
    const { user, onShots } = setup()
    await user.click(await shutter())
    await user.click(await shutter())
    expect(screen.getByTestId('cam-taken')).toHaveTextContent('2 taken')
    await user.click(screen.getByRole('button', { name: /Done/ }))
    expect(onShots).toHaveBeenCalledOnce()
    const files = onShots.mock.calls[0][0] as File[]
    expect(files).toHaveLength(2)
    for (const f of files) {
      expect(f).toBeInstanceOf(File)
      expect(f.type).toBe('image/jpeg')
      expect(f.name).toMatch(/^camera-\d+\.jpg$/)
    }
  })

  it('Done with no shots just closes', async () => {
    mockMedia(() => Promise.resolve(fakeStream().stream))
    const { user, onShots, onClose } = setup()
    await shutter()
    await user.click(screen.getByRole('button', { name: /Done/ }))
    expect(onShots).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('X and Esc call onClose; unmount stops every track', async () => {
    const { stream, track } = fakeStream()
    mockMedia(() => Promise.resolve(stream))
    const { user, onClose, unmount } = setup()
    await shutter()
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: /Close camera/ }))
    expect(onClose).toHaveBeenCalledTimes(2)
    expect(track.stop).not.toHaveBeenCalled()
    unmount()
    expect(track.stop).toHaveBeenCalledOnce()
  })

  it('stops the stream that arrives after the modal already closed', async () => {
    const { stream, track } = fakeStream()
    let resolve!: (s: MediaStream) => void
    mockMedia(() => new Promise((r) => (resolve = r)))
    const { unmount } = setup()
    unmount()
    await act(async () => resolve(stream))
    expect(track.stop).toHaveBeenCalledOnce()
  })

  it('traps Tab inside the dialog', async () => {
    mockMedia(() => Promise.resolve(fakeStream().stream))
    const { user } = setup()
    // The shutter takes focus in a passive effect that can land after findBy resolves. Wait for it,
    // otherwise it steals focus back from done.focus() below (the old flake).
    await waitFor(async () => expect(await shutter()).toHaveFocus())
    const close = screen.getByRole('button', { name: /Close camera/ })
    const done = screen.getByRole('button', { name: /Done/ })
    done.focus()
    await user.tab()
    expect(close).toHaveFocus()
    await user.tab({ shift: true })
    expect(done).toHaveFocus()
  })

  it('returns focus to the opener on unmount', async () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    mockMedia(() => Promise.resolve(fakeStream().stream))
    const { unmount } = setup()
    await waitFor(async () => expect(await shutter()).toHaveFocus())
    unmount()
    expect(opener).toHaveFocus()
    opener.remove()
  })
})
