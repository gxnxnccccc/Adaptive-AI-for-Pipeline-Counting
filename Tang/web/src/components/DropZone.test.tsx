import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DropZone from './DropZone'

describe('DropZone', () => {
  it('shows a drag-over state and passes dropped files', () => {
    const onFiles = vi.fn()
    render(<DropZone onFiles={onFiles} />)
    const zone = screen.getByTestId('dropzone')
    fireEvent.dragOver(zone, { dataTransfer: { files: [] } })
    expect(zone).toHaveAttribute('data-dragging', 'true')
    const f = new File(['x'], 'a.png', { type: 'image/png' })
    fireEvent.drop(zone, { dataTransfer: { files: [f] } })
    expect(zone).toHaveAttribute('data-dragging', 'false')
    expect(onFiles).toHaveBeenCalledWith([f])
  })

  it('keeps both file inputs focusable (sr-only, not hidden) with the right attributes', () => {
    render(<DropZone onFiles={() => {}} />)
    const pick = screen.getByLabelText(/เลือกรูป/)
    const cam = screen.getByLabelText(/เปิดกล้อง/)
    for (const input of [pick, cam]) {
      expect(input).toHaveAttribute('type', 'file')
      expect(input).toHaveAttribute('accept', 'image/*')
      expect(input).toHaveAttribute('multiple')
      expect(input).toHaveClass('sr-only')
      input.focus()
      expect(input).toHaveFocus()
    }
    expect(cam).toHaveAttribute('capture', 'environment')
  })

  it('ignores drops while disabled', () => {
    const onFiles = vi.fn()
    render(<DropZone onFiles={onFiles} disabled />)
    fireEvent.drop(screen.getByTestId('dropzone'), {
      dataTransfer: { files: [new File(['x'], 'a.png', { type: 'image/png' })] },
    })
    expect(onFiles).not.toHaveBeenCalled()
  })

  describe('with a live camera (getUserMedia available)', () => {
    afterEach(() => {
      vi.restoreAllMocks()
      Reflect.deleteProperty(navigator, 'mediaDevices')
    })
    const withCamera = (gum: () => Promise<MediaStream>) =>
      Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn(gum) } })

    it('Open camera opens the modal; Esc closes it and focus returns to the button', async () => {
      withCamera(() => new Promise(() => {}))
      const user = userEvent.setup()
      render(<DropZone onFiles={() => {}} />)
      const open = screen.getByRole('button', { name: /Open camera/ })
      expect(screen.queryByLabelText(/เปิดกล้อง/, { selector: 'input' })).not.toBeInTheDocument()
      await user.click(open)
      expect(screen.getByRole('dialog', { name: /Camera/ })).toBeInTheDocument()
      await user.keyboard('{Escape}')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(open).toHaveFocus()
    })

    it('no camera -> Choose photos instead closes the modal and opens the photo picker', async () => {
      withCamera(() => Promise.reject(new DOMException('x', 'NotFoundError')))
      const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})
      const user = userEvent.setup()
      render(<DropZone onFiles={() => {}} />)
      await user.click(screen.getByRole('button', { name: /Open camera/ }))
      await user.click(await screen.findByRole('button', { name: /Choose photos instead/ }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(click).toHaveBeenCalledOnce()
      expect(click.mock.contexts[0]).not.toHaveAttribute('capture')
    })
  })
})
