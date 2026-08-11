// ─────────────────────────────────────────────
//  Flattening the JSON tree into a row list
//
//  Virtualisation needs to answer "the viewport starts at row 4231 — what is
//  there?" without rendering anything above it. Nested components cannot answer
//  that, so the visible tree is reduced to a flat array first: every row the
//  user would see, in the order they would see it, indentation carried as a
//  number instead of as nesting.
//
//  The shape mirrors what TreeView renders today, closing brackets included, so
//  swapping the renderer over does not change a single line of output.
// ─────────────────────────────────────────────

import type { PathSegment } from '../../utils/jsonEdit'
import type { ExpansionState } from '../../utils/expansion'
import { isExpanded, setExpanded } from '../../utils/expansion'

/** Path of the document root. Every other path is built by appending to it. */
export const ROOT_PATH = '$'

/**
 * - `branch`      an object or array with children; renders `key: {`
 * - `branch-end`  the closing `}` / `]` of an open branch, on its own row
 * - `leaf`        a scalar, or anything that is not a container
 * - `empty`       an object or array with no children; renders as `{}` / `[]`
 *                 on a single row, the way the tree draws it today
 */
export type TreeRowKind = 'branch' | 'branch-end' | 'leaf' | 'empty'

export interface TreeRow {
  /** Stable React key; a path is unique within a document. */
  key: string
  /** Display path such as `$`, `$.a`, `$.a[0]` — matches diff and search keys. */
  path: string
  /** Unambiguous address for edits, unlike `path` when a key contains `.`. */
  segments: PathSegment[]
  /** Indentation level; the root is 0. */
  depth: number
  /** `null` for array elements, which are positional and have no key. */
  nodeKey: string | null
  data: unknown
  kind: TreeRowKind
  isArray: boolean
  /** Child count, for the collapsed badge. Zero on every non-branch row. */
  count: number
  /** Whether a branch is open. Always true on `branch-end`, false elsewhere. */
  expanded: boolean
}

/**
 * A closing bracket shares its branch's path, so it needs a distinct React key.
 * Prefixing makes a collision impossible where a suffix could not: every path
 * starts with `$`, so no real row key can ever begin with this.
 */
const END_KEY_PREFIX = ']'

interface Frame {
  /** `visit` emits the node itself; `close` emits its closing bracket. */
  type: 'visit' | 'close'
  nodeKey: string | null
  data: unknown
  path: string
  segments: PathSegment[]
  depth: number
}

/**
 * Reduces the visible tree to the rows a renderer would draw, top to bottom.
 * Collapsed branches contribute one row and nothing below them, so the cost
 * tracks how much of the document is open — not how large it is.
 *
 * Unlike the current renderer there is no chunked "show more" cut-off: every
 * visible child is listed, because virtualisation is what keeps a 50k-element
 * array cheap now.
 */
export function flattenTree(
  data: unknown,
  expansion: ExpansionState,
  searchExpandPaths?: Set<string> | null
): TreeRow[] {
  const rows: TreeRow[] = []
  // An explicit stack rather than recursion: deeply nested documents are user
  // input, and a blown call stack would take the whole tab down.
  const stack: Frame[] = [
    { type: 'visit', nodeKey: null, data, path: ROOT_PATH, segments: [], depth: 0 },
  ]

  while (stack.length > 0) {
    const frame = stack.pop() as Frame
    const { nodeKey, data: value, path, segments, depth } = frame

    if (frame.type === 'close') {
      rows.push({
        key: END_KEY_PREFIX + path,
        path,
        segments,
        depth,
        nodeKey,
        data: value,
        kind: 'branch-end',
        isArray: Array.isArray(value),
        count: 0,
        expanded: true,
      })
      continue
    }

    // Functions and every primitive land here; only real containers descend.
    if (value === null || typeof value !== 'object') {
      rows.push({
        key: path,
        path,
        segments,
        depth,
        nodeKey,
        data: value,
        kind: 'leaf',
        isArray: false,
        count: 0,
        expanded: false,
      })
      continue
    }

    const isArray = Array.isArray(value)
    // Kept as `null` for arrays so index access stays direct on huge arrays.
    const childKeys = isArray ? null : Object.keys(value as Record<string, unknown>)
    const count = childKeys === null ? (value as unknown[]).length : childKeys.length

    if (count === 0) {
      rows.push({
        key: path,
        path,
        segments,
        depth,
        nodeKey,
        data: value,
        kind: 'empty',
        isArray,
        count: 0,
        expanded: false,
      })
      continue
    }

    const open = isExpanded(expansion, path, depth, searchExpandPaths)
    rows.push({
      key: path,
      path,
      segments,
      depth,
      nodeKey,
      data: value,
      kind: 'branch',
      isArray,
      count,
      expanded: open,
    })
    if (!open) continue

    // Pushed first so it pops last, after every child has been emitted.
    stack.push({ type: 'close', nodeKey, data: value, path, segments, depth })

    // Reversed, because a stack pops in the opposite order to the pushes.
    if (childKeys === null) {
      const arr = value as unknown[]
      for (let i = count - 1; i >= 0; i--) {
        stack.push({
          type: 'visit',
          nodeKey: null,
          data: arr[i],
          path: `${path}[${i}]`,
          segments: [...segments, i],
          depth: depth + 1,
        })
      }
    } else {
      const obj = value as Record<string, unknown>
      for (let i = count - 1; i >= 0; i--) {
        const key = childKeys[i]
        stack.push({
          type: 'visit',
          nodeKey: key,
          data: obj[key],
          path: `${path}.${key}`,
          segments: [...segments, key],
          depth: depth + 1,
        })
      }
    }
  }

  return rows
}

/**
 * Every path between the root and `path`, root first, excluding `path` itself.
 *
 * Split on the same `.` and `[` boundaries the tree uses to build paths, so a
 * key containing those characters can produce a phantom ancestor. That only
 * ever expands a node that did not need expanding, which is why paths are still
 * fine here while edits address nodes by segments instead.
 */
/**
 * Builds the path a set of segments addresses, in the same shape `flattenTree`
 * produces — the two must agree or expansion lookups silently miss.
 */
export function pathFromSegments(segments: readonly PathSegment[]): string {
  let path: string = ROOT_PATH
  for (const segment of segments) {
    path += typeof segment === 'number' ? `[${segment}]` : `.${segment}`
  }
  return path
}

export function ancestorPaths(path: string): string[] {
  const out: string[] = []
  for (let i = 1; i < path.length; i++) {
    const char = path[i]
    if (char === '.' || char === '[') out.push(path.slice(0, i))
  }
  return out
}

/**
 * Opens every ancestor of `path` so the node at it is on screen.
 *
 * Centralises what per-node effects do today: a freshly added entry, an active
 * diff, or a search hit is only reachable if nothing above it is collapsed, and
 * in a flat model there is no component at each level left to notice.
 */
export function expandAncestors(state: ExpansionState, path: string): ExpansionState {
  let next = state
  for (const ancestor of ancestorPaths(path)) {
    next = setExpanded(next, ancestor, true)
  }
  return next
}

/**
 * Index of the row for `path`, or -1. Closing brackets are skipped so scrolling
 * to a match lands on the row that carries the key, not on its `}`.
 */
export function findRowIndex(rows: readonly TreeRow[], path: string): number {
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].path === path && rows[i].kind !== 'branch-end') return i
  }
  return -1
}
