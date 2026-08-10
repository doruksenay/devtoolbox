import { useState } from 'react'
import type { PathSegment } from '../../utils/jsonEdit'
import { parseEditedValue, valueToEditText } from '../../utils/jsonEdit'
import { splitHighlight } from '../../utils/treeSearch'
import { deriveColumns } from '../../utils/csv'
import type { ExpansionState, TableView } from './gridModel'
import {
  isExpanded,
  isPlainObject,
  shouldRenderAsTable,
  sortedRowIndices,
  nextSortState,
  toggleColumn,
  emptyTableView,
  childPath,
} from './gridModel'

/** Rows past this many are hidden behind "Show more", as the tree view does. */
const CHUNK_SIZE = 100

export interface GridSearch {
  query: string
  matchPaths: Set<string>
  expandPaths: Set<string>
}

export interface GridEdit {
  setValue: (segments: PathSegment[], value: unknown) => void
  remove: (segments: PathSegment[]) => void
}

/**
 * Everything a node needs that is owned by GridTab. Bundled into one object
 * because threading a dozen callbacks through a recursive renderer by hand
 * makes every signature change a rewrite.
 */
export interface GridContext {
  expansion: ExpansionState
  setExpanded: (path: string, open: boolean) => void
  search: GridSearch | null
  views: Map<string, TableView>
  setView: (path: string, view: TableView) => void
  edit: GridEdit | null
  onCopy: (value: unknown) => void
  onCopyPath: (path: string) => void
  /** Selects the node in the raw JSON on the left and updates the breadcrumb. */
  onFocus: (path: string, segments: PathSegment[]) => void
  focusedPath: string | null
  onExportCsv: (rows: Record<string, unknown>[], columns: string[], path: string) => void
}

interface NodeProps {
  ctx: GridContext
  nodeKey: string | null
  data: unknown
  depth: number
  path: string
  segments: PathSegment[]
}

function Highlight({ text, query }: { text: string; query?: string }) {
  if (!query) return <>{text}</>
  const parts = splitHighlight(text, query)
  if (parts.length === 1 && !parts[0].match) return <>{text}</>
  return (
    <>
      {parts.map((part, i) =>
        part.match ? <mark key={i} className="tree-search__mark">{part.text}</mark> : <span key={i}>{part.text}</span>
      )}
    </>
  )
}

function primitiveClass(val: unknown): string {
  if (val === null) return 'jtg-null'
  if (typeof val === 'boolean') return 'jtg-bool'
  if (typeof val === 'number') return 'jtg-number'
  return 'jtg-string'
}

function primitiveText(val: unknown): string {
  if (val === null) return 'null'
  if (typeof val === 'string') return `"${val}"`
  return String(val)
}

/**
 * A scalar, editable in place when the grid is editable. Strings are edited as
 * plain text and everything else as a JSON literal — the same contract the tree
 * view uses, so the two tools do not disagree about what typing `42` means.
 */
function ScalarValue({
  ctx,
  val,
  segments,
}: {
  ctx: GridContext
  val: unknown
  segments: PathSegment[]
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const [rejected, setRejected] = useState(false)
  const text = primitiveText(val)

  function commit(next: string): boolean {
    const parsed = parseEditedValue(val, next)
    if (!parsed.ok) return false
    if (!Object.is(parsed.value, val)) ctx.edit?.setValue(segments, parsed.value)
    return true
  }

  if (draft !== null) {
    return (
      <input
        className={`tree-edit-input${rejected ? ' tree-edit-input--invalid' : ''}`}
        value={draft}
        autoFocus
        spellCheck={false}
        size={Math.max(draft.length, 1)}
        aria-label="Edit value"
        title={
          typeof val === 'string'
            ? 'Edited as plain text'
            : 'Enter a JSON literal, e.g. 42, true, null, "text"'
        }
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          setDraft(e.target.value)
          setRejected(false)
        }}
        onBlur={() => {
          // Clicking away cannot be corrected, so an unparseable draft is
          // dropped rather than trapping focus in the cell.
          commit(draft)
          setDraft(null)
          setRejected(false)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            if (commit(draft)) {
              setDraft(null)
              setRejected(false)
            } else {
              setRejected(true)
            }
          } else if (e.key === 'Escape') {
            e.preventDefault()
            setDraft(null)
            setRejected(false)
          }
        }}
      />
    )
  }

  if (!ctx.edit) {
    return (
      <span className={primitiveClass(val)} title={text}>
        <Highlight text={text} query={ctx.search?.query} />
      </span>
    )
  }

  return (
    <button
      type="button"
      className={`tree-edit-target ${primitiveClass(val)}`}
      title={text}
      onClick={() => setDraft(valueToEditText(val))}
    >
      <Highlight text={text} query={ctx.search?.query} />
    </button>
  )
}

/** Hover actions shared by every row and cell. */
function NodeActions({
  ctx,
  value,
  path,
  segments,
  removable,
}: {
  ctx: GridContext
  value: unknown
  path: string
  segments: PathSegment[]
  removable: boolean
}) {
  return (
    <span className="jtg-actions">
      <button type="button" className="jtg-action" title="Copy value" aria-label="Copy value" onClick={() => ctx.onCopy(value)}>⧉</button>
      <button type="button" className="jtg-action" title="Copy path" aria-label="Copy path" onClick={() => ctx.onCopyPath(path)}>⌗</button>
      {ctx.edit && removable && (
        <button
          type="button"
          className="jtg-action jtg-action--danger"
          title="Remove"
          aria-label="Remove"
          onClick={() => ctx.edit?.remove(segments)}
        >✕</button>
      )}
    </span>
  )
}

/** A cell holding an object or array: a drill-in toggle plus a size badge. */
function NestedCell({ ctx, val, depth, path, segments }: { ctx: GridContext; val: unknown; depth: number; path: string; segments: PathSegment[] }) {
  const [open, setOpen] = useState(false)
  const isArr = Array.isArray(val)
  const size = isArr ? (val as unknown[]).length : Object.keys(val as object).length

  if (size === 0) return <span className="jtg-type-tag">{isArr ? '[ ]' : '{ }'}</span>

  return (
    <div className="jtg-cell-nested">
      <div className="jtg-cell-nested__head">
        <button
          className="jtg-toggle"
          onClick={() => setOpen((o) => !o)}
          type="button"
          aria-expanded={open}
          title={open ? 'Collapse' : 'Expand'}
        >
          {open ? '−' : '+'}
        </button>
        <span className="jtg-type-tag">{isArr ? `[${size}]` : `{${size}}`}</span>
      </div>
      {open && (
        <div className="jtg-cell-nested__body">
          <GridNode ctx={ctx} nodeKey={null} data={val} depth={depth + 1} path={path} segments={segments} />
        </div>
      )}
    </div>
  )
}

function CellValue({ ctx, val, depth, path, segments }: { ctx: GridContext; val: unknown; depth: number; path: string; segments: PathSegment[] }) {
  // A key absent from this row is not the same as a null value; showing nothing
  // for both made them indistinguishable in the grid.
  if (val === undefined) return <span className="jtg-absent" title="Key not present in this row">—</span>
  if (val !== null && typeof val === 'object') {
    return <NestedCell ctx={ctx} val={val} depth={depth} path={path} segments={segments} />
  }
  return <ScalarValue ctx={ctx} val={val} segments={segments} />
}

/** Header controls for an array rendered as a table: sorting, columns, export. */
function TableHeader({
  ctx,
  path,
  view,
  columns,
  visibleColumns,
  rows,
}: {
  ctx: GridContext
  path: string
  view: TableView
  columns: string[]
  visibleColumns: string[]
  rows: Record<string, unknown>[]
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="jtg-table-bar">
      <div className="jtg-table-bar__col-menu">
        <button
          type="button"
          className="btn btn-ghost jtg-table-bar__btn"
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
          title="Show or hide columns"
        >
          Columns ({visibleColumns.length}/{columns.length})
        </button>
        {menuOpen && (
          <div className="jtg-col-menu">
            {columns.map((c) => (
              <label key={c} className="jtg-col-menu__item">
                <input
                  type="checkbox"
                  checked={!view.hidden.includes(c)}
                  onChange={() => ctx.setView(path, toggleColumn(view, c))}
                />
                <span>{c}</span>
              </label>
            ))}
            {view.hidden.length > 0 && (
              <button
                type="button"
                className="btn btn-ghost jtg-col-menu__reset"
                onClick={() => ctx.setView(path, { ...view, hidden: [] })}
              >
                Show all
              </button>
            )}
          </div>
        )}
      </div>
      {view.sortKey && (
        <button
          type="button"
          className="btn btn-ghost jtg-table-bar__btn"
          onClick={() => ctx.setView(path, { ...view, sortKey: null })}
          title="Restore document order"
        >
          Sorted by {view.sortKey} {view.sortDir === 'asc' ? '↑' : '↓'} ✕
        </button>
      )}
      <button
        type="button"
        className="btn btn-ghost jtg-table-bar__btn"
        onClick={() => ctx.onExportCsv(rows, visibleColumns, path)}
        title="Export the visible columns of this array as CSV"
      >
        Export CSV
      </button>
    </div>
  )
}

function ArrayTable({ ctx, arr, depth, path, segments }: { ctx: GridContext; arr: unknown[]; depth: number; path: string; segments: PathSegment[] }) {
  const [visibleCount, setVisibleCount] = useState(CHUNK_SIZE)
  const view = ctx.views.get(path) ?? emptyTableView

  const objectItems = arr.filter(isPlainObject)
  const columns = deriveColumns(objectItems)
  const visibleColumns = columns.filter((c) => !view.hidden.includes(c))

  const order = sortedRowIndices(arr, view)
  const shown = order.slice(0, visibleCount)
  const remaining = order.length - shown.length

  // Export what the user is looking at: current sort order, visible columns,
  // and none of the non-object rows a mixed array may contain.
  const exportRows = order.map((i) => arr[i]).filter(isPlainObject)

  return (
    <div className="jtg-children">
      <TableHeader
        ctx={ctx}
        path={path}
        view={view}
        columns={columns}
        visibleColumns={visibleColumns}
        rows={exportRows}
      />
      <div className="jtg-table-scroll">
        <table className="jtg-table">
          <thead>
            <tr>
              <th className="jtg-th jtg-th--index">#</th>
              {visibleColumns.map((c) => {
                const active = view.sortKey === c
                return (
                  <th key={c} className={`jtg-th${active ? ' jtg-th--sorted' : ''}`}>
                    <button
                      type="button"
                      className="jtg-th__sort"
                      onClick={() => ctx.setView(path, nextSortState(view, c))}
                      title={active ? 'Change sort' : `Sort by ${c}`}
                    >
                      <Highlight text={c} query={ctx.search?.query} />
                      <span className="jtg-th__arrow">{active ? (view.sortDir === 'asc' ? '↑' : '↓') : ''}</span>
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {shown.map((rowIndex) => {
              const row = arr[rowIndex]
              const rowPath = childPath(path, String(rowIndex), true)
              const rowSegments = [...segments, rowIndex]
              const focused = ctx.focusedPath === rowPath

              // A mixed array keeps its non-object elements visible instead of
              // dropping them: one stray null should not hide a row.
              if (!isPlainObject(row)) {
                return (
                  <tr key={rowIndex} className={`jtg-tr${focused ? ' jtg-tr--focused' : ''}`}>
                    <td className="jtg-td jtg-td--index">{rowIndex + 1}</td>
                    <td className="jtg-td jtg-td--spanned" colSpan={Math.max(visibleColumns.length, 1)}>
                      <CellValue ctx={ctx} val={row} depth={depth + 1} path={rowPath} segments={rowSegments} />
                      <NodeActions ctx={ctx} value={row} path={rowPath} segments={rowSegments} removable />
                    </td>
                  </tr>
                )
              }

              return (
                <tr key={rowIndex} className={`jtg-tr${focused ? ' jtg-tr--focused' : ''}`}>
                  <td className="jtg-td jtg-td--index">
                    <button
                      type="button"
                      className="jtg-index-btn"
                      title="Reveal this row in the JSON on the left"
                      onClick={() => ctx.onFocus(rowPath, rowSegments)}
                    >
                      {rowIndex + 1}
                    </button>
                  </td>
                  {visibleColumns.map((c) => {
                    const cellPath = childPath(rowPath, c, false)
                    const cellSegments = [...rowSegments, c]
                    return (
                      <td
                        key={c}
                        className={`jtg-td${ctx.focusedPath === cellPath ? ' jtg-td--focused' : ''}${ctx.search?.matchPaths.has(cellPath) ? ' jtg-td--match' : ''}`}
                        onClick={() => ctx.onFocus(cellPath, cellSegments)}
                      >
                        <CellValue ctx={ctx} val={row[c]} depth={depth + 1} path={cellPath} segments={cellSegments} />
                        {/* A key this row does not have is nothing to copy or remove. */}
                        {c in row && (
                          <NodeActions ctx={ctx} value={row[c]} path={cellPath} segments={cellSegments} removable />
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {remaining > 0 && (
        <button
          className="btn btn-ghost jtg-load-more"
          type="button"
          onClick={() => setVisibleCount((c) => c + CHUNK_SIZE)}
        >
          Show more ({remaining} remaining)
        </button>
      )}
    </div>
  )
}

/** Parent row: the toggle, the key, and the size badge. */
function ParentRow({
  ctx,
  nodeKey,
  data,
  path,
  segments,
  open,
  onToggle,
  badge,
}: {
  ctx: GridContext
  nodeKey: string | null
  data: unknown
  path: string
  segments: PathSegment[]
  open: boolean
  onToggle: () => void
  badge: string
}) {
  const focused = ctx.focusedPath === path
  return (
    <div className={`jtg-row jtg-row--parent${focused ? ' jtg-row--focused' : ''}${ctx.search?.matchPaths.has(path) ? ' jtg-row--match' : ''}`}>
      {nodeKey !== null && (
        <button
          type="button"
          className="jtg-key jtg-key--btn"
          onClick={() => ctx.onFocus(path, segments)}
          title="Reveal in the JSON on the left"
        >
          <Highlight text={nodeKey} query={ctx.search?.query} />
        </button>
      )}
      <div className="jtg-val">
        <button className="jtg-toggle" onClick={onToggle} type="button" aria-expanded={open}>
          {open ? '−' : '+'}
        </button>
        <span className="jtg-type-tag">{badge}</span>
        <NodeActions ctx={ctx} value={data} path={path} segments={segments} removable={segments.length > 0} />
      </div>
    </div>
  )
}

/** Object and non-table array children, chunked the same way tables are. */
function ChildList({ ctx, entries, depth, path, segments, isArray }: {
  ctx: GridContext
  entries: [string, unknown][]
  depth: number
  path: string
  segments: PathSegment[]
  isArray: boolean
}) {
  const [visibleCount, setVisibleCount] = useState(CHUNK_SIZE)
  const shown = entries.slice(0, visibleCount)
  const remaining = entries.length - shown.length

  return (
    <div className="jtg-children">
      {shown.map(([k, v]) => (
        <GridNode
          key={k}
          ctx={ctx}
          nodeKey={k}
          data={v}
          depth={depth + 1}
          path={childPath(path, k, isArray)}
          segments={[...segments, isArray ? Number(k) : k]}
        />
      ))}
      {remaining > 0 && (
        <button
          className="btn btn-ghost jtg-load-more"
          type="button"
          onClick={() => setVisibleCount((c) => c + CHUNK_SIZE)}
        >
          Show more ({remaining} remaining)
        </button>
      )}
    </div>
  )
}

export function GridNode({ ctx, nodeKey, data, depth, path, segments }: NodeProps) {
  const open = isExpanded(ctx.expansion, path, depth, ctx.search?.expandPaths)
  const toggle = () => ctx.setExpanded(path, !open)

  // Primitive leaf
  if (data === null || typeof data !== 'object') {
    const focused = ctx.focusedPath === path
    return (
      <div className={`jtg-row${focused ? ' jtg-row--focused' : ''}${ctx.search?.matchPaths.has(path) ? ' jtg-row--match' : ''}`}>
        {nodeKey !== null && (
          <button
            type="button"
            className="jtg-key jtg-key--btn"
            onClick={() => ctx.onFocus(path, segments)}
            title="Reveal in the JSON on the left"
          >
            <Highlight text={nodeKey} query={ctx.search?.query} />
          </button>
        )}
        <div className="jtg-val">
          <ScalarValue ctx={ctx} val={data} segments={segments} />
          <NodeActions ctx={ctx} value={data} path={path} segments={segments} removable={segments.length > 0} />
        </div>
      </div>
    )
  }

  const isArr = Array.isArray(data)
  const size = isArr ? (data as unknown[]).length : Object.keys(data as object).length

  // Empty container
  if (size === 0) {
    const focused = ctx.focusedPath === path
    return (
      <div className={`jtg-row${focused ? ' jtg-row--focused' : ''}`}>
        {nodeKey !== null && (
          <button
            type="button"
            className="jtg-key jtg-key--btn"
            onClick={() => ctx.onFocus(path, segments)}
            title="Reveal in the JSON on the left"
          >
            <Highlight text={nodeKey} query={ctx.search?.query} />
          </button>
        )}
        <div className="jtg-val jtg-val--type">
          <span className="jtg-type-tag">{isArr ? '[ ]' : '{ }'}</span>
          <NodeActions ctx={ctx} value={data} path={path} segments={segments} removable={segments.length > 0} />
        </div>
      </div>
    )
  }

  if (isArr) {
    const arr = data as unknown[]
    return (
      <div className="jtg-block">
        <ParentRow
          ctx={ctx} nodeKey={nodeKey} data={data} path={path} segments={segments}
          open={open} onToggle={toggle} badge={`[${arr.length}]`}
        />
        {open && (
          shouldRenderAsTable(arr) ? (
            <ArrayTable ctx={ctx} arr={arr} depth={depth} path={path} segments={segments} />
          ) : (
            <ChildList
              ctx={ctx}
              entries={arr.map((v, i) => [String(i), v] as [string, unknown])}
              depth={depth}
              path={path}
              segments={segments}
              isArray
            />
          )
        )}
      </div>
    )
  }

  const entries = Object.entries(data as Record<string, unknown>)
  return (
    <div className="jtg-block">
      <ParentRow
        ctx={ctx} nodeKey={nodeKey} data={data} path={path} segments={segments}
        open={open} onToggle={toggle} badge={`{${entries.length}}`}
      />
      {open && (
        <ChildList
          ctx={ctx} entries={entries} depth={depth} path={path} segments={segments} isArray={false}
        />
      )}
    </div>
  )
}
