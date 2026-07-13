import { describe, it, expect } from 'vitest'
import { computeTreeMatches, splitHighlight } from '../utils/treeSearch'

describe('computeTreeMatches', () => {
  const data = {
    name: 'Alice',
    address: { city: 'Paris', zip: '75001' },
    tags: ['admin', 'user'],
    active: true,
    score: null,
  }

  it('returns no matches for an empty query', () => {
    const { matches, expandPaths } = computeTreeMatches(data, '   ')
    expect(matches).toEqual([])
    expect(expandPaths.size).toBe(0)
  })

  it('matches object keys (case-insensitive)', () => {
    const { matches } = computeTreeMatches(data, 'CITY')
    expect(matches).toContain('$.address.city')
  })

  it('matches string values', () => {
    const { matches } = computeTreeMatches(data, 'paris')
    expect(matches).toContain('$.address.city')
  })

  it('matches array item values by index path', () => {
    const { matches } = computeTreeMatches(data, 'admin')
    expect(matches).toContain('$.tags[0]')
  })

  it('matches boolean and null leaves rendered as text', () => {
    expect(computeTreeMatches(data, 'true').matches).toContain('$.active')
    expect(computeTreeMatches(data, 'null').matches).toContain('$.score')
  })

  it('returns matches in depth-first (visual) order', () => {
    const { matches } = computeTreeMatches({ a: 'x', b: { c: 'x' }, d: 'x' }, 'x')
    expect(matches).toEqual(['$.a', '$.b.c', '$.d'])
  })

  it('records ancestor paths that must be expanded', () => {
    const { expandPaths } = computeTreeMatches(data, 'paris')
    expect(expandPaths.has('$')).toBe(true)
    expect(expandPaths.has('$.address')).toBe(true)
    expect(expandPaths.has('$.address.city')).toBe(false)
  })
})

describe('splitHighlight', () => {
  it('returns a single non-matching segment for an empty query', () => {
    expect(splitHighlight('hello', '')).toEqual([{ text: 'hello', match: false }])
  })

  it('flags matching segments case-insensitively', () => {
    expect(splitHighlight('FooBarFoo', 'foo')).toEqual([
      { text: 'Foo', match: true },
      { text: 'Bar', match: false },
      { text: 'Foo', match: true },
    ])
  })

  it('handles a query with no match', () => {
    expect(splitHighlight('hello', 'zzz')).toEqual([{ text: 'hello', match: false }])
  })
})
