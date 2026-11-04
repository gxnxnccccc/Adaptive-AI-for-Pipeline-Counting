import { describe, expect, it } from 'vitest'
import type { RecordRow } from './api'
import { escapeCsv, recordsToCsv, toCsv, withBom } from './csv'

const row: RecordRow = {
  batchId: 'b',
  createdAt: '2026-11-04T03:12:00Z',
  operatorId: 'OP-7',
  doNumber: 'DX1',
  imageCount: 2,
  modelTotal: 42,
  actualAmount: 41,
  variance: -1,
  status: 'confirmed',
  flagged: true,
  notes: null,
  confirmedAt: null,
}

describe('csv', () => {
  it('escapes commas, quotes and newlines', () => {
    expect(escapeCsv('a,b')).toBe('"a,b"')
    expect(escapeCsv('say "hi"')).toBe('"say ""hi"""')
    expect(escapeCsv('line1\nline2')).toBe('"line1\nline2"')
    expect(escapeCsv('plain')).toBe('plain')
    expect(escapeCsv(null)).toBe('')
    expect(escapeCsv(0)).toBe('0')
  })
  it('joins rows with CRLF', () => expect(toCsv([['a', 'b,c'], [1, null]])).toBe('a,"b,c"\r\n1,'))
  it('builds records rows; flagged shows as status, formulas are neutralised', () => {
    const draft = { ...row, doNumber: '=SUM(A1)', status: 'draft' as const, flagged: false, variance: null, actualAmount: null }
    const lines = recordsToCsv([row, draft]).split('\r\n')
    expect(lines[0]).toBe('Time,DO Number,Operator,Photos,Detected,Actual,Variance,Status')
    expect(lines[1]).toBe('2026-11-04T03:12:00Z,DX1,OP-7,2,42,41,-1,flagged')
    expect(lines[2]).toContain("'=SUM(A1)")
    expect(lines[2].endsWith(',,draft')).toBe(true)
  })
  it('adds a UTF-8 BOM', () => expect(withBom('x')).toBe(String.fromCharCode(0xfeff) + 'x'))
})
