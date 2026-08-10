import { describe, it, expect } from 'vitest'
import { repairJson } from '../utils/jsonRepair'

/** Repairs `raw` and returns the parsed result, failing loudly if it did not. */
function repaired(raw: string): unknown {
  const result = repairJson(raw)
  expect(result.ok, result.error).toBe(true)
  return JSON.parse(result.text as string)
}

describe('repairJson on input that is already valid', () => {
  it('returns the text byte for byte and reports no changes', () => {
    const raw = '{\n  "a": 1,\n  "b": [true, null]\n}'
    expect(repairJson(raw)).toEqual({ ok: true, text: raw, changes: [] })
  })

  it('leaves surrounding whitespace alone rather than reformatting', () => {
    expect(repairJson('  [1, 2]  ').text).toBe('  [1, 2]  ')
  })

  it('accepts a bare scalar document', () => {
    expect(repairJson('42')).toEqual({ ok: true, text: '42', changes: [] })
    expect(repairJson('"hi"').changes).toEqual([])
  })

  it('rejects an empty input', () => {
    expect(repairJson('')).toEqual({ ok: false, error: 'Input is empty' })
    expect(repairJson('   \n ')).toEqual({ ok: false, error: 'Input is empty' })
  })
})

describe('repairJson trailing commas', () => {
  it('drops a trailing comma in an object', () => {
    expect(repairJson('{"a":1,}').text).toBe('{"a":1}')
  })

  it('drops a trailing comma in an array', () => {
    expect(repairJson('[1,2,]').text).toBe('[1,2]')
  })

  it('drops a trailing comma that is separated by whitespace and newlines', () => {
    expect(repaired('{\n  "a": 1,\n}')).toEqual({ a: 1 })
  })

  it('drops trailing commas at every nesting level', () => {
    expect(repaired('{"a":[1,2,],"b":{"c":3,},}')).toEqual({ a: [1, 2], b: { c: 3 } })
  })

  it('removes a repeated or leading comma', () => {
    expect(repairJson('[1,,2]').text).toBe('[1,2]')
    expect(repairJson('[,1]').text).toBe('[1]')
    expect(repairJson('[1,,2]').changes).toContain('removed a stray comma')
  })

  it('names the fix', () => {
    expect(repairJson('[1,]').changes).toEqual(['removed a trailing comma'])
  })
})

describe('repairJson comments', () => {
  it('strips a line comment', () => {
    expect(repaired('{\n  // the name\n  "a": 1\n}')).toEqual({ a: 1 })
  })

  it('strips a block comment, including a multi-line one', () => {
    expect(repaired('{"a": /* why */ 1, /* and\n more */ "b": 2}')).toEqual({ a: 1, b: 2 })
  })

  it('ignores a comment left after the document', () => {
    expect(repaired('{"a": 1} // done')).toEqual({ a: 1 })
    expect(repaired('{"a": 1} /* unterminated')).toEqual({ a: 1 })
  })

  it('strips a comment that is never closed inside the document', () => {
    expect(repaired('{"a": 1 /* unterminated')).toEqual({ a: 1 })
  })

  it('reports line and block comments separately', () => {
    const changes = repairJson('{ // one\n "a": 1 /* two */ }').changes
    expect(changes).toContain('stripped a line comment')
    expect(changes).toContain('stripped a block comment')
  })
})

describe('repairJson quoting', () => {
  it('converts single-quoted strings', () => {
    expect(repairJson("{'a': 'b'}").text).toBe('{"a": "b"}')
    expect(repairJson("{'a': 'b'}").changes).toContain(
      'converted a single-quoted string to double quotes',
    )
  })

  it('escapes a double quote that was safe inside single quotes', () => {
    expect(repaired(`{'a': 'say "hi"'}`)).toEqual({ a: 'say "hi"' })
  })

  it('keeps an escaped single quote as a plain apostrophe', () => {
    expect(repaired(`{'a': 'it\\'s here'}`)).toEqual({ a: `it's here` })
  })

  it('replaces smart quotes', () => {
    expect(repaired('{\u201Ca\u201D: \u201Cb\u201D}')).toEqual({ a: 'b' })
    expect(repaired('{\u2018a\u2019: \u2018b\u2019}')).toEqual({ a: 'b' })
    expect(repairJson('{\u201Ca\u201D: 1}').changes).toContain(
      'replaced smart quotes with straight quotes',
    )
  })

  it('quotes unquoted keys', () => {
    expect(repairJson('{a: 1, b: 2}').text).toBe('{"a": 1, "b": 2}')
    expect(repairJson('{a: 1}').changes).toEqual(['quoted an unquoted key'])
  })

  it('quotes an unquoted key that is not a plain identifier', () => {
    expect(repaired('{content-type: 1, $ref: 2}')).toEqual({ 'content-type': 1, $ref: 2 })
  })

  it('quotes a bare value as a string', () => {
    expect(repaired('{"status": ok}')).toEqual({ status: 'ok' })
    expect(repairJson('{"status": ok}').changes).toContain('quoted a bare value as a string')
  })

  it('closes an unterminated string', () => {
    expect(repaired('{"a": "abc')).toEqual({ a: 'abc' })
    expect(repairJson('{"a": "abc').changes).toContain('closed an unterminated string')
  })

  it('escapes a raw newline or tab that was left inside a string', () => {
    expect(repaired('{"a": "line1\nline2",}')).toEqual({ a: 'line1\nline2' })
    expect(repairJson('{"a": "x\ty",}').changes).toContain(
      'escaped a control character inside a string',
    )
  })

  it('drops a backslash from an escape JSON does not define', () => {
    expect(repaired('{"a": "C:\\Program\\Files",}')).toEqual({ a: 'C:ProgramFiles' })
    expect(repairJson('{"a": "\\x41",}').changes).toContain('fixed an invalid string escape')
  })

  it('preserves the escapes JSON does define', () => {
    expect(repaired('{"a": "tab\\there \\u00e9 \\"q\\"",}')).toEqual({ a: 'tab\there é "q"' })
  })
})

// The repair is only trustworthy if it never edits string *content*. Every case
// below hides a character that means something to the parser inside a string.
describe('repairJson never touches the inside of a string', () => {
  it('keeps a // that is part of a URL', () => {
    expect(repaired('{"url": "https://example.com//a",}')).toEqual({
      url: 'https://example.com//a',
    })
  })

  it('keeps text that looks like a block comment', () => {
    expect(repaired('{"a": "/* not a comment */",}')).toEqual({ a: '/* not a comment */' })
  })

  it('keeps commas and braces that are part of the text', () => {
    expect(repaired('{"a": "x, y {z} [w]",}')).toEqual({ a: 'x, y {z} [w]' })
  })

  it('keeps a trailing comma that lives inside a string', () => {
    expect(repaired('{"a": "ends with,",}')).toEqual({ a: 'ends with,' })
  })

  it('keeps quote characters that appear inside single-quoted content', () => {
    expect(repaired("{'a': 'a \u201Csmart\u201D word'}")).toEqual({ a: 'a \u201Csmart\u201D word' })
  })

  it('keeps literals that would be rewritten outside a string', () => {
    expect(repaired('{"a": "NaN", "b": "undefined",}')).toEqual({ a: 'NaN', b: 'undefined' })
  })

  it('keeps a closing brace inside a string when brackets are being balanced', () => {
    expect(repaired('{"a": "}}}"')).toEqual({ a: '}}}' })
  })

  it('does not treat text inside a string as junk around the document', () => {
    expect(repaired('{"log": "INFO payload={\\"x\\":1} done",}')).toEqual({
      log: 'INFO payload={"x":1} done',
    })
  })
})

describe('repairJson non-JSON literals', () => {
  it('replaces NaN, Infinity and undefined with null', () => {
    expect(repaired('{"a": NaN, "b": Infinity, "c": -Infinity, "d": undefined}')).toEqual({
      a: null,
      b: null,
      c: null,
      d: null,
    })
  })

  it('names each replaced literal', () => {
    expect(repairJson('[NaN, undefined]').changes).toEqual([
      'replaced NaN with null',
      'replaced undefined with null',
    ])
  })

  it('leaves true, false and null alone', () => {
    expect(repaired('[true, false, null,]')).toEqual([true, false, null])
  })

  it('normalises number spellings JSON rejects', () => {
    expect(repaired('{"a": .5, "b": +7, "c": 1., "d": 0x1f}')).toEqual({
      a: 0.5,
      b: 7,
      c: 1,
      d: 31,
    })
    expect(repairJson('[.5]').changes).toContain('normalised a number literal')
  })

  it('leaves a well-formed number exactly as written', () => {
    expect(repairJson('[1e3, -0.25,]').text).toBe('[1e3, -0.25]')
  })
})

describe('repairJson brackets', () => {
  it('closes unclosed containers at the end of the input', () => {
    expect(repaired('{"a": {"b": [1, 2')).toEqual({ a: { b: [1, 2] } })
    expect(repairJson('{"a": 1').changes).toContain('added a missing closing bracket')
  })

  it('removes a trailing comma before adding the missing bracket', () => {
    expect(repaired('{"a": 1,')).toEqual({ a: 1 })
  })

  it('corrects a closing bracket of the wrong kind', () => {
    expect(repaired('{"a": [1, 2}')).toEqual({ a: [1, 2] })
    expect(repairJson('{"a": [1, 2}').changes).toContain('corrected a mismatched closing bracket')
  })
})

describe('repairJson surrounding text', () => {
  it('extracts JSON embedded in a log line', () => {
    const raw = '2024-05-01 12:00:00 INFO payload={"a":1} request finished'
    expect(repairJson(raw).text).toBe('{"a":1}')
    expect(repairJson(raw).changes).toEqual([
      'discarded text before the JSON',
      'discarded text after the JSON',
    ])
  })

  it('extracts an array from a shell transcript', () => {
    expect(repaired('$ curl -s /items\n[1, 2, 3]\n$ ')).toEqual([1, 2, 3])
  })

  it('does not call a leading comment junk', () => {
    expect(repairJson('// header\n{"a":1,}').changes).toEqual([
      'stripped a line comment',
      'removed a trailing comma',
    ])
  })
})

describe('repairJson failure', () => {
  it('reports the parser error when the input cannot be rescued', () => {
    const result = repairJson('{"a" 1}')
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
    expect(result.text).toBeUndefined()
  })

  it('still lists what it attempted, so the failure is explainable', () => {
    expect(repairJson('{"a" 1,}').changes).toContain('removed a trailing comma')
  })
})

describe('repairJson change list', () => {
  it('mentions each distinct fix exactly once', () => {
    const changes = repairJson('{a: 1, b: 2, c: 3,}').changes as string[]
    expect(changes).toEqual(['quoted an unquoted key', 'removed a trailing comma'])
  })

  it('handles everything wrong at once', () => {
    const raw = `{
      // a config someone hand-edited
      'name': 'demo',   /* still fine */
      retries: NaN,
      hosts: ['a', 'b',],
    `
    expect(repaired(raw)).toEqual({
      name: 'demo',
      retries: null,
      hosts: ['a', 'b'],
    })
  })
})
