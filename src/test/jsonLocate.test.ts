import { describe, it, expect } from 'vitest'
import { locatePath } from '../utils/jsonLocate'
import type { PathSegment } from '../utils/jsonEdit'

/**
 * Asserting on the located TEXT rather than on raw offsets — a failure then
 * says "expected `2`, got `1`" instead of "expected 33, got 10".
 */
function textAt(raw: string, segments: readonly PathSegment[]): string | null {
  const range = locatePath(raw, segments)
  if (!range) return null
  return raw.slice(range.start, range.end)
}

describe('locatePath / the whole document', () => {
  it('locates a top-level scalar', () => {
    expect(textAt('42', [])).toBe('42')
    expect(textAt('"hello"', [])).toBe('"hello"')
    expect(textAt('true', [])).toBe('true')
    expect(textAt('false', [])).toBe('false')
    expect(textAt('null', [])).toBe('null')
    expect(textAt('-1.5e+10', [])).toBe('-1.5e+10')
  })

  it('excludes whitespace around the top-level value', () => {
    expect(locatePath('  \n  {"a":1}  \n ', [])).toEqual({ start: 5, end: 12 })
    expect(textAt('  \n  {"a":1}  \n ', [])).toBe('{"a":1}')
  })

  it('locates a top-level object and array whole', () => {
    expect(textAt('{"a":1,"b":[2,3]}', [])).toBe('{"a":1,"b":[2,3]}')
    expect(textAt('[1,[2],{"a":3}]', [])).toBe('[1,[2],{"a":3}]')
    expect(textAt('{}', [])).toBe('{}')
    expect(textAt('[]', [])).toBe('[]')
  })
})

describe('locatePath / objects and arrays', () => {
  const doc = '{"a":{"b":{"c":[1,2,3]}},"d":"x"}'

  it('walks nested objects', () => {
    expect(textAt(doc, ['a'])).toBe('{"b":{"c":[1,2,3]}}')
    expect(textAt(doc, ['a', 'b'])).toBe('{"c":[1,2,3]}')
    expect(textAt(doc, ['a', 'b', 'c'])).toBe('[1,2,3]')
    expect(textAt(doc, ['d'])).toBe('"x"')
  })

  it('indexes into arrays positionally', () => {
    expect(textAt(doc, ['a', 'b', 'c', 0])).toBe('1')
    expect(textAt(doc, ['a', 'b', 'c', 1])).toBe('2')
    expect(textAt(doc, ['a', 'b', 'c', 2])).toBe('3')
  })

  it('accepts an index written as a string segment, like the tree passes it', () => {
    expect(textAt(doc, ['a', 'b', 'c', '1'])).toBe('2')
  })

  it('distinguishes identical values in different rows', () => {
    // The case a re-serialise-and-search implementation gets wrong: every one
    // of these values also occurs elsewhere in the document.
    const rows = '[{"id":1,"name":"Ada"},{"id":1,"name":"Ada"}]'
    expect(locatePath(rows, [0, 'name'])).toEqual({ start: 16, end: 21 })
    expect(locatePath(rows, [1, 'name'])).toEqual({ start: 38, end: 43 })
    expect(textAt(rows, [0, 'name'])).toBe('"Ada"')
    expect(textAt(rows, [1, 'name'])).toBe('"Ada"')
  })

  it('locates every scalar type nested in an object', () => {
    const scalars = '{"n":-1.5e+10,"z":0,"t":true,"f":false,"u":null,"s":"txt"}'
    expect(textAt(scalars, ['n'])).toBe('-1.5e+10')
    expect(textAt(scalars, ['z'])).toBe('0')
    expect(textAt(scalars, ['t'])).toBe('true')
    expect(textAt(scalars, ['f'])).toBe('false')
    expect(textAt(scalars, ['u'])).toBe('null')
    expect(textAt(scalars, ['s'])).toBe('"txt"')
  })

  it('locates values inside arrays of arrays', () => {
    const grid = '[[1,2],[3,[4,5]]]'
    expect(textAt(grid, [1])).toBe('[3,[4,5]]')
    expect(textAt(grid, [1, 1])).toBe('[4,5]')
    expect(textAt(grid, [1, 1, 0])).toBe('4')
  })
})

describe('locatePath / formatting', () => {
  const pretty = '{\n  "a": {\n    "b": 1\n  }\n}'
  const minified = '{"a":{"b":1}}'

  it('reports the offsets of the raw text it was given, not of a re-print', () => {
    expect(locatePath(pretty, ['a', 'b'])).toEqual({ start: 20, end: 21 })
    expect(locatePath(minified, ['a', 'b'])).toEqual({ start: 10, end: 11 })
    expect(textAt(pretty, ['a', 'b'])).toBe('1')
    expect(textAt(minified, ['a', 'b'])).toBe('1')
  })

  it('keeps the user formatting inside a located subtree', () => {
    expect(textAt(pretty, ['a'])).toBe('{\n    "b": 1\n  }')
  })

  it('tolerates whitespace everywhere JSON allows it', () => {
    const spaced = ' \t{ \n "a" \n : \t[ 1 , { "b" : true } ] \r\n } \n '
    expect(textAt(spaced, ['a', 1, 'b'])).toBe('true')
    expect(textAt(spaced, ['a', 0])).toBe('1')
    expect(textAt(spaced, ['a'])).toBe('[ 1 , { "b" : true } ]')
  })

  it('handles tab- and CRLF-indented documents', () => {
    const crlf = '{\r\n\t"a": [\r\n\t\t"x"\r\n\t]\r\n}'
    expect(textAt(crlf, ['a', 0])).toBe('"x"')
  })

  it('agrees with JSON.parse about what the located text means', () => {
    const value = { list: [1, { deep: 'value' }], flag: false }
    for (const raw of [JSON.stringify(value), JSON.stringify(value, null, 2)]) {
      expect(JSON.parse(textAt(raw, ['list', 1]) as string)).toEqual({ deep: 'value' })
      expect(textAt(raw, ['list', 1, 'deep'])).toBe('"value"')
      expect(textAt(raw, ['flag'])).toBe('false')
    }
  })
})

describe('locatePath / strings that look like structure', () => {
  it('is not confused by braces, commas, colons or escaped quotes in a value', () => {
    const raw = '{"a":"he said \\"hi\\": {x,y}","b":2}'
    expect(raw).toContain('\\"hi\\"')
    expect(textAt(raw, ['a'])).toBe('"he said \\"hi\\": {x,y}"')
    expect(textAt(raw, ['b'])).toBe('2')
  })

  it('is not confused by a backslash immediately before the closing quote', () => {
    // The JSON text is {"a":"c:\\","b":1} — the value decodes to `c:\`.
    const raw = '{"a":"c:\\\\","b":1}'
    expect(JSON.parse(raw)).toEqual({ a: 'c:\\', b: 1 })
    expect(textAt(raw, ['a'])).toBe('"c:\\\\"')
    expect(textAt(raw, ['b'])).toBe('1')
  })

  it('is not confused by bracket-heavy array items', () => {
    const raw = '["],[",  "}{",  "\\"]"]'
    expect(JSON.parse(raw)).toEqual(['],[', '}{', '"]'])
    expect(textAt(raw, [0])).toBe('"],["')
    expect(textAt(raw, [1])).toBe('"}{"')
    expect(textAt(raw, [2])).toBe('"\\"]"')
  })

  it('steps over escape sequences without losing count', () => {
    const raw = '{"a":"\\u007B\\n\\t\\\\","b":"after"}'
    expect(textAt(raw, ['b'])).toBe('"after"')
  })
})

describe('locatePath / awkward keys', () => {
  it('matches a key containing a dot rather than treating it as a path', () => {
    const raw = '{"a.b":1,"a":{"b":2}}'
    expect(textAt(raw, ['a.b'])).toBe('1')
    expect(textAt(raw, ['a', 'b'])).toBe('2')
  })

  it('matches a key containing brackets', () => {
    const raw = '{"c[0]":1,"c":[9]}'
    expect(textAt(raw, ['c[0]'])).toBe('1')
    expect(textAt(raw, ['c', 0])).toBe('9')
  })

  it('matches a key containing structural punctuation', () => {
    const raw = '{"{,:}":1,"a":2}'
    expect(textAt(raw, ['{,:}'])).toBe('1')
    expect(textAt(raw, ['a'])).toBe('2')
  })

  it('matches a key written with a \\uXXXX escape by its decoded value', () => {
    const raw = '{"a\\u002Eb":1}'
    expect(Object.keys(JSON.parse(raw) as object)).toEqual(['a.b'])
    expect(textAt(raw, ['a.b'])).toBe('1')
    expect(textAt(raw, ['a\\u002Eb'])).toBeNull()
  })

  it('matches a key written with other escapes', () => {
    const raw = '{"quote\\"key":1,"caf\\u00e9":2,"tab\\there":3}'
    // Built from the code point rather than typed, so the assertion cannot
    // drift on how this file happens to be normalised.
    const eAcute = String.fromCharCode(0x00e9)
    expect(Object.keys(JSON.parse(raw) as object)).toEqual(['quote"key', `caf${eAcute}`, 'tab\there'])
    expect(textAt(raw, ['quote"key'])).toBe('1')
    expect(textAt(raw, [`caf${eAcute}`])).toBe('2')
    expect(textAt(raw, ['tab\there'])).toBe('3')
  })

  it('matches a numeric-looking key on an object', () => {
    const raw = '{"0":"zero","1":"one"}'
    expect(textAt(raw, [0])).toBe('"zero"')
    expect(textAt(raw, ['1'])).toBe('"one"')
  })

  it('matches an empty key', () => {
    expect(textAt('{"":1,"a":2}', [''])).toBe('1')
  })

  it('matches a __proto__ key as a plain member', () => {
    expect(textAt('{"__proto__":{"x":1}}', ['__proto__', 'x'])).toBe('1')
  })
})

describe('locatePath / duplicate keys', () => {
  it('resolves to the last occurrence, the way JSON.parse does', () => {
    const raw = '{"a":1,"b":0,"a":2}'
    // The assumption the implementation is built on, checked rather than assumed.
    expect((JSON.parse(raw) as { a: number }).a).toBe(2)
    expect(textAt(raw, ['a'])).toBe('2')
  })

  it('treats an escaped spelling of a key as the same key', () => {
    const raw = '{"a":1,"\\u0061":2}'
    expect((JSON.parse(raw) as { a: number }).a).toBe(2)
    expect(textAt(raw, ['a'])).toBe('2')
  })

  it('descends only into the winning duplicate, so an earlier one cannot shadow it', () => {
    const raw = '{"a":{"b":1},"a":{"c":2}}'
    expect(JSON.parse(raw)).toEqual({ a: { c: 2 } })
    expect(textAt(raw, ['a', 'c'])).toBe('2')
    // `b` exists in the text but not in the parsed document, so it has no cell.
    expect(locatePath(raw, ['a', 'b'])).toBeNull()
  })

  it('lets a later duplicate win at any depth', () => {
    const raw = '{"a":{"b":1,"b":2}}'
    expect(textAt(raw, ['a', 'b'])).toBe('2')
  })
})

describe('locatePath / paths that do not exist', () => {
  it('returns null for a missing key', () => {
    expect(locatePath('{"a":1}', ['missing'])).toBeNull()
    expect(locatePath('{"a":{"b":1}}', ['a', 'missing'])).toBeNull()
  })

  it('returns null for an out-of-range or negative array index', () => {
    expect(locatePath('[1,2]', [2])).toBeNull()
    expect(locatePath('[1,2]', [-1])).toBeNull()
    expect(locatePath('[]', [0])).toBeNull()
  })

  it('returns null for a non-integer array index', () => {
    expect(locatePath('[1,2]', ['name'])).toBeNull()
    expect(locatePath('[1,2]', [1.5])).toBeNull()
  })

  it('returns null when the path runs past a scalar', () => {
    expect(locatePath('{"a":1}', ['a', 'b'])).toBeNull()
    expect(locatePath('{"a":"text"}', ['a', 0])).toBeNull()
    expect(locatePath('42', ['a'])).toBeNull()
  })

  it('returns null for a key lookup on an array and an index lookup on an object', () => {
    expect(locatePath('{"a":1}', [0])).toBeNull()
    expect(locatePath('{}', ['a'])).toBeNull()
  })
})

describe('locatePath / malformed input', () => {
  const bad = [
    '',
    '   ',
    '{',
    '[',
    '{"a"',
    '{"a":}',
    '{"a":1',
    '{"a" 1}',
    '{"a":1,}',
    '{,}',
    '[1,2',
    '[1,]',
    '[,1]',
    'not json',
    'undefined',
    'NaN',
    "{'a':1}",
    '{a:1}',
    '{"a":01}',
    '01',
    '{"a":.5}',
    '{"a":1.}',
    '{"a":1e}',
    '{"a":+1}',
    '{"a":"unterminated}',
    '{"a":"bad \\escape"}',
    '{"a":"short \\u12"}',
    '{"a":"line\nbreak"}',
    '{"a":1} trailing',
    '[1,2]]',
    '{"a":1}{"b":2}',
  ]

  it.each(bad)('returns null for %j', (raw) => {
    expect(locatePath(raw, [])).toBeNull()
    expect(locatePath(raw, ['a'])).toBeNull()
  })

  it('never throws, whatever it is handed', () => {
    for (const raw of [...bad, '{"a":[[[', '"\\', '\\', '\u0000']) {
      expect(() => locatePath(raw, ['a', 0, 'b'])).not.toThrow()
    }
  })

  it('agrees with JSON.parse on which documents are valid', () => {
    for (const raw of bad) {
      let parses = true
      try {
        JSON.parse(raw)
      } catch {
        parses = false
      }
      expect(parses).toBe(false)
    }
  })
})

describe('locatePath / deep structures', () => {
  it('walks a deeply nested document', () => {
    const depth = 200
    const raw = '['.repeat(depth) + '42' + ']'.repeat(depth)
    const segments: PathSegment[] = Array.from({ length: depth }, () => 0)
    expect(textAt(raw, segments)).toBe('42')
    expect(textAt(raw, segments.slice(0, depth - 1))).toBe('[42]')
  })

  it('walks a deep mix of objects and arrays', () => {
    const levels = 60
    let raw = '"leaf"'
    const segments: PathSegment[] = []
    for (let i = 0; i < levels; i++) {
      raw = i % 2 === 0 ? `{"k${i}": ${raw}}` : `[0, ${raw}]`
      segments.unshift(i % 2 === 0 ? `k${i}` : 1)
    }
    expect(textAt(raw, segments)).toBe('"leaf"')
  })

  it('gives up with null instead of overflowing the stack on absurd nesting', () => {
    // Past the scanner's MAX_DEPTH ceiling — deliberately unlocatable.
    const depth = 700
    const raw = '['.repeat(depth) + '1' + ']'.repeat(depth)
    expect(() => locatePath(raw, [])).not.toThrow()
    expect(locatePath(raw, [])).toBeNull()
  })
})
