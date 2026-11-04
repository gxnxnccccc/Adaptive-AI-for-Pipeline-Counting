import { describe, expect, it } from 'vitest'
import { formatVariance, parseActual, validateConfirm, variance } from './confirm'

const ok = { doNumber: 'DX1', actual: '10', notes: 'n' }

describe('confirm rules', () => {
  it('valid form has no errors', () => expect(validateConfirm(ok)).toEqual({}))
  it('DO and notes are required (whitespace does not count)', () => {
    expect(validateConfirm({ ...ok, doNumber: '  ' }).doNumber).toBe(true)
    expect(validateConfirm({ ...ok, notes: '' }).notes).toBe(true)
    expect(validateConfirm({ ...ok, doNumber: 'x'.repeat(65) }).doNumber).toBe(true)
  })
  it('actual must be a whole number >= 0', () => {
    for (const bad of ['', '-1', '1.5', 'abc', '1e3']) expect(parseActual(bad)).toBeNull()
    expect(parseActual(' 0 ')).toBe(0)
    expect(parseActual('42')).toBe(42)
    expect(validateConfirm({ ...ok, actual: '-3' }).actual).toBe(true)
  })
  it('variance = actual - model, shown with a sign', () => {
    expect(variance(41, 42)).toBe(-1)
    expect(formatVariance(variance(45, 42))).toBe('+3')
    expect(formatVariance(-1)).toBe('-1')
    expect(formatVariance(0)).toBe('0')
  })
})
