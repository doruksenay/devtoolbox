import { describe, it, expect } from 'vitest'
import { looksLikeJsonl, parseJsonl, toJsonl } from '../utils/jsonl'

describe('looksLikeJsonl', () => {
  it('recognises one object per line', () => {
    expect(looksLikeJsonl('{"a":1}\n{"b":2}')).toBe(true)
  })

  it('recognises scalars and arrays one per line', () => {
    expect(looksLikeJsonl('1\n2\n3')).toBe(true)
    expect(looksLikeJsonl('[1]\n[2]')).toBe(true)
    expect(looksLikeJsonl('"a"\n"b"')).toBe(true)
  })

  it('tolerates blank lines and a trailing newline', () => {
    expect(looksLikeJsonl('{"a":1}\n\n{"b":2}\n')).toBe(true)
    expect(looksLikeJsonl('\n{"a":1}\n{"b":2}\n\n')).toBe(true)
  })

  it('tolerates CRLF endings and indented lines', () => {
    expect(looksLikeJsonl('{"a":1}\r\n{"b":2}\r\n')).toBe(true)
    expect(looksLikeJsonl('  {"a":1}\n  {"b":2}')).toBe(true)
  })

  it('does not claim a single JSON document, however it is written', () => {
    expect(looksLikeJsonl('{"a":1}')).toBe(false)
    expect(looksLikeJsonl('[1,2]')).toBe(false)
    expect(looksLikeJsonl('{\n  "a": 1\n}')).toBe(false)
    expect(looksLikeJsonl('[\n  1,\n  2\n]')).toBe(false)
  })

  it('rejects empty or whitespace-only input', () => {
    expect(looksLikeJsonl('')).toBe(false)
    expect(looksLikeJsonl('\n\n  \n')).toBe(false)
  })

  it('rejects a document where any sampled line is not JSON on its own', () => {
    expect(looksLikeJsonl('{"a":1}\nnot json')).toBe(false)
    expect(looksLikeJsonl('{"a":1},\n{"b":2}')).toBe(false)
  })
})

describe('parseJsonl', () => {
  it('parses one value per line', () => {
    expect(parseJsonl('{"a":1}\n{"b":2}')).toEqual({ ok: true, rows: [{ a: 1 }, { b: 2 }] })
  })

  it('tolerates a trailing newline', () => {
    expect(parseJsonl('{"a":1}\n').rows).toEqual([{ a: 1 }])
  })

  it('tolerates blank and whitespace-only lines anywhere', () => {
    expect(parseJsonl('\n{"a":1}\n   \n{"b":2}\n\n').rows).toEqual([{ a: 1 }, { b: 2 }])
  })

  it('handles CRLF and lone CR endings', () => {
    expect(parseJsonl('{"a":1}\r\n{"b":2}').rows).toEqual([{ a: 1 }, { b: 2 }])
    expect(parseJsonl('{"a":1}\r{"b":2}').rows).toEqual([{ a: 1 }, { b: 2 }])
  })

  it('keeps scalars, nulls and nested values', () => {
    expect(parseJsonl('1\nnull\n"x"\n[{"a":[1]}]').rows).toEqual([1, null, 'x', [{ a: [1] }]])
  })

  it('reports the 1-based line number of the first bad line', () => {
    const result = parseJsonl('{"a":1}\n\noops\n{"b":2}')
    expect(result.ok).toBe(false)
    expect(result.line).toBe(3)
    expect(result.error).toMatch(/^Line 3: /)
    expect(result.rows).toBeUndefined()
  })

  it('counts blank lines when numbering, so the number matches the editor', () => {
    expect(parseJsonl('\n\n\n{').line).toBe(4)
  })

  it('rejects input with no JSON at all', () => {
    expect(parseJsonl('')).toEqual({ ok: false, error: 'Input is empty' })
    expect(parseJsonl('  \n \n')).toEqual({ ok: false, error: 'Input is empty' })
  })

  it('does not accept a pretty-printed document split over lines', () => {
    expect(parseJsonl('{\n  "a": 1\n}').ok).toBe(false)
  })
})

describe('toJsonl', () => {
  it('writes one compact value per line with no trailing newline', () => {
    expect(toJsonl([{ a: 1 }, { b: 2 }])).toBe('{"a":1}\n{"b":2}')
  })

  it('writes nothing for no rows', () => {
    expect(toJsonl([])).toBe('')
  })

  it('keeps scalars and nulls', () => {
    expect(toJsonl([1, 'x', null, true])).toBe('1\n"x"\nnull\ntrue')
  })

  it('writes undefined as null rather than dropping the line', () => {
    expect(toJsonl([undefined, 1])).toBe('null\n1')
  })

  it('flattens a nested value onto its single line', () => {
    expect(toJsonl([{ a: { b: [1, 2] } }])).toBe('{"a":{"b":[1,2]}}')
  })

  it('escapes a newline inside a string so the record stays on one line', () => {
    expect(toJsonl([{ a: 'x\ny' }])).toBe('{"a":"x\\ny"}')
  })
})

describe('jsonl round trip', () => {
  it('survives toJsonl then parseJsonl', () => {
    const rows = [{ a: 1 }, { b: 'x\ny' }, [1, 2], null, 'plain']
    expect(parseJsonl(toJsonl(rows)).rows).toEqual(rows)
  })

  it('produces output that detection recognises', () => {
    expect(looksLikeJsonl(toJsonl([{ a: 1 }, { a: 2 }]))).toBe(true)
  })
})
