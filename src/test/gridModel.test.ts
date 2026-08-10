import { describe, it, expect } from 'vitest'
import {
  initialExpansion,
  isExpanded,
  setExpanded,
  setExpansionMode,
  shouldRenderAsTable,
  isPlainObject,
  compareValues,
  sortedRowIndices,
  nextSortState,
  toggleColumn,
  emptyTableView,
  childPath,
  pathToBreadcrumb,
  AUTO_EXPAND_DEPTH,
} from '../components/Grid/gridModel'

describe('expansion state', () => {
  it('auto mode expands down to the auto depth only', () => {
    const state = initialExpansion()
    expect(isExpanded(state, '$.a', AUTO_EXPAND_DEPTH - 1)).toBe(true)
    expect(isExpanded(state, '$.a', AUTO_EXPAND_DEPTH)).toBe(false)
  })

  it('an explicit toggle beats the depth default in both directions', () => {
    const collapsed = setExpanded(initialExpansion(), '$.a', false)
    expect(isExpanded(collapsed, '$.a', 0)).toBe(false)

    const expanded = setExpanded(initialExpansion(), '$.deep', true)
    expect(isExpanded(expanded, '$.deep', 9)).toBe(true)
  })

  it('does not mutate the state it was given', () => {
    const state = initialExpansion()
    setExpanded(state, '$.a', false)
    expect(state.overrides.size).toBe(0)
  })

  // Collapse All has to drop overrides, otherwise a node the user expanded
  // earlier would stay open and the button would look broken.
  it('switching mode clears per-node overrides', () => {
    const withOverride = setExpanded(initialExpansion(), '$.a', true)
    const collapsed = setExpansionMode('none')
    expect(withOverride.overrides.size).toBe(1)
    expect(collapsed.overrides.size).toBe(0)
    expect(isExpanded(collapsed, '$.a', 0)).toBe(false)
    expect(isExpanded(setExpansionMode('all'), '$.a', 99)).toBe(true)
  })

  it('a search hit expands its ancestors regardless of mode or override', () => {
    const collapsed = setExpanded(setExpansionMode('none'), '$.a', false)
    expect(isExpanded(collapsed, '$.a', 0, new Set(['$.a']))).toBe(true)
  })
})

describe('shouldRenderAsTable', () => {
  it('accepts an array of plain objects', () => {
    expect(shouldRenderAsTable([{ a: 1 }, { a: 2 }])).toBe(true)
  })

  it('tolerates a minority of non-objects', () => {
    // 9 objects out of 10 clears the 80% bar — one stray null used to demote
    // the whole array to an indented list.
    const rows = [...Array(9).fill({ a: 1 }), null]
    expect(shouldRenderAsTable(rows)).toBe(true)
  })

  it('rejects an array that is mostly scalars', () => {
    expect(shouldRenderAsTable([{ a: 1 }, 2, 3, 4, 5])).toBe(false)
  })

  it('rejects arrays of arrays and empty arrays', () => {
    expect(shouldRenderAsTable([[1], [2]])).toBe(false)
    expect(shouldRenderAsTable([])).toBe(false)
  })

  it('does not count arrays as plain objects', () => {
    expect(isPlainObject([])).toBe(false)
    expect(isPlainObject(null)).toBe(false)
    expect(isPlainObject({})).toBe(true)
  })
})

describe('compareValues', () => {
  it('orders numbers numerically', () => {
    expect(compareValues(2, 10)).toBeLessThan(0)
  })

  it('orders strings naturally, so item2 precedes item10', () => {
    expect(compareValues('item2', 'item10')).toBeLessThan(0)
  })

  it('orders booleans false before true', () => {
    expect(compareValues(false, true)).toBeLessThan(0)
  })

  it('keeps mixed types deterministic by type rank', () => {
    // Ordering across types is arbitrary but must be stable and antisymmetric.
    expect(compareValues(1, 'a')).toBeLessThan(0)
    expect(compareValues('a', 1)).toBeGreaterThan(0)
    expect(compareValues({ a: 1 }, [1])).toBeLessThan(0)
  })
})

describe('sortedRowIndices', () => {
  const rows = [{ n: 3 }, { n: 1 }, { n: 2 }]

  it('returns document order when nothing is sorted', () => {
    expect(sortedRowIndices(rows, emptyTableView)).toEqual([0, 1, 2])
  })

  it('sorts ascending and descending by the chosen column', () => {
    expect(sortedRowIndices(rows, { sortKey: 'n', sortDir: 'asc', hidden: [] })).toEqual([1, 2, 0])
    expect(sortedRowIndices(rows, { sortKey: 'n', sortDir: 'desc', hidden: [] })).toEqual([0, 2, 1])
  })

  // Flipping to descending to surface the blanks is never what anyone means.
  it('sinks missing and null values to the bottom in both directions', () => {
    const sparse = [{ n: 1 }, {}, { n: null }, { n: 2 }]
    expect(sortedRowIndices(sparse, { sortKey: 'n', sortDir: 'asc', hidden: [] }).slice(0, 2)).toEqual([0, 3])
    expect(sortedRowIndices(sparse, { sortKey: 'n', sortDir: 'desc', hidden: [] }).slice(0, 2)).toEqual([3, 0])
  })

  it('sinks non-object rows of a mixed array to the bottom', () => {
    const mixed = [null, { n: 1 }]
    expect(sortedRowIndices(mixed, { sortKey: 'n', sortDir: 'asc', hidden: [] })).toEqual([1, 0])
  })

  it('returns indices, not rows, so the # column can keep document positions', () => {
    const result = sortedRowIndices(rows, { sortKey: 'n', sortDir: 'asc', hidden: [] })
    expect(result.map((i) => rows[i].n)).toEqual([1, 2, 3])
  })
})

describe('nextSortState', () => {
  it('cycles a column through ascending, descending, then off', () => {
    const asc = nextSortState(emptyTableView, 'name')
    expect(asc).toMatchObject({ sortKey: 'name', sortDir: 'asc' })

    const desc = nextSortState(asc, 'name')
    expect(desc).toMatchObject({ sortKey: 'name', sortDir: 'desc' })

    const off = nextSortState(desc, 'name')
    expect(off.sortKey).toBeNull()
  })

  it('switching column starts over at ascending', () => {
    const desc = { sortKey: 'a', sortDir: 'desc' as const, hidden: [] }
    expect(nextSortState(desc, 'b')).toMatchObject({ sortKey: 'b', sortDir: 'asc' })
  })
})

describe('toggleColumn', () => {
  it('hides and shows a column', () => {
    const hidden = toggleColumn(emptyTableView, 'a')
    expect(hidden.hidden).toEqual(['a'])
    expect(toggleColumn(hidden, 'a').hidden).toEqual([])
  })

  // A sort applied by an invisible column cannot be seen or cleared.
  it('drops the sort when the sorted column is hidden', () => {
    const sorted = { sortKey: 'a', sortDir: 'asc' as const, hidden: [] }
    expect(toggleColumn(sorted, 'a').sortKey).toBeNull()
  })

  it('keeps the sort when a different column is hidden', () => {
    const sorted = { sortKey: 'a', sortDir: 'asc' as const, hidden: [] }
    expect(toggleColumn(sorted, 'b').sortKey).toBe('a')
  })
})

describe('paths', () => {
  it('builds array and object child paths the way treeSearch does', () => {
    expect(childPath('$', '0', true)).toBe('$[0]')
    expect(childPath('$', 'name', false)).toBe('$.name')
    expect(childPath('$.items', '2', true)).toBe('$.items[2]')
  })

  it('renders a readable breadcrumb', () => {
    expect(pathToBreadcrumb('$')).toBe('root')
    expect(pathToBreadcrumb('$.items[2].name')).toBe('items[2].name')
  })
})
