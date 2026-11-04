import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
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
    const cam = screen.getByLabelText(/ถ่ายรูป/)
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
})
