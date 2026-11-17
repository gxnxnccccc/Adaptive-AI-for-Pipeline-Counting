import { describe, expect, it } from 'vitest'
import type { RecordRow } from '@/lib/api'
import { CSV_HEADER, csvCell, csvFilename, recordsToCsv } from '@/lib/csv'

const row: RecordRow = {
  batchId: 'b1',
  createdAt: '2026-11-16T04:22:00Z',
  operatorId: 'OP-0142',
  doNumber: 'DO-1',
  imageCount: 2,
  modelTotal: 56,
  actualAmount: 54,
  variance: -2,
  status: 'confirmed',
  flagged: false,
  notes: 'ซ่อนอยู่ 2 ท่อ, "หลังกอง"',
  confirmedAt: '2026-11-16T04:30:00Z',
}

describe('csvCell', () => {
  it('leaves plain values alone and empties null', () => {
    expect(csvCell('abc')).toBe('abc')
    expect(csvCell(-2)).toBe('-2')
    expect(csvCell(false)).toBe('false')
    expect(csvCell(null)).toBe('')
  })
  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('two\nlines')).toBe('"two\nlines"')
  })
  it('defuses text Excel would run as a formula', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(csvCell('+1')).toBe("'+1")
    expect(csvCell('-x')).toBe("'-x")
    expect(csvCell('@cmd')).toBe("'@cmd")
  })
})

describe('recordsToCsv', () => {
  it('starts with a BOM + header and writes one CRLF line per record', () => {
    const csv = recordsToCsv([row, { ...row, batchId: 'b2', doNumber: null, actualAmount: null, variance: null, status: 'draft', notes: null, confirmedAt: null }])
    expect(csv.startsWith('﻿' + CSV_HEADER.join(',') + '\r\n')).toBe(true)
    const lines = csv.slice(1).trimEnd().split('\r\n')
    expect(lines).toHaveLength(3)
    expect(lines[1]).toBe('b1,2026-11-16T04:22:00Z,OP-0142,DO-1,confirmed,2,56,54,-2,false,2026-11-16T04:30:00Z,"ซ่อนอยู่ 2 ท่อ, ""หลังกอง"""')
    expect(lines[2]).toBe('b2,2026-11-16T04:22:00Z,OP-0142,,draft,2,56,,,false,,')
  })
})

it('csvFilename uses the local date', () => {
  expect(csvFilename(new Date(2026, 10, 6))).toBe('spds-batches-2026-11-06.csv')
})
