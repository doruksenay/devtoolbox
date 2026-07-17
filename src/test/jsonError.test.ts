import { describe, it, expect } from 'vitest'
import { findFirstInvalidIndex, locateJsonError, formatJsonError } from '../utils/jsonError'
import { parseJson } from '../context/AppContext'

// Helper: capture the native JSON.parse error message for an input.
function nativeError(input: string): string {
  try {
    JSON.parse(input)
    return ''
  } catch (e) {
    return (e as Error).message
  }
}

describe('findFirstInvalidIndex', () => {
  it('returns -1 for valid JSON', () => {
    expect(findFirstInvalidIndex('{"a": {"b": [1, 2, 3]}}')).toBe(-1)
    expect(findFirstInvalidIndex('[]')).toBe(-1)
    expect(findFirstInvalidIndex('true')).toBe(-1)
    expect(findFirstInvalidIndex('"hi"')).toBe(-1)
    expect(findFirstInvalidIndex('-12.5e3')).toBe(-1)
  })

  it('agrees with JSON.parse validity across a battery of inputs', () => {
    const inputs = [
      '{invalid}',
      '{"a":}',
      '{"a": 1,}',
      '{"a": "b" "c"}',
      '[1,2,',
      '{"a": \u0001 }',
      '\u0001{ "taxRegion": "QC" }',
      '{"a": tru}',
      '{"a": 1.2.3}',
      '{"a": [1, 2 3]}',
      '{"a": "unterminated}',
      '{"a" "b"}',
      '{"a": 1} extra',
      '{}',
      '[1, 2, {"y": 3}]',
      'null',
    ]
    for (const input of inputs) {
      const valid = nativeError(input) === ''
      const idx = findFirstInvalidIndex(input)
      expect(valid ? idx === -1 : idx !== -1).toBe(true)
    }
  })

  it('matches V8 positions when the native message exposes one', () => {
    const inputs = ['{"a": 1,}', '{"a": "b" "c"}', '{"a": [1, 2 3]}', '{"a" "b"}']
    for (const input of inputs) {
      const msg = nativeError(input)
      const pos = Number(/position (\d+)/.exec(msg)?.[1])
      expect(findFirstInvalidIndex(input)).toBe(pos)
    }
  })
})

describe('locateJsonError', () => {
  it('uses the native position when present', () => {
    const input = '{"a": 1,}'
    const loc = locateJsonError(input, nativeError(input))
    expect(loc).toEqual({ position: 8, line: 1, column: 9 })
  })

  it('locates errors when the native message omits the position', () => {
    const input = '\u0001{ "taxRegion": "QC" }'
    const msg = nativeError(input)
    expect(msg).not.toMatch(/position/)
    const loc = locateJsonError(input, msg)
    expect(loc).toEqual({ position: 0, line: 1, column: 1 })
  })

  it('computes correct line and column for multi-line input', () => {
    const input = '{\n  "a": 1\n  "b": 2\n}'
    const loc = locateJsonError(input, nativeError(input))
    expect(loc?.line).toBe(3)
    expect(loc?.column).toBe(3)
  })

  it('points at the end for unexpected end of input', () => {
    const input = '[1, 2,'
    const loc = locateJsonError(input, nativeError(input))
    expect(loc?.position).toBe(input.length)
  })
})

describe('formatJsonError', () => {
  it('includes a line/column header and a caret snippet', () => {
    const input = '{\n  "a": 1\n  "b": 2\n}'
    const out = formatJsonError(input, nativeError(input))
    expect(out).toContain('line 3, column 3')
    expect(out).toContain('^')
    expect(out).toContain('3 | ')
  })

  it('points to the real location even when the token is at the very start', () => {
    const input = '\u0001{ "taxRegion": "QC" }'
    const out = formatJsonError(input, nativeError(input))
    expect(out).toContain('line 1, column 1')
    // control char is rendered as a visible placeholder, not left invisible
    expect(out).toContain('·')
  })

  it('falls back to the native message when no location can be found', () => {
    expect(formatJsonError('{}', 'some unrelated error')).toBe('some unrelated error')
  })
})

describe('parseJson integration', () => {
  it('produces a location-aware error message', () => {
    const result = parseJson('{\n  "a": 1\n  "b": 2\n}')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('line 3, column 3')
  })
})
