import { describe, it, expect } from 'vitest'
import { computeJsonDiff, pathHasDiff } from '../utils/jsonDiff'

describe('computeJsonDiff', () => {
  it('returns empty map for equal objects', () => {
    const left = { a: 1, b: 'hello' }
    const right = { a: 1, b: 'hello' }
    const diffs = computeJsonDiff(left, right)
    expect(diffs.size).toBe(0)
  })

  it('detects changed values', () => {
    const left = { a: 1, b: 'hello' }
    const right = { a: 2, b: 'hello' }
    const diffs = computeJsonDiff(left, right)
    expect(diffs.has('$.a')).toBe(true)
    expect(diffs.get('$.a')).toBe('changed')
    expect(diffs.has('$.b')).toBe(false)
  })

  it('detects added keys', () => {
    const left = { a: 1 }
    const right = { a: 1, b: 2 }
    const diffs = computeJsonDiff(left, right)
    expect(diffs.has('$.b')).toBe(true)
    expect(diffs.get('$.b')).toBe('added')
  })

  it('detects removed keys', () => {
    const left = { a: 1, b: 2 }
    const right = { a: 1 }
    const diffs = computeJsonDiff(left, right)
    expect(diffs.has('$.b')).toBe(true)
    expect(diffs.get('$.b')).toBe('removed')
  })

  it('handles nested objects', () => {
    const left = { user: { name: 'Alice', age: 30 } }
    const right = { user: { name: 'Bob', age: 30 } }
    const diffs = computeJsonDiff(left, right)
    expect(diffs.has('$.user.name')).toBe(true)
    expect(diffs.get('$.user.name')).toBe('changed')
    expect(diffs.has('$.user.age')).toBe(false)
  })

  it('handles arrays with different lengths', () => {
    const left = [1, 2, 3]
    const right = [1, 2, 3, 4]
    const diffs = computeJsonDiff(left, right)
    expect(diffs.has('$[3]')).toBe(true)
    expect(diffs.get('$[3]')).toBe('added')
  })

  it('handles arrays with changed elements', () => {
    const left = [1, 2, 3]
    const right = [1, 99, 3]
    const diffs = computeJsonDiff(left, right)
    expect(diffs.has('$[1]')).toBe(true)
    expect(diffs.get('$[1]')).toBe('changed')
  })

  it('handles null vs non-null', () => {
    const left = { a: null }
    const right = { a: 'hello' }
    const diffs = computeJsonDiff(left, right)
    expect(diffs.has('$.a')).toBe(true)
    expect(diffs.get('$.a')).toBe('changed')
  })

  it('handles type changes (object to primitive)', () => {
    const left = { a: { nested: true } }
    const right = { a: 42 }
    const diffs = computeJsonDiff(left, right)
    expect(diffs.has('$.a')).toBe(true)
    expect(diffs.get('$.a')).toBe('changed')
  })

  it('handles deeply nested diffs', () => {
    const left = { level1: { level2: { level3: { value: 'old' } } } }
    const right = { level1: { level2: { level3: { value: 'new' } } } }
    const diffs = computeJsonDiff(left, right)
    expect(diffs.has('$.level1.level2.level3.value')).toBe(true)
  })
})

describe('pathHasDiff', () => {
  it('returns the diff type for exact path match', () => {
    const diffs = new Map([['$.a', 'changed' as const]])
    expect(pathHasDiff(diffs, '$.a')).toBe('changed')
  })

  it('returns changed when child paths have diffs', () => {
    const diffs = new Map([['$.user.name', 'changed' as const]])
    expect(pathHasDiff(diffs, '$.user')).toBe('changed')
  })

  it('returns null when no diffs match', () => {
    const diffs = new Map([['$.a', 'changed' as const]])
    expect(pathHasDiff(diffs, '$.b')).toBeNull()
  })

  it('does not false-match partial path names', () => {
    const diffs = new Map([['$.abc', 'changed' as const]])
    // '$.a' should NOT match '$.abc' as a child
    expect(pathHasDiff(diffs, '$.a')).toBeNull()
  })
})
