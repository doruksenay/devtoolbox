// ─────────────────────────────────────────────
//  Grid view state and table shaping
//
//  Kept separate from the components so the parts with real logic — what counts
//  as a table, what order rows sort in, what is expanded — can be tested
//  without rendering anything.
// ─────────────────────────────────────────────

// The expansion model moved to `src/utils/expansion.ts` once the tree needed it
// too. Re-exported here so grid code keeps importing it from one place.
export {
  initialExpansion,
  isExpanded,
  setExpanded,
  setExpansionMode,
  AUTO_EXPAND_DEPTH,
} from '../../utils/expansion'
export type { ExpansionMode, ExpansionState } from '../../utils/expansion'

// ── Table detection ───────────────────────────

/**
 * Fraction of elements that must be plain objects for an array to render as a
 * table. Requiring *every* element meant a single `null` in a thousand-item API
 * response silently downgraded the whole array to an indented list.
 */
export const TABLE_OBJECT_RATIO = 0.8

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function shouldRenderAsTable(arr: readonly unknown[]): boolean {
  if (arr.length === 0) return false
  const objectCount = arr.reduce<number>((n, item) => (isPlainObject(item) ? n + 1 : n), 0)
  return objectCount / arr.length >= TABLE_OBJECT_RATIO
}

// ── Sorting ───────────────────────────────────

export type SortDirection = 'asc' | 'desc'

export interface TableView {
  sortKey: string | null
  sortDir: SortDirection
  /** Columns the user hid. Stored as a list to keep this state easy to clone. */
  hidden: string[]
}

export const emptyTableView: TableView = { sortKey: null, sortDir: 'asc', hidden: [] }

/**
 * Type rank so a column holding mixed types still sorts deterministically
 * instead of depending on comparison order.
 */
function typeRank(value: unknown): number {
  if (typeof value === 'number') return 0
  if (typeof value === 'string') return 1
  if (typeof value === 'boolean') return 2
  if (Array.isArray(value)) return 4
  return 3
}

export function compareValues(a: unknown, b: unknown): number {
  const rankA = typeRank(a)
  const rankB = typeRank(b)
  if (rankA !== rankB) return rankA - rankB

  if (typeof a === 'number' && typeof b === 'number') {
    // NaN would poison the comparison; treat it as equal to itself and largest.
    if (Number.isNaN(a) && Number.isNaN(b)) return 0
    if (Number.isNaN(a)) return 1
    if (Number.isNaN(b)) return -1
    return a - b
  }
  if (typeof a === 'string' && typeof b === 'string') {
    // Numeric collation so "item2" sorts before "item10", which is what people
    // expect of id-like columns.
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  }
  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return a === b ? 0 : a ? 1 : -1
  }
  return JSON.stringify(a).localeCompare(JSON.stringify(b))
}

/**
 * Returns the original indices of `rows` in display order. Indices rather than
 * rows, so the `#` column can keep showing where a row sits in the underlying
 * document after a sort.
 *
 * Rows missing the sort column — including non-object elements of a mixed
 * array — always sink to the bottom, in both directions. Sorting descending to
 * dig up the empties is never what anyone means.
 */
export function sortedRowIndices(
  rows: readonly unknown[],
  view: TableView
): number[] {
  const indices = rows.map((_, i) => i)
  const key = view.sortKey
  if (key === null) return indices

  return indices.sort((ia, ib) => {
    const rowA = rows[ia]
    const rowB = rows[ib]
    const a = isPlainObject(rowA) ? rowA[key] : undefined
    const b = isPlainObject(rowB) ? rowB[key] : undefined

    const aEmpty = a === undefined || a === null
    const bEmpty = b === undefined || b === null
    if (aEmpty && bEmpty) return 0
    if (aEmpty) return 1
    if (bEmpty) return -1

    const base = compareValues(a, b)
    return view.sortDir === 'asc' ? base : -base
  })
}

/** Cycles a column through ascending → descending → unsorted. */
export function nextSortState(view: TableView, column: string): TableView {
  if (view.sortKey !== column) return { ...view, sortKey: column, sortDir: 'asc' }
  if (view.sortDir === 'asc') return { ...view, sortKey: column, sortDir: 'desc' }
  return { ...view, sortKey: null, sortDir: 'asc' }
}

export function toggleColumn(view: TableView, column: string): TableView {
  const hidden = view.hidden.includes(column)
    ? view.hidden.filter((c) => c !== column)
    : [...view.hidden, column]
  // A hidden column cannot stay the sort key — the user would have no way to
  // see or clear the sort it is applying.
  const sortKey = hidden.includes(column) && view.sortKey === column ? null : view.sortKey
  return { ...view, hidden, sortKey }
}

// ── Paths ─────────────────────────────────────

/**
 * Path strings use the same shape as `utils/treeSearch`, so the grid can reuse
 * its match and auto-expand sets directly. They are display/lookup keys only —
 * edits are addressed by segment arrays, which are unambiguous for keys that
 * contain `.` or `[`.
 */
export function childPath(path: string, key: string, isArrayIndex: boolean): string {
  return isArrayIndex ? `${path}[${key}]` : `${path}.${key}`
}

/** Human-readable breadcrumb for the currently focused node. */
export function pathToBreadcrumb(path: string): string {
  return path === '$' ? 'root' : path.replace(/^\$\.?/, '')
}
