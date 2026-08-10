import { describe, it, expect } from 'vitest'
import { parseCsv } from '../utils/csvImport'
import { toCsv, deriveColumns } from '../utils/csv'

describe('parseCsv basics', () => {
  it('keys each record by the header row', () => {
    expect(parseCsv('a,b\r\n1,2')).toEqual({
      rows: [{ a: 1, b: 2 }],
      columns: ['a', 'b'],
    })
  })

  it('accepts LF, CRLF and lone CR line endings', () => {
    const expected = [{ a: 1 }, { a: 2 }]
    expect(parseCsv('a\n1\n2').rows).toEqual(expected)
    expect(parseCsv('a\r\n1\r\n2').rows).toEqual(expected)
    expect(parseCsv('a\r1\r2').rows).toEqual(expected)
  })

  it('tolerates a trailing newline and blank lines in the middle', () => {
    expect(parseCsv('a\n1\n\n2\n').rows).toEqual([{ a: 1 }, { a: 2 }])
  })

  it('returns the columns of a header-only file without inventing a row', () => {
    expect(parseCsv('a,b\n')).toEqual({ rows: [], columns: ['a', 'b'] })
  })

  it('rejects empty input', () => {
    expect(parseCsv('')).toEqual({ rows: [], columns: [], error: 'Input is empty' })
    expect(parseCsv('  \n ').error).toBe('Input is empty')
  })

  it('strips a byte order mark so it does not become part of a key', () => {
    expect(parseCsv('﻿a,b\n1,2').columns).toEqual(['a', 'b'])
  })

  it('trims header cells but not data cells', () => {
    const result = parseCsv(' a , b \n x , y ')
    expect(result.columns).toEqual(['a', 'b'])
    expect(result.rows).toEqual([{ a: ' x ', b: ' y ' }])
  })
})

describe('parseCsv RFC 4180 quoting', () => {
  it('keeps a delimiter that sits inside a quoted field', () => {
    expect(parseCsv('a,b\n"x,y",2').rows).toEqual([{ a: 'x,y', b: 2 }])
  })

  it('reads a doubled quote as one literal quote', () => {
    expect(parseCsv('a\n"say ""hi"""').rows).toEqual([{ a: 'say "hi"' }])
  })

  it('reads a field that is only a doubled quote', () => {
    expect(parseCsv('a\n""""').rows).toEqual([{ a: '"' }])
  })

  it('keeps a newline that sits inside a quoted field', () => {
    expect(parseCsv('a,b\n"line1\nline2",2').rows).toEqual([{ a: 'line1\nline2', b: 2 }])
  })

  it('keeps a CRLF inside a quoted field exactly as written', () => {
    expect(parseCsv('a\r\n"line1\r\nline2"').rows).toEqual([{ a: 'line1\r\nline2' }])
  })

  it('reads an empty quoted field as an empty string', () => {
    expect(parseCsv('a,b\n"",2').rows).toEqual([{ a: '', b: 2 }])
  })

  it('allows a quoted header cell to carry the delimiter', () => {
    expect(parseCsv('"first,second",b\n1,2').columns).toEqual(['first,second', 'b'])
  })

  it('treats a quote in the middle of a field as ordinary text', () => {
    expect(parseCsv('a\nx"y').rows).toEqual([{ a: 'x"y' }])
  })

  it('reports a quoted field that is never closed', () => {
    const result = parseCsv('a,b\n"unfinished,2')
    expect(result.rows).toEqual([])
    expect(result.error).toMatch(/Unterminated quoted field/)
  })
})

describe('parseCsv delimiters', () => {
  it('detects semicolons', () => {
    expect(parseCsv('a;b\n1;2').rows).toEqual([{ a: 1, b: 2 }])
  })

  it('detects tabs', () => {
    expect(parseCsv('a\tb\n1\t2').rows).toEqual([{ a: 1, b: 2 }])
  })

  it('is not fooled by a delimiter hiding inside a quoted header cell', () => {
    expect(parseCsv('"a;b";c\n1;2').columns).toEqual(['a;b', 'c'])
  })

  it('falls back to a comma when the header holds no candidate', () => {
    expect(parseCsv('a\n1').columns).toEqual(['a'])
  })

  it('honours an explicit delimiter over detection', () => {
    expect(parseCsv('a;b\n1;2', { delimiter: ',' }).columns).toEqual(['a;b'])
    expect(parseCsv('a|b\n1|2', { delimiter: '|' }).rows).toEqual([{ a: 1, b: 2 }])
  })
})

describe('parseCsv type inference', () => {
  it('converts integers, decimals and exponents', () => {
    expect(parseCsv('a,b,c\n42,-1.5,2e3').rows).toEqual([{ a: 42, b: -1.5, c: 2000 }])
  })

  it('converts booleans and null, whatever the case', () => {
    expect(parseCsv('a,b,c\ntrue,FALSE,Null').rows).toEqual([{ a: true, b: false, c: null }])
  })

  it('leaves an empty cell as an empty string', () => {
    expect(parseCsv('a,b\n,2').rows).toEqual([{ a: '', b: 2 }])
  })

  it('keeps a leading zero, which is an identifier and not a number', () => {
    expect(parseCsv('a\n007').rows).toEqual([{ a: '007' }])
  })

  it('keeps an integer too long to survive a double', () => {
    expect(parseCsv('a\n12345678901234567890').rows).toEqual([{ a: '12345678901234567890' }])
  })

  it('keeps text that merely starts like a number', () => {
    expect(parseCsv('a,b,c\n1.2.3,+5,1px').rows).toEqual([{ a: '1.2.3', b: '+5', c: '1px' }])
  })

  it('keeps everything as text when inference is turned off', () => {
    expect(parseCsv('a,b,c\n42,true,null', { inferTypes: false }).rows).toEqual([
      { a: '42', b: 'true', c: 'null' },
    ])
  })
})

describe('parseCsv header handling', () => {
  it('gives a blank header cell a positional name', () => {
    expect(parseCsv(',b\n1,2')).toEqual({
      rows: [{ column1: 1, b: 2 }],
      columns: ['column1', 'b'],
    })
  })

  it('suffixes a repeated header so no column is overwritten', () => {
    expect(parseCsv('a,a,a\n1,2,3')).toEqual({
      rows: [{ a: 1, a_2: 2, a_3: 3 }],
      columns: ['a', 'a_2', 'a_3'],
    })
  })

  it('fills a short record with empty strings', () => {
    expect(parseCsv('a,b,c\n1').rows).toEqual([{ a: 1, b: '', c: '' }])
  })

  it('widens the header when a record carries more cells than the header names', () => {
    expect(parseCsv('a\n1,2')).toEqual({
      rows: [{ a: 1, column2: 2 }],
      columns: ['a', 'column2'],
    })
  })
})

// The exporter in `csv.ts` and this importer have to agree, or a download and
// re-upload silently rewrites the user's data.
describe('parseCsv against the csv.ts exporter', () => {
  it('round trips values that need every quoting rule', () => {
    const rows = [
      { name: 'Smith, John', quote: 'say "hi"', note: 'line1\nline2', n: 42, flag: true },
      { name: 'Ada', quote: '', note: 'plain', n: -1.5, flag: false },
    ]
    const csv = toCsv(rows, deriveColumns(rows))
    expect(parseCsv(csv).rows).toEqual(rows)
  })

  it('round trips the column order the exporter chose', () => {
    const rows = [{ b: 1 }, { a: 2 }]
    const columns = deriveColumns(rows)
    expect(parseCsv(toCsv(rows, columns)).columns).toEqual(columns)
  })
})
