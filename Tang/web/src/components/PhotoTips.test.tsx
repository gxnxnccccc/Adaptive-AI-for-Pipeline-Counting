import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import PhotoTips from './PhotoTips'

afterEach(() => vi.unstubAllGlobals())

const wide = (matches: boolean) => vi.stubGlobal('matchMedia', () => ({ matches, addEventListener() {}, removeEventListener() {} }))

it('phone: starts closed; tap opens 1 good + 3 bad examples and the 3 rules, tap again closes', async () => {
  wide(false)
  const user = userEvent.setup()
  render(<PhotoTips />)
  const toggle = screen.getByRole('button', { name: /How to take a good photo/ })
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByTestId('tip-good')).toBeNull()

  await user.click(toggle)
  expect(toggle).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByTestId('tip-good')).toHaveTextContent(/ควรทำ · Do: /)
  for (const bad of ['angle', 'dark', 'blocked']) expect(screen.getByTestId(`tip-${bad}`)).toHaveTextContent(/ไม่ควร · Don't: /)
  expect(screen.getByText(/every pipe end is in the frame/)).toBeInTheDocument()

  await user.click(toggle)
  expect(screen.queryByTestId('tip-good')).toBeNull()
})

it('wide screen: starts open', () => {
  wide(true)
  render(<PhotoTips />)
  expect(screen.getByRole('button', { name: /How to take a good photo/ })).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByTestId('tip-good')).toBeInTheDocument()
})
