import { describe, it, expect } from 'vitest'
import type { TreeRow } from '../components/Tree/treeRows'
import {
  flattenTree,
  expandAncestors,
  ancestorPaths,
  findRowIndex,
  ROOT_PATH,
} from '../components/Tree/treeRows'
import {
  initialExpansion,
  isExpanded,
  setExpanded,
  setExpansionMode,
} from '../utils/expansion'

const expandAll = setExpansionMode('all')
const collapseAll = setExpansionMode('none')

/** Rows as `kind path` lines — the shape virtualisation actually depends on. */
function outline(rows: readonly TreeRow[]): string[] {
  return rows.map((row) => `${row.kind} ${row.path}`)
}

describe('flattenTree: roots', () => {
  it('flattens a root object', () => {
    const rows = flattenTree({ a: 1, b: 2 }, expandAll)
    expect(outline(rows)).toEqual([
      'branch $',
      'leaf $.a',
      'leaf $.b',
      'branch-end $',
    ])
    expect(rows[0].depth).toBe(0)
    expect(rows[0].nodeKey).toBeNull()
    expect(rows[0].isArray).toBe(false)
    expect(rows[0].count).toBe(2)
  })

  it('flattens a root array', () => {
    const rows = flattenTree(['x', 'y'], expandAll)
    expect(outline(rows)).toEqual([
      'branch $',
      'leaf $[0]',
      'leaf $[1]',
      'branch-end $',
    ])
    expect(rows[0].isArray).toBe(true)
    // Array elements are positional, so they carry no key.
    expect(rows[1].nodeKey).toBeNull()
  })

  it('flattens a scalar root as a single leaf', () => {
    const rows = flattenTree(42, expandAll)
    expect(rows).toHaveLength(1)
    expect(rows[0].kind).toBe('leaf')
    expect(rows[0].path).toBe(ROOT_PATH)
    expect(rows[0].depth).toBe(0)
    expect(rows[0].data).toBe(42)
    expect(rows[0].segments).toEqual([])
  })

  it('flattens a null root as a leaf, not an empty container', () => {
    const rows = flattenTree(null, expandAll)
    expect(outline(rows)).toEqual(['leaf $'])
  })

  it('keeps scalar kinds as leaves whatever their type', () => {
    const rows = flattenTree({ s: 'text', n: 0, b: false, z: null }, expandAll)
    expect(outline(rows)).toEqual([
      'branch $',
      'leaf $.s',
      'leaf $.n',
      'leaf $.b',
      'leaf $.z',
      'branch-end $',
    ])
  })
})

describe('flattenTree: empty containers', () => {
  it('renders an empty object as one row with no closing bracket', () => {
    const rows = flattenTree({}, expandAll)
    expect(rows).toHaveLength(1)
    expect(rows[0].kind).toBe('empty')
    expect(rows[0].isArray).toBe(false)
    expect(rows[0].count).toBe(0)
  })

  it('renders an empty array as one row with no closing bracket', () => {
    const rows = flattenTree([], expandAll)
    expect(rows).toHaveLength(1)
    expect(rows[0].kind).toBe('empty')
    expect(rows[0].isArray).toBe(true)
  })

  it('renders empty children inline', () => {
    const rows = flattenTree({ a: {}, b: [] }, expandAll)
    expect(outline(rows)).toEqual([
      'branch $',
      'empty $.a',
      'empty $.b',
      'branch-end $',
    ])
  })
})

describe('flattenTree: expansion', () => {
  it('emits children and a closing row only while open', () => {
    const data = { a: { b: 1 } }
    expect(outline(flattenTree(data, expandAll))).toEqual([
      'branch $',
      'branch $.a',
      'leaf $.a.b',
      'branch-end $.a',
      'branch-end $',
    ])

    const closed = setExpanded(expandAll, '$.a', false)
    expect(outline(flattenTree(data, closed))).toEqual([
      'branch $',
      'branch $.a',
      'branch-end $',
    ])
  })

  it('drops the whole subtree when the root is collapsed', () => {
    const rows = flattenTree({ a: { b: 1 } }, collapseAll)
    expect(outline(rows)).toEqual(['branch $'])
    expect(rows[0].expanded).toBe(false)
    // The badge needs the child count even though nothing below is listed.
    expect(rows[0].count).toBe(1)
  })

  it('marks expanded on branches and closing rows only', () => {
    const rows = flattenTree({ a: { b: 1 }, c: 2 }, expandAll)
    for (const row of rows) {
      const expected = row.kind === 'branch' || row.kind === 'branch-end'
      expect(row.expanded).toBe(expected)
    }
  })

  it('reports a child count on branches and zero everywhere else', () => {
    const rows = flattenTree({ a: [1, 2, 3], b: {}, c: 1 }, expandAll)
    const byPath = new Map(rows.map((row) => [`${row.kind} ${row.path}`, row.count]))
    expect(byPath.get('branch $.a')).toBe(3)
    expect(byPath.get('branch-end $.a')).toBe(0)
    expect(byPath.get('empty $.b')).toBe(0)
    expect(byPath.get('leaf $.c')).toBe(0)
  })

  // Depth defaults matter most on first render, before the user has touched
  // anything: two levels open, the third folded.
  it('follows the auto-expand depth by default', () => {
    const data = { a: { b: { c: { d: 1 } } } }
    expect(outline(flattenTree(data, initialExpansion()))).toEqual([
      'branch $',
      'branch $.a',
      'branch $.a.b',
      'branch-end $.a',
      'branch-end $',
    ])
  })

  it('lets a per-node override beat the mode', () => {
    const data = { a: { b: 1 }, c: { d: 2 } }
    const state = setExpanded(collapseAll, '$', true)
    expect(outline(flattenTree(data, state))).toEqual([
      'branch $',
      'branch $.a',
      'branch $.c',
      'branch-end $',
    ])
  })

  it('lets search expansion beat both mode and override', () => {
    const data = { a: { b: { c: 1 } } }
    const state = setExpanded(collapseAll, '$.a', false)
    const rows = flattenTree(data, state, new Set(['$', '$.a', '$.a.b']))
    expect(outline(rows)).toEqual([
      'branch $',
      'branch $.a',
      'branch $.a.b',
      'leaf $.a.b.c',
      'branch-end $.a.b',
      'branch-end $.a',
      'branch-end $',
    ])
  })

  it('stops at the deepest searched node', () => {
    const data = { a: { b: { c: 1 } } }
    const rows = flattenTree(data, collapseAll, new Set(['$', '$.a']))
    expect(outline(rows)).toEqual([
      'branch $',
      'branch $.a',
      'branch $.a.b',
      'branch-end $.a',
      'branch-end $',
    ])
  })
})

describe('flattenTree: ordering', () => {
  // Virtualisation maps a scroll offset straight onto an index, so a row in the
  // wrong place is a row rendered in the wrong place.
  it('emits a nested document in render order', () => {
    const data = { a: { b: [1, { c: 2 }] }, d: 5 }
    const rows = flattenTree(data, expandAll)
    expect(outline(rows)).toEqual([
      'branch $',
      'branch $.a',
      'branch $.a.b',
      'leaf $.a.b[0]',
      'branch $.a.b[1]',
      'leaf $.a.b[1].c',
      'branch-end $.a.b[1]',
      'branch-end $.a.b',
      'branch-end $.a',
      'leaf $.d',
      'branch-end $',
    ])
    expect(rows.map((row) => row.depth)).toEqual([0, 1, 2, 3, 3, 4, 3, 2, 1, 1, 0])
  })

  it('preserves object key insertion order', () => {
    const rows = flattenTree({ z: 1, a: 2, m: 3 }, expandAll)
    expect(rows.slice(1, 4).map((row) => row.nodeKey)).toEqual(['z', 'a', 'm'])
  })

  it('gives a closing row the depth of the branch it closes', () => {
    const rows = flattenTree({ a: { b: 1 } }, expandAll)
    const end = rows.find((row) => row.kind === 'branch-end' && row.path === '$.a')
    expect(end?.depth).toBe(1)
  })

  it('gives every row a unique key', () => {
    const rows = flattenTree({ a: { b: [1, 2] }, c: {} }, expandAll)
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length)
  })
})

describe('flattenTree: paths and segments', () => {
  it('builds paths and segments the way the tree does', () => {
    const rows = flattenTree({ a: [{ b: 1 }] }, expandAll)
    const leaf = rows.find((row) => row.kind === 'leaf')
    expect(leaf?.path).toBe('$.a[0].b')
    expect(leaf?.segments).toEqual(['a', 0, 'b'])
    expect(leaf?.nodeKey).toBe('b')
  })

  it('uses numeric segments for array indices only', () => {
    const rows = flattenTree({ '0': [9] }, expandAll)
    const leaf = rows.find((row) => row.kind === 'leaf')
    // The object key stays a string even though it reads as a number, which is
    // what keeps `setAtPath` writing to the object rather than to an array.
    expect(leaf?.segments).toEqual(['0', 0])
    expect(leaf?.path).toBe('$.0[0]')
  })

  it('keeps segments addressing the node they belong to', () => {
    const data = { a: { b: { c: 1 } } }
    for (const row of flattenTree(data, expandAll)) {
      expect(row.segments.length).toBe(row.depth)
    }
  })
})

describe('ancestorPaths', () => {
  it('returns nothing for the root', () => {
    expect(ancestorPaths(ROOT_PATH)).toEqual([])
  })

  it('walks a mixed object and array path from the root down', () => {
    expect(ancestorPaths('$.a[0].b')).toEqual(['$', '$.a', '$.a[0]'])
  })

  it('excludes the path itself', () => {
    expect(ancestorPaths('$.a')).toEqual(['$'])
  })
})

describe('expandAncestors', () => {
  it('opens every ancestor of a deep path', () => {
    const state = expandAncestors(collapseAll, '$.a[0].b.c')
    expect(isExpanded(state, '$', 0)).toBe(true)
    expect(isExpanded(state, '$.a', 1)).toBe(true)
    expect(isExpanded(state, '$.a[0]', 2)).toBe(true)
    expect(isExpanded(state, '$.a[0].b', 3)).toBe(true)
    // The node itself is the destination, not a container that must open.
    expect(isExpanded(state, '$.a[0].b.c', 4)).toBe(false)
  })

  it('makes a deep node reachable in the flattened rows', () => {
    const data = { a: { b: { c: { d: 1 } } } }
    const state = expandAncestors(collapseAll, '$.a.b.c.d')
    expect(outline(flattenTree(data, state))).toEqual([
      'branch $',
      'branch $.a',
      'branch $.a.b',
      'branch $.a.b.c',
      'leaf $.a.b.c.d',
      'branch-end $.a.b.c',
      'branch-end $.a.b',
      'branch-end $.a',
      'branch-end $',
    ])
  })

  it('leaves the given state untouched', () => {
    const state = collapseAll
    expandAncestors(state, '$.a.b')
    expect(state.overrides.size).toBe(0)
  })

  it('is a no-op for the root path', () => {
    const state = expandAncestors(collapseAll, ROOT_PATH)
    expect(state.overrides.size).toBe(0)
  })
})

describe('findRowIndex', () => {
  const rows = flattenTree({ a: { b: 1 }, c: 2 }, expandAll)

  it('finds a leaf', () => {
    expect(rows[findRowIndex(rows, '$.c')].kind).toBe('leaf')
  })

  it('returns the opening row of a branch, never its closing bracket', () => {
    const index = findRowIndex(rows, '$.a')
    expect(rows[index].kind).toBe('branch')
  })

  it('returns -1 for a path that is not visible', () => {
    expect(findRowIndex(rows, '$.missing')).toBe(-1)
  })
})

describe('flattenTree: large and deep documents', () => {
  it('flattens a 50k-element array quickly', () => {
    const data = Array.from({ length: 50_000 }, (_, i) => i)
    const started = performance.now()
    const rows = flattenTree(data, expandAll)
    const elapsed = performance.now() - started

    expect(rows).toHaveLength(50_002) // branch + 50k leaves + closing row
    expect(rows[1].path).toBe('$[0]')
    expect(rows[50_000].path).toBe('$[49999]')
    expect(rows[50_001].kind).toBe('branch-end')
    expect(elapsed).toBeLessThan(2000)
  })

  it('lists nothing but the root when a huge array is collapsed', () => {
    const data = Array.from({ length: 50_000 }, (_, i) => i)
    const rows = flattenTree(data, collapseAll)
    expect(rows).toHaveLength(1)
    expect(rows[0].count).toBe(50_000)
  })

  // Nesting depth is user input, so recursion would be a crash waiting to
  // happen on a pathological document.
  it('flattens 10k levels of nesting without overflowing the stack', () => {
    let data: unknown = 1
    for (let i = 0; i < 10_000; i++) data = { child: data }

    const rows = flattenTree(data, expandAll)
    expect(rows).toHaveLength(20_001) // 10k branches + leaf + 10k closing rows
    expect(rows[10_000].kind).toBe('leaf')
    expect(rows[10_000].depth).toBe(10_000)
  })
})
