import { describe, it, expect } from 'vitest'
import {
  getAtPath,
  setAtPath,
  renameKeyAtPath,
  deleteAtPath,
  appendChildAtPath,
  segmentsEqual,
  segmentsStartWith,
  parseEditedValue,
  valueToEditText,
  valueToCopyText,
} from '../utils/jsonEdit'

describe('getAtPath', () => {
  it('reads nested object and array positions', () => {
    const doc = { a: { b: [10, 20] } }
    expect(getAtPath(doc, ['a', 'b', 1])).toBe(20)
    expect(getAtPath(doc, ['a'])).toEqual({ b: [10, 20] })
  })

  it('returns the root for an empty path', () => {
    const doc = { a: 1 }
    expect(getAtPath(doc, [])).toBe(doc)
  })

  it('returns undefined when the path runs past a scalar', () => {
    expect(getAtPath({ a: 1 }, ['a', 'b'])).toBeUndefined()
  })
})

describe('setAtPath', () => {
  it('replaces a nested value', () => {
    const doc = { a: { b: 1 }, c: 2 }
    const next = setAtPath(doc, ['a', 'b'], 99)
    expect(next).toEqual({ a: { b: 99 }, c: 2 })
  })

  it('replaces an array element', () => {
    const next = setAtPath({ list: [1, 2, 3] }, ['list', 1], 'two')
    expect(next).toEqual({ list: [1, 'two', 3] })
  })

  it('does not mutate the original document', () => {
    const doc = { a: { b: 1 } }
    setAtPath(doc, ['a', 'b'], 99)
    expect(doc.a.b).toBe(1)
  })

  it('keeps untouched subtrees identical, so React can skip them', () => {
    const doc = { changed: { x: 1 }, untouched: { y: 2 } }
    const next = setAtPath(doc, ['changed', 'x'], 5) as typeof doc
    expect(next.untouched).toBe(doc.untouched)
    expect(next.changed).not.toBe(doc.changed)
  })

  it('replaces the whole document for an empty path', () => {
    expect(setAtPath({ a: 1 }, [], 'replaced')).toBe('replaced')
  })

  it('is a no-op for a key that does not exist', () => {
    const doc = { a: 1 }
    expect(setAtPath(doc, ['missing'], 2)).toBe(doc)
  })

  it('is a no-op for an out-of-range array index', () => {
    const doc = { list: [1] }
    expect(setAtPath(doc, ['list', 5], 9)).toBe(doc)
  })

  it('returns the same document when the value is already there', () => {
    const doc = { a: { b: 1 } }
    expect(setAtPath(doc, ['a', 'b'], 1)).toBe(doc)
  })

  it('does not clone ancestors when a nested write turns out to be a no-op', () => {
    const doc = { deep: { list: [1] } }
    expect(setAtPath(doc, ['deep', 'list', 9], 'x')).toBe(doc)
  })

  it('handles keys containing dots and brackets', () => {
    const doc = { 'a.b': { 'c[0]': 1 } }
    const next = setAtPath(doc, ['a.b', 'c[0]'], 2)
    expect(next).toEqual({ 'a.b': { 'c[0]': 2 } })
  })

  it('stores a __proto__ key as an own property instead of polluting the prototype', () => {
    const doc = JSON.parse('{"__proto__": 1}') as Record<string, unknown>
    const next = setAtPath(doc, ['__proto__'], 2) as Record<string, unknown>
    expect(Object.getOwnPropertyDescriptor(next, '__proto__')?.value).toBe(2)
    expect(Object.getPrototypeOf(next)).toBe(Object.prototype)
  })
})

describe('renameKeyAtPath', () => {
  it('renames a key while preserving key order', () => {
    const doc = { first: 1, second: 2, third: 3 }
    const result = renameKeyAtPath(doc, ['second'], 'middle')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(Object.keys(result.root as object)).toEqual(['first', 'middle', 'third'])
    expect((result.root as Record<string, unknown>).middle).toBe(2)
  })

  it('renames a nested key', () => {
    const result = renameKeyAtPath({ a: { old: 1 } }, ['a', 'old'], 'new')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.root).toEqual({ a: { new: 1 } })
  })

  it('rejects a rename onto an existing sibling key', () => {
    const result = renameKeyAtPath({ a: 1, b: 2 }, ['a'], 'b')
    expect(result).toEqual({ ok: false, reason: 'duplicate' })
  })

  it('rejects an empty key', () => {
    const result = renameKeyAtPath({ a: 1 }, ['a'], '')
    expect(result).toEqual({ ok: false, reason: 'empty' })
  })

  it('treats renaming to the same key as a no-op success', () => {
    const doc = { a: 1 }
    const result = renameKeyAtPath(doc, ['a'], 'a')
    expect(result).toEqual({ ok: true, root: doc })
  })

  it('refuses to rename an array index', () => {
    const result = renameKeyAtPath({ list: [1] }, ['list', 0], 'x')
    expect(result).toEqual({ ok: false, reason: 'unsupported' })
  })

  it('refuses to rename the root', () => {
    const result = renameKeyAtPath({ a: 1 }, [], 'x')
    expect(result).toEqual({ ok: false, reason: 'unsupported' })
  })
})

describe('deleteAtPath', () => {
  it('removes an object key and keeps the rest in order', () => {
    const next = deleteAtPath({ a: 1, b: 2, c: 3 }, ['b'])
    expect(Object.keys(next as object)).toEqual(['a', 'c'])
  })

  it('splices an array element so later indices shift down', () => {
    const next = deleteAtPath({ list: ['a', 'b', 'c'] }, ['list', 1])
    expect(next).toEqual({ list: ['a', 'c'] })
  })

  it('removes a nested entry', () => {
    const next = deleteAtPath({ outer: { keep: 1, drop: 2 } }, ['outer', 'drop'])
    expect(next).toEqual({ outer: { keep: 1 } })
  })

  it('does not mutate the original document', () => {
    const doc = { a: 1, b: 2 }
    deleteAtPath(doc, ['a'])
    expect(doc).toEqual({ a: 1, b: 2 })
  })

  it('refuses to delete the root', () => {
    const doc = { a: 1 }
    expect(deleteAtPath(doc, [])).toBe(doc)
  })

  it('is a no-op for a path that does not exist', () => {
    const doc = { a: 1 }
    expect(deleteAtPath(doc, ['missing'])).toBe(doc)
    expect(deleteAtPath(doc, ['a', 'deeper'])).toBe(doc)
  })
})

describe('appendChildAtPath', () => {
  it('appends a null item to an array and points at it', () => {
    const result = appendChildAtPath({ list: [1] }, ['list'])
    expect(result).not.toBeNull()
    expect(result?.root).toEqual({ list: [1, null] })
    expect(result?.segments).toEqual(['list', 1])
  })

  it('adds a placeholder key to an object and points at it', () => {
    const result = appendChildAtPath({ a: 1 }, [])
    expect(result?.root).toEqual({ a: 1, newKey: null })
    expect(result?.segments).toEqual(['newKey'])
  })

  it('numbers the placeholder key when it is already taken', () => {
    const result = appendChildAtPath({ newKey: 1, newKey2: 2 }, [])
    expect(result?.segments).toEqual(['newKey3'])
  })

  it('appends after existing keys rather than reordering them', () => {
    const result = appendChildAtPath({ first: 1, second: 2 }, [])
    expect(Object.keys(result?.root as object)).toEqual(['first', 'second', 'newKey'])
  })

  it('fills an empty container', () => {
    expect(appendChildAtPath({ empty: {} }, ['empty'])?.root).toEqual({ empty: { newKey: null } })
    expect(appendChildAtPath({ empty: [] }, ['empty'])?.root).toEqual({ empty: [null] })
  })

  it('does not mutate the original document', () => {
    const doc = { list: [1] }
    appendChildAtPath(doc, ['list'])
    expect(doc).toEqual({ list: [1] })
  })

  it('returns null when the target is not a container', () => {
    expect(appendChildAtPath({ a: 1 }, ['a'])).toBeNull()
  })
})

describe('segment comparison', () => {
  it('matches identical paths only', () => {
    expect(segmentsEqual(['a', 0], ['a', 0])).toBe(true)
    expect(segmentsEqual(['a'], ['a', 0])).toBe(false)
    expect(segmentsEqual(['a', 1], ['a', 0])).toBe(false)
  })

  it('treats an index and its string form as the same segment', () => {
    expect(segmentsEqual(['list', 0], ['list', '0'])).toBe(true)
  })

  it('recognises ancestors, including the root', () => {
    expect(segmentsStartWith([], ['a', 'b'])).toBe(true)
    expect(segmentsStartWith(['a'], ['a', 'b'])).toBe(true)
    expect(segmentsStartWith(['a', 'b'], ['a', 'b'])).toBe(true)
    expect(segmentsStartWith(['a', 'b'], ['a'])).toBe(false)
    expect(segmentsStartWith(['b'], ['a', 'b'])).toBe(false)
  })
})

describe('parseEditedValue', () => {
  it('keeps a string a string, without requiring quotes', () => {
    expect(parseEditedValue('old', 'new text')).toEqual({ ok: true, value: 'new text' })
  })

  it('keeps text that looks like JSON as a string when the original was a string', () => {
    expect(parseEditedValue('old', '42')).toEqual({ ok: true, value: '42' })
  })

  it('reads non-strings back as JSON literals', () => {
    expect(parseEditedValue(1, '42')).toEqual({ ok: true, value: 42 })
    expect(parseEditedValue(false, 'true')).toEqual({ ok: true, value: true })
    expect(parseEditedValue(null, 'null')).toEqual({ ok: true, value: null })
  })

  it('allows changing type through a JSON literal', () => {
    expect(parseEditedValue(1, '"now a string"')).toEqual({ ok: true, value: 'now a string' })
    expect(parseEditedValue(1, '{"a":1}')).toEqual({ ok: true, value: { a: 1 } })
  })

  it('rejects text that is not valid JSON when the original was not a string', () => {
    expect(parseEditedValue(1, 'not json')).toEqual({ ok: false })
  })
})

describe('valueToEditText', () => {
  it('shows a string bare and everything else as a JSON literal', () => {
    expect(valueToEditText('hello')).toBe('hello')
    expect(valueToEditText(42)).toBe('42')
    expect(valueToEditText(null)).toBe('null')
    expect(valueToEditText(true)).toBe('true')
  })

  it('round-trips through parseEditedValue', () => {
    for (const value of ['text', 42, true, null]) {
      expect(parseEditedValue(value, valueToEditText(value))).toEqual({ ok: true, value })
    }
  })
})

describe('valueToCopyText', () => {
  it('copies a string without quotes', () => {
    expect(valueToCopyText('https://example.com')).toBe('https://example.com')
  })

  it('copies a subtree as formatted JSON', () => {
    expect(valueToCopyText({ a: 1 })).toBe('{\n  "a": 1\n}')
  })

  it('copies scalars as their literal', () => {
    expect(valueToCopyText(42)).toBe('42')
    expect(valueToCopyText(null)).toBe('null')
  })
})
