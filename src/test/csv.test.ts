import { describe, it, expect } from 'vitest'
import { toCsv, deriveColumns } from '../utils/csv'

// `downloadCsv` is not covered here: it is a thin wrapper over Blob,
// URL.createObjectURL and a synthetic anchor click, so a test could only assert
// that the browser APIs it was handed were called — it would restate the
// implementation without checking anything the exporter actually decides.

describe('deriveColumns', () => {
  it('unions the keys of every row', () => {
    expect(deriveColumns([{ a: 1, b: 2 }, { b: 3, c: 4 }])).toEqual(['a', 'b', 'c'])
  })

  it('orders by first appearance, so a later row cannot reshuffle the columns', () => {
    expect(deriveColumns([{ b: 1, a: 2 }, { a: 3, b: 4 }])).toEqual(['b', 'a'])
  })

  it('does not repeat a key shared by several rows', () => {
    expect(deriveColumns([{ a: 1 }, { a: 2 }, { a: 3 }])).toEqual(['a'])
  })

  it('returns no columns for no rows, or for rows without keys', () => {
    expect(deriveColumns([])).toEqual([])
    expect(deriveColumns([{}, {}])).toEqual([])
  })
})

describe('toCsv', () => {
  it('writes a header and one CRLF-separated record per row', () => {
    const csv = toCsv([{ a: 1, b: 2 }, { a: 3, b: 4 }], ['a', 'b'])
    expect(csv).toBe('a,b\r\n1,2\r\n3,4')
  })

  it('emits only the header for an empty row array', () => {
    expect(toCsv([], ['a', 'b'])).toBe('a,b')
    expect(toCsv([], [])).toBe('')
  })

  it('follows the given columns, ignoring keys outside them', () => {
    expect(toCsv([{ a: 1, extra: 9 }], ['a'])).toBe('a\r\n1')
  })

  it('renders numbers and booleans as their literal text', () => {
    expect(toCsv([{ n: 0, b: false }], ['n', 'b'])).toBe('n,b\r\n0,false')
  })
})

describe('toCsv quoting', () => {
  it('quotes a field containing a comma', () => {
    expect(toCsv([{ a: 'x,y' }], ['a'])).toBe('a\r\n"x,y"')
  })

  it('quotes a field containing a double quote and doubles the quote', () => {
    expect(toCsv([{ a: 'say "hi"' }], ['a'])).toBe('a\r\n"say ""hi"""')
  })

  it('quotes a field containing LF or CR so the record stays on one line', () => {
    expect(toCsv([{ a: 'line1\nline2' }], ['a'])).toBe('a\r\n"line1\nline2"')
    expect(toCsv([{ a: 'x\ry' }], ['a'])).toBe('a\r\n"x\ry"')
  })

  it('leaves an ordinary field unquoted', () => {
    expect(toCsv([{ a: 'plain text' }], ['a'])).toBe('a\r\nplain text')
  })

  it('quotes header cells by the same rules', () => {
    expect(toCsv([], ['first,second'])).toBe('"first,second"')
  })
})

describe('toCsv cell values', () => {
  it('writes an empty field for null and for an absent key', () => {
    expect(toCsv([{ a: null }], ['a'])).toBe('a\r\n')
    expect(toCsv([{}], ['a'])).toBe('a\r\n')
    expect(toCsv([{ a: 1 }, { b: 2 }], ['a', 'b'])).toBe('a,b\r\n1,\r\n,2')
  })

  it('keeps an empty string empty', () => {
    expect(toCsv([{ a: '' }], ['a'])).toBe('a\r\n')
  })

  it('serialises a nested object compactly', () => {
    expect(toCsv([{ a: { x: 1 } }], ['a'])).toBe('a\r\n"{""x"":1}"')
  })

  it('serialises a nested array compactly', () => {
    expect(toCsv([{ a: [1, 2] }], ['a'])).toBe('a\r\n"[1,2]"')
  })
})

describe('toCsv formula-injection guard', () => {
  it('prefixes fields starting with a formula character', () => {
    expect(toCsv([{ a: '=SUM(A1)' }], ['a'])).toBe("a\r\n'=SUM(A1)")
    expect(toCsv([{ a: '@import' }], ['a'])).toBe("a\r\n'@import")
    expect(toCsv([{ a: '\tlead' }], ['a'])).toBe("a\r\n'\tlead")
  })

  it('quotes after prefixing when the guarded text still needs quoting', () => {
    expect(toCsv([{ a: '=A1,B1' }], ['a'])).toBe('a\r\n"\'=A1,B1"')
  })

  // The `-`/`+` leaders are the interesting case: they start both formulas and
  // ordinary numbers. Anything that is a complete number literal is exported
  // as a number; anything else that merely starts like one is still guarded.
  it('leaves negative and signed numbers alone', () => {
    expect(toCsv([{ a: -42 }], ['a'])).toBe('a\r\n-42')
    expect(toCsv([{ a: '-42' }], ['a'])).toBe('a\r\n-42')
    expect(toCsv([{ a: '-0.5' }], ['a'])).toBe('a\r\n-0.5')
    expect(toCsv([{ a: '+1.5e3' }], ['a'])).toBe('a\r\n+1.5e3')
  })

  it('still guards a payload that only begins like a number', () => {
    expect(toCsv([{ a: '-2+3+cmd' }], ['a'])).toBe("a\r\n'-2+3+cmd")
    expect(toCsv([{ a: '-' }], ['a'])).toBe("a\r\n'-")
    expect(toCsv([{ a: '+1 800 555' }], ['a'])).toBe("a\r\n'+1 800 555")
  })

  it('does not touch a formula character that is not first', () => {
    expect(toCsv([{ a: 'a=b' }], ['a'])).toBe('a\r\na=b')
  })
})
