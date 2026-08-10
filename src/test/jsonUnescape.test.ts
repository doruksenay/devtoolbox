import { describe, it, expect } from 'vitest'
import { unescapeJsonString, escapeJsonString } from '../utils/jsonUnescape'

describe('unescapeJsonString', () => {
  it('unwraps a stringified object and pretty-prints it', () => {
    const result = unescapeJsonString('"{\\"a\\":1}"')
    expect(result.ok).toBe(true)
    expect(result.layers).toBe(1)
    expect(result.text).toBe('{\n  "a": 1\n}')
  })

  it('unwraps a stringified array', () => {
    const result = unescapeJsonString(JSON.stringify('[1,2]'))
    expect(JSON.parse(result.text as string)).toEqual([1, 2])
  })

  it('peels a payload that was stringified twice', () => {
    const twice = JSON.stringify(JSON.stringify(JSON.stringify({ a: 1 })))
    const result = unescapeJsonString(twice)
    expect(result.layers).toBe(2)
    expect(JSON.parse(result.text as string)).toEqual({ a: 1 })
  })

  it('peels a payload that was stringified three times', () => {
    const thrice = JSON.stringify(JSON.stringify(JSON.stringify(JSON.stringify({ a: [1, 2] }))))
    const result = unescapeJsonString(thrice)
    expect(result.layers).toBe(3)
    expect(JSON.parse(result.text as string)).toEqual({ a: [1, 2] })
  })

  it('reports no layers for input that is already plain JSON', () => {
    const result = unescapeJsonString('{"a":1}')
    expect(result).toEqual({ ok: true, layers: 0, text: '{\n  "a": 1\n}' })
  })

  it('returns the inner text when the payload is a plain string, not JSON', () => {
    expect(unescapeJsonString('"hello world"')).toEqual({
      ok: true,
      layers: 1,
      text: 'hello world',
    })
  })

  it('restores the characters the escaping hid', () => {
    const original = { note: 'line1\nline2\t"quoted"', path: 'C:\\tmp' }
    const result = unescapeJsonString(JSON.stringify(JSON.stringify(original)))
    expect(JSON.parse(result.text as string)).toEqual(original)
  })

  it('handles escaped unicode', () => {
    const result = unescapeJsonString('"{\\"a\\":\\"\\\\u00e9\\"}"')
    expect(JSON.parse(result.text as string)).toEqual({ a: 'é' })
  })

  it('ignores surrounding whitespace', () => {
    expect(unescapeJsonString('  "{\\"a\\":1}"  ').layers).toBe(1)
  })

  it('rejects an empty input', () => {
    expect(unescapeJsonString('')).toEqual({ ok: false, error: 'Input is empty' })
    expect(unescapeJsonString('  \n')).toEqual({ ok: false, error: 'Input is empty' })
  })

  it('rejects text that is neither JSON nor a quoted JSON string', () => {
    const result = unescapeJsonString('hello world')
    expect(result.ok).toBe(false)
    expect(result.error).toBe('Input is neither JSON nor a quoted JSON string')
  })

  it('peels a quoted number down to the number it wraps', () => {
    expect(unescapeJsonString('"42"')).toEqual({ ok: true, layers: 1, text: '42' })
  })

  it('stops peeling instead of spinning on an absurdly nested payload', () => {
    let nested = JSON.stringify({ a: 1 })
    for (let i = 0; i < 18; i += 1) nested = JSON.stringify(nested)
    const result = unescapeJsonString(nested)
    expect(result.ok).toBe(true)
    expect(result.layers).toBe(16)
  })
})

describe('escapeJsonString', () => {
  it('wraps JSON as an escaped string literal', () => {
    expect(escapeJsonString('{"a":1}')).toEqual({ ok: true, text: '"{\\"a\\":1}"' })
  })

  it('collapses a pretty-printed document onto one line', () => {
    const result = escapeJsonString('{\n  "a": 1,\n  "b": [1, 2]\n}')
    expect(result.text).toBe('"{\\"a\\":1,\\"b\\":[1,2]}"')
    expect(result.text).not.toContain('\n')
  })

  it('escapes newlines that belong to the data', () => {
    const result = escapeJsonString(JSON.stringify({ note: 'a\nb' }))
    expect((result.text as string).includes('\n')).toBe(false)
    expect(JSON.parse(JSON.parse(result.text as string))).toEqual({ note: 'a\nb' })
  })

  it('accepts scalars and arrays as documents', () => {
    expect(escapeJsonString('42').text).toBe('"42"')
    expect(escapeJsonString('[1,2]').text).toBe('"[1,2]"')
  })

  it('rejects an empty input', () => {
    expect(escapeJsonString('   ')).toEqual({ ok: false, error: 'Input is empty' })
  })

  it('reports the parser error for invalid JSON', () => {
    const result = escapeJsonString('{a:1}')
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
    expect(result.text).toBeUndefined()
  })
})

describe('escape and unescape together', () => {
  it('round trips a document', () => {
    const original = { a: 1, b: ['x', null], c: { d: true } }
    const escaped = escapeJsonString(JSON.stringify(original))
    const back = unescapeJsonString(escaped.text as string)
    expect(JSON.parse(back.text as string)).toEqual(original)
    expect(back.layers).toBe(1)
  })

  it('round trips a document containing quotes and backslashes', () => {
    const original = { s: 'he said "hi"\\done' }
    const escaped = escapeJsonString(JSON.stringify(original))
    const back = unescapeJsonString(escaped.text as string)
    expect(JSON.parse(back.text as string)).toEqual(original)
  })
})
