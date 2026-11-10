import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ConfirmDialog from './ConfirmDialog'
import Toast from './Toast'

const p = (s: string) => ({ th: `ไทย ${s}`, en: s })

describe('ConfirmDialog', () => {
  it('mousedown on text inside the box keeps focus; on a button it is left alone', () => {
    render(<ConfirmDialog title={p('Title')} body={p('Body')} yes={p('Yes')} no={p('No')} onYes={vi.fn()} onNo={vi.fn()} />)
    // fireEvent returns false when the handler called preventDefault (so the browser would not move focus).
    expect(fireEvent.mouseDown(screen.getByText('Body'))).toBe(false)
    expect(fireEvent.mouseDown(screen.getByRole('alertdialog'))).toBe(false)
    expect(fireEvent.mouseDown(screen.getByRole('button', { name: /Yes/ }))).toBe(true)
    expect(screen.getByRole('button', { name: /No/ })).toHaveFocus()
  })
})

describe('Toast', () => {
  it('sets only the first occurrence of the DO string in mono', async () => {
    render(<Toast message={{ th: 'DX1 DX1', en: 'Saved DX1 and DX1', mono: 'DX1' }} onClose={vi.fn()} />)
    const toast = await screen.findByTestId('saved-toast')
    expect(toast.querySelectorAll('.font-mono')).toHaveLength(2) // one per language line
    expect(toast).toHaveTextContent('DX1 DX1Saved DX1 and DX1')
  })
})
