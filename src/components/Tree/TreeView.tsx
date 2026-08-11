import { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react'
import type { DiffType } from '../../utils/jsonDiff'
import { pathHasDiff } from '../../utils/jsonDiff'
import { computeTreeMatches, splitHighlight } from '../../utils/treeSearch'
import type { EditorSyntaxTheme } from '../../utils/editorThemes'
import { EDITOR_THEMES } from '../../utils/editorThemes'
import type { PathSegment } from '../../utils/jsonEdit'
import {
  setAtPath,
  renameKeyAtPath,
  deleteAtPath,
  appendChildAtPath,
  segmentsEqual,
  parseEditedValue,
  valueToEditText,
  valueToCopyText,
} from '../../utils/jsonEdit'
import { useAppSelector } from '../../context/AppContext'
import { useToast } from '../Toast/ToastProvider'
import { useVirtualizer } from '@tanstack/react-virtual'
import { flattenTree, expandAncestors, findRowIndex, pathFromSegments, type TreeRow } from './treeRows'
import {
  initialExpansion,
  setExpanded,
  setExpansionMode,
  type ExpansionState,
} from '../../utils/expansion'

interface SearchContext {
  query: string
  matchPaths: Set<string>
  expandPaths: Set<string>
  activePath?: string
}

/**
 * A freshly added entry whose editor should open by itself, so adding a field
 * lands the cursor where the user is about to type. Objects open the key
 * editor; array items have no key, so they open the value editor.
 */
interface PendingEdit {
  segments: PathSegment[]
  field: 'key' | 'value'
}

/** Present only when the tree is editable; absent trees render read-only. */
interface EditContext {
  setValue: (segments: PathSegment[], value: unknown) => void
  renameKey: (segments: PathSegment[], newKey: string) => void
  addChild: (segments: PathSegment[]) => void
  remove: (segments: PathSegment[]) => void
  pending: PendingEdit | null
  clearPending: () => void
}

function getType(val: unknown): string {
  if (val === null) return 'null'
  if (Array.isArray(val)) return 'array'
  return typeof val
}

/** Renders text, wrapping search-matching substrings in a highlight mark. */
function Highlight({ text, query }: { text: string; query?: string }) {
  if (!query) return <>{text}</>
  const segments = splitHighlight(text, query)
  if (segments.length === 1 && !segments[0].match) return <>{text}</>
  return (
    <>
      {segments.map((seg, i) =>
        seg.match ? (
          <mark key={i} className="tree-search__mark">{seg.text}</mark>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </>
  )
}

function diffTypeToClass(diff: DiffType | null): string {
  switch (diff) {
    case 'added': return ' tree-node--added'
    case 'removed': return ' tree-node--removed'
    case 'changed': return ' tree-node--changed'
    default: return ''
  }
}

/**
 * Highlight class for a node that is *exactly* the diff endpoint.
 * Leaf-style nodes have no children, so their exact diff is the same as
 * `pathHasDiff`, but for container nodes this avoids shading the whole
 * subtree just because a descendant differs.
 */
function getDiffClass(diffs: Map<string, DiffType> | null | undefined, path: string): string {
  if (!diffs) return ''
  return diffTypeToClass(diffs.get(path) ?? null)
}

/** Class describing whether this node contains a diff anywhere in its subtree. */
function getContainsDiffClass(diffs: Map<string, DiffType> | null | undefined, path: string): string {
  if (!diffs) return ''
  return diffTypeToClass(pathHasDiff(diffs, path))
}

/**
 * Row buttons revealed on hover or keyboard focus. Copy is always available;
 * add appears on containers and remove on everything but the root, and both
 * only when the tree is editable.
 */
function NodeActions({
  value,
  onCopy,
  onAdd,
  onRemove,
}: {
  value: unknown
  onCopy: (value: unknown) => void
  onAdd?: () => void
  onRemove?: () => void
}) {
  return (
    <span className="tree-node__actions">
      <button
        type="button"
        className="tree-node__action"
        title="Copy value"
        aria-label="Copy value"
        onClick={() => onCopy(value)}
      >
        ⧉
      </button>
      {onAdd && (
        <button
          type="button"
          className="tree-node__action"
          title="Add entry"
          aria-label="Add entry"
          onClick={onAdd}
        >
          +
        </button>
      )}
      {onRemove && (
        <button
          type="button"
          className="tree-node__action tree-node__action--danger"
          title="Remove"
          aria-label="Remove"
          onClick={onRemove}
        >
          ✕
        </button>
      )}
    </span>
  )
}

/**
 * The `"key":` part of a row. Editable when the tree is editable and the parent
 * is an object — array indices are positional, so they are never renameable.
 */
function NodeKey({
  nodeKey,
  segments,
  className,
  search,
  edit,
}: {
  nodeKey: string
  segments: PathSegment[]
  className: string
  search?: SearchContext | null
  edit?: EditContext | null
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const editable = !!edit && typeof segments[segments.length - 1] === 'string'
  // See LeafValue: closing the editor can also fire a blur.
  const handledRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // The editor is only mounted while renaming, so focus is moved
  // programmatically on open rather than with `autoFocus`.
  const editing = draft !== null
  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  // A key that was just added opens its own editor, so adding a field puts the
  // cursor straight on the placeholder name.
  const isPending =
    edit?.pending?.field === 'key' && segmentsEqual(edit.pending.segments, segments)
  const clearPending = edit?.clearPending
  useEffect(() => {
    if (!isPending) return
    setDraft(nodeKey)
    clearPending?.()
  }, [isPending, nodeKey, clearPending])

  function commit() {
    if (draft === null) return
    const next = draft
    handledRef.current = true
    setDraft(null)
    if (next !== nodeKey) edit?.renameKey(segments, next)
  }

  if (draft !== null) {
    return (
      <>
        <input
          ref={inputRef}
          className="tree-edit-input tree-edit-input--key"
          value={draft}
          spellCheck={false}
          size={Math.max(draft.length, 1)}
          aria-label="Edit key"
          // Select on open so a placeholder key is replaced by typing, the way
          // a rename works everywhere else.
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (handledRef.current) {
              handledRef.current = false
              return
            }
            commit()
            handledRef.current = false
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              handledRef.current = true
              setDraft(null)
            }
          }}
        />
        <span className="tree-node__bracket">: </span>
      </>
    )
  }

  return (
    <>
      <span className={className}>
        "
        {editable ? (
          <button
            type="button"
            className="tree-edit-target"
            title="Click to rename"
            onClick={() => setDraft(nodeKey)}
          >
            <Highlight text={nodeKey} query={search?.query} />
          </button>
        ) : (
          <Highlight text={nodeKey} query={search?.query} />
        )}
        "
      </span>
      <span className="tree-node__bracket">: </span>
    </>
  )
}

/** The text and colour class a scalar renders with. */
function describeLeaf(data: unknown): { display: string; className: string } {
  switch (getType(data)) {
    case 'string':
      return { display: `"${String(data)}"`, className: 'tree-value--string' }
    case 'number':
      return { display: String(data), className: 'tree-value--number' }
    case 'boolean':
      return { display: String(data), className: 'tree-value--boolean' }
    case 'null':
      return { display: 'null', className: 'tree-value--null' }
    default:
      return { display: String(data), className: 'tree-value--string' }
  }
}

interface TreeRowViewProps {
  row: TreeRow
  diffs?: Map<string, DiffType> | null
  activeDiffPath?: string
  search?: SearchContext | null
  edit?: EditContext | null
  onCopy: (value: unknown) => void
  onToggle: (path: string, open: boolean) => void
}

/**
 * One line of the tree.
 *
 * The tree used to render itself recursively, each node owning its own open
 * state. That made the visible rows impossible to enumerate without rendering
 * them, which is exactly what windowing needs to do. Rows are now produced by
 * `flattenTree` and drawn independently, so indentation comes from the row's
 * depth rather than from being nested inside its parent's DOM.
 */
function TreeRowView({ row, diffs, activeDiffPath, search, edit, onCopy, onToggle }: TreeRowViewProps) {
  const { path, segments, nodeKey, data, kind, isArray, count, depth, expanded } = row
  const indent = { '--tree-depth': depth } as React.CSSProperties

  // The closing bracket is its own row and carries no affordances.
  if (kind === 'branch-end') {
    return (
      <div className="tree-row" style={indent}>
        <div className="tree-node">
          <span className="tree-node__bracket">{isArray ? ']' : '}'}</span>
        </div>
      </div>
    )
  }

  const diffClass = getDiffClass(diffs, path)
  const isActive = activeDiffPath === path
  const isSearchMatch = search?.matchPaths.has(path) ?? false
  const isActiveSearch = search?.activePath === path
  const stateClass =
    `${diffClass}` +
    `${isActive ? ' tree-node--active-diff' : ''}` +
    `${isSearchMatch ? ' tree-node--search-match' : ''}` +
    `${isActiveSearch ? ' tree-node--search-active' : ''}`
  const diffPath = diffClass ? path : undefined
  const searchPath = isSearchMatch ? path : undefined

  if (kind === 'branch') {
    const openBracket = isArray ? '[' : '{'
    const closeBracket = isArray ? ']' : '}'
    const containsDiffClass = getContainsDiffClass(diffs, path)
    return (
      <div className="tree-row" style={indent}>
        <div className={`tree-node${stateClass}`} data-diff-path={diffPath} data-search-path={searchPath}>
          <div className="tree-node__row">
            <button
              className="tree-node__toggle"
              onClick={() => onToggle(path, !expanded)}
              type="button"
              aria-expanded={expanded}
              aria-label={expanded ? 'Collapse node' : 'Expand node'}
            >
              <span className={`tree-node__caret tree-node__caret--${expanded ? 'open' : 'closed'}`}>▾</span>
            </button>
            {nodeKey !== null && (
              <NodeKey
                nodeKey={nodeKey}
                segments={segments}
                className="tree-node__key"
                search={search}
                edit={edit}
              />
            )}
            {expanded ? (
              <span className="tree-node__bracket">{openBracket}</span>
            ) : (
              <>
                <button
                  type="button"
                  className={`tree-node__count-badge tree-node__count-badge--${isArray ? 'array' : 'object'}`}
                  onClick={() => onToggle(path, true)}
                  aria-label="Expand node"
                >
                  {openBracket} … {count} {isArray ? (count === 1 ? 'item' : 'items') : (count === 1 ? 'prop' : 'props')} {closeBracket}
                </button>
                {containsDiffClass && (
                  <span className={`tree-node__diff-pill ${containsDiffClass.trim()}`} title="Contains differences">⇄</span>
                )}
              </>
            )}
            <NodeActions
              value={data}
              onCopy={onCopy}
              onAdd={edit ? () => {
                // Open the node so the entry that is about to be appended, and
                // the editor that opens on it, are actually on screen.
                onToggle(path, true)
                edit.addChild(segments)
              } : undefined}
              onRemove={edit && segments.length > 0 ? () => edit.remove(segments) : undefined}
            />
          </div>
        </div>
      </div>
    )
  }

  if (kind === 'empty') {
    return (
      <div className="tree-row" style={indent}>
        <div className={`tree-leaf${stateClass}`} data-diff-path={diffPath} data-search-path={searchPath}>
          {nodeKey !== null && (
            <NodeKey
              nodeKey={nodeKey}
              segments={segments}
              className="tree-leaf__key"
              search={search}
              edit={edit}
            />
          )}
          <span className="tree-node__bracket">{isArray ? '[]' : '{}'}</span>
          <NodeActions
            value={data}
            onCopy={onCopy}
            onAdd={edit ? () => edit.addChild(segments) : undefined}
            onRemove={edit && segments.length > 0 ? () => edit.remove(segments) : undefined}
          />
        </div>
      </div>
    )
  }

  const { display, className } = describeLeaf(data)
  return (
    <div className="tree-row" style={indent}>
      <div className={`tree-leaf${stateClass}`} data-diff-path={diffPath} data-search-path={searchPath}>
        {nodeKey !== null && (
          <NodeKey
            nodeKey={nodeKey}
            segments={segments}
            className="tree-leaf__key"
            search={search}
            edit={edit}
          />
        )}
        <LeafValue
          data={data}
          className={className}
          display={display}
          segments={segments}
          search={search}
          edit={edit}
        />
        <NodeActions
          value={data}
          onCopy={onCopy}
          onRemove={edit && segments.length > 0 ? () => edit.remove(segments) : undefined}
        />
      </div>
    </div>
  )
}

/** The scalar value of a leaf row, editable in place when the tree is editable. */
function LeafValue({
  data,
  className,
  display,
  segments,
  search,
  edit,
}: {
  data: unknown
  className: string
  display: string
  segments: PathSegment[]
  search?: SearchContext | null
  edit?: EditContext | null
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const [rejected, setRejected] = useState(false)
  // Closing the editor can also fire a blur; without this the same edit would
  // be dispatched twice and cost the user two undo steps to reverse.
  const handledRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // The editor is only mounted while editing, so focus is moved
  // programmatically on open rather than with `autoFocus`.
  const editing = draft !== null
  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  // An array item that was just added opens its own editor — it has no key to
  // name, so the value is where the user types.
  const isPending =
    edit?.pending?.field === 'value' && segmentsEqual(edit.pending.segments, segments)
  const clearPending = edit?.clearPending
  useEffect(() => {
    if (!isPending) return
    setDraft(valueToEditText(data))
    clearPending?.()
  }, [isPending, data, clearPending])

  function closeEditor() {
    handledRef.current = true
    setDraft(null)
    setRejected(false)
  }

  function commit() {
    if (draft === null) return
    const parsed = parseEditedValue(data, draft)
    if (!parsed.ok) {
      setRejected(true)
      return
    }
    closeEditor()
    setValueIfChanged(parsed.value)
  }

  function setValueIfChanged(value: unknown) {
    if (Object.is(value, data)) return
    edit?.setValue(segments, value)
  }

  if (draft !== null) {
    return (
      <input
        ref={inputRef}
        className={`tree-edit-input${rejected ? ' tree-edit-input--invalid' : ''}`}
        value={draft}
        spellCheck={false}
        size={Math.max(draft.length, 1)}
        aria-label="Edit value"
        onFocus={(e) => e.currentTarget.select()}
        title={
          typeof data === 'string'
            ? 'Edited as plain text'
            : 'Enter a JSON literal, e.g. 42, true, null, "text"'
        }
        onChange={(e) => {
          setDraft(e.target.value)
          setRejected(false)
        }}
        onBlur={() => {
          if (handledRef.current) {
            handledRef.current = false
            return
          }
          // A blur cannot be "corrected" by the user, so an unparseable draft is
          // discarded rather than left blocking focus.
          const parsed = parseEditedValue(data, draft)
          closeEditor()
          handledRef.current = false
          if (parsed.ok) setValueIfChanged(parsed.value)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            closeEditor()
          }
        }}
      />
    )
  }

  if (!edit) {
    return <span className={className}><Highlight text={display} query={search?.query} /></span>
  }

  return (
    <button
      type="button"
      className={`tree-edit-target ${className}`}
      title="Click to edit"
      onClick={() => setDraft(valueToEditText(data))}
    >
      <Highlight text={display} query={search?.query} />
    </button>
  )
}

interface TreeViewProps {
  data: unknown
  forceOpen?: boolean
  diffs?: Map<string, DiffType> | null
  activeDiffPath?: string
  syntaxTheme?: EditorSyntaxTheme
  /** Show the built-in search bar. Defaults to true. */
  enableSearch?: boolean
  /**
   * Makes the tree editable. Receives the whole document with the edit applied;
   * omit it to render a read-only tree.
   */
  onChange?: (next: unknown) => void
}

/** Matches the 12.5px/1.7 line height rows settle at; real sizes are measured. */
const ESTIMATED_ROW_HEIGHT = 21

function TreeViewImpl({ data, forceOpen, diffs, activeDiffPath, syntaxTheme, enableSearch = true, onChange }: TreeViewProps) {
  const editorSyntaxTheme = useAppSelector((state) => state.editorSyntaxTheme)
  const appTheme = useAppSelector((state) => state.theme)
  const { addToast } = useToast()
  const theme: EditorSyntaxTheme = (syntaxTheme ?? editorSyntaxTheme ?? 'default') as EditorSyntaxTheme
  const colorMode = appTheme === 'dark' ? 'dark' : 'light'
  const colors = EDITOR_THEMES[theme][colorMode]

  const [query, setQuery] = useState('')
  const [matchIndex, setMatchIndex] = useState(0)
  const [pending, setPending] = useState<PendingEdit | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Which nodes are open now lives here rather than inside each node, because
  // the flat row list has to be derivable without rendering anything.
  const [expansion, setExpansion] = useState<ExpansionState>(initialExpansion)

  // Expand All / Collapse All arrive as this prop. It used to seed each node's
  // own state on mount, so it only took effect because callers remounted the
  // tree with a changing `key`; as a mode it works either way.
  useEffect(() => {
    setExpansion(setExpansionMode(forceOpen === undefined ? 'auto' : forceOpen ? 'all' : 'none'))
  }, [forceOpen])

  const handleToggle = useCallback((path: string, open: boolean) => {
    setExpansion((current) => setExpanded(current, path, open))
  }, [])

  const { matches, expandPaths } = useMemo(
    () => computeTreeMatches(data, query),
    [data, query]
  )

  const matchPaths = useMemo(() => new Set(matches), [matches])
  const totalMatches = matches.length
  // Clamp once so the highlighted match and the "n / total" label stay in sync,
  // even on the render right before the reset effect fires (match set shrank).
  const safeIndex = totalMatches > 0 ? Math.min(matchIndex, totalMatches - 1) : 0
  const activePath = totalMatches > 0 ? matches[safeIndex] : undefined

  const search: SearchContext | null = query.trim()
    ? { query, matchPaths, expandPaths, activePath }
    : null

  // Search wins over the stored state rather than being written into it, so
  // clearing the query puts the tree back the way the user left it.
  const rows = useMemo(
    () => flattenTree(data, expansion, search?.expandPaths ?? null),
    [data, expansion, search?.expandPaths],
  )

  // Read by effects that must not re-run every time the row list is rebuilt.
  const rowsRef = useRef(rows)
  rowsRef.current = rows

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 12,
    // Until the pane has been measured there is no height to work from, and a
    // zero-height viewport yields zero rows. Assume a typical pane so the first
    // paint has content; the real size replaces this as soon as it is known.
    initialRect: { width: 800, height: 600 },
  })

  // Reset the active match whenever the query (and thus the match set) changes
  useEffect(() => {
    setMatchIndex(0)
  }, [query])

  // Scroll the active match into view. The row is usually not mounted — that is
  // the point of windowing — so this asks the virtualizer for the index rather
  // than looking for an element.
  useEffect(() => {
    if (!activePath) return
    const index = findRowIndex(rowsRef.current, activePath)
    if (index >= 0) virtualizer.scrollToIndex(index, { align: 'center' })
  }, [activePath, virtualizer])

  const handleCopy = useCallback((value: unknown) => {
    navigator.clipboard.writeText(valueToCopyText(value)).then(
      () => addToast('Copied to clipboard'),
      () => addToast('Could not copy to clipboard', 'error')
    )
  }, [addToast])

  const edit: EditContext | null = useMemo(() => {
    if (!onChange) return null
    return {
      setValue: (segments, value) => onChange(setAtPath(data, segments, value)),
      renameKey: (segments, newKey) => {
        const result = renameKeyAtPath(data, segments, newKey)
        if (result.ok) {
          onChange(result.root)
          return
        }
        if (result.reason === 'duplicate') addToast(`Key "${newKey}" already exists`, 'error')
        else if (result.reason === 'empty') addToast('Key cannot be empty', 'error')
      },
      addChild: (segments) => {
        const result = appendChildAtPath(data, segments)
        if (!result) return
        onChange(result.root)
        // Objects get a placeholder key worth renaming immediately; array items
        // have no key, so the value is what the user came to type.
        setPending({
          segments: result.segments,
          field: typeof result.segments[result.segments.length - 1] === 'string' ? 'key' : 'value',
        })
      },
      remove: (segments) => {
        setPending(null)
        onChange(deleteAtPath(data, segments))
      },
      pending,
      clearPending: () => setPending(null),
    }
  }, [onChange, data, addToast, pending])

  // Reveal the diff the Compare view is pointing at. `expandAncestors` stops
  // short of the node itself, which still has to open when it is a container.
  useEffect(() => {
    if (!activeDiffPath) return
    setExpansion((current) => setExpanded(expandAncestors(current, activeDiffPath), activeDiffPath, true))
  }, [activeDiffPath])

  // A freshly added entry may have landed inside a collapsed node; its editor
  // opens by itself, so it has to be on screen.
  useEffect(() => {
    if (!pending) return
    const path = pathFromSegments(pending.segments)
    setExpansion((current) => setExpanded(expandAncestors(current, path), path, true))
  }, [pending])

  function gotoMatch(delta: number) {
    if (totalMatches === 0) return
    setMatchIndex((i) => (i + delta + totalMatches) % totalMatches)
  }

  const cssVars = {
    '--tree-string-color': colors.string,
    '--tree-number-color': colors.number,
    '--tree-boolean-color': colors.boolean,
    '--tree-null-color': colors.null,
    '--tree-key-color': colors.key,
  } as React.CSSProperties

  return (
    <div className="tree-view-wrapper" style={cssVars}>
      {enableSearch && (
        <div className="tree-search">
          <span className="tree-search__icon" aria-hidden>⌕</span>
          <input
            className="tree-search__input"
            type="text"
            value={query}
            aria-label="Search keys and values"
            placeholder="Search keys and values…"
            spellCheck={false}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                gotoMatch(e.shiftKey ? -1 : 1)
              } else if (e.key === 'Escape') {
                setQuery('')
              }
            }}
          />
          {query.trim() && (
            <>
              <span className="tree-search__count">
                {totalMatches > 0 ? `${safeIndex + 1} / ${totalMatches}` : '0 / 0'}
              </span>
              <button
                className="tree-search__nav"
                onClick={() => gotoMatch(-1)}
                disabled={totalMatches === 0}
                title="Previous match (Shift+Enter)"
                type="button"
              >‹</button>
              <button
                className="tree-search__nav"
                onClick={() => gotoMatch(1)}
                disabled={totalMatches === 0}
                title="Next match (Enter)"
                type="button"
              >›</button>
              <button
                className="tree-search__nav"
                onClick={() => setQuery('')}
                title="Clear search"
                type="button"
              >✕</button>
            </>
          )}
        </div>
      )}
      <div className={`tree-view${edit ? ' tree-view--editable' : ''}`} ref={containerRef}>
        {/* Only the rows in view are mounted. The sizer holds the full scroll
            height so the scrollbar still describes the whole document. */}
        <div className="tree-view__sizer" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((item) => (
            <div
              key={rows[item.index].key}
              className="tree-view__row-slot"
              data-index={item.index}
              // Rows are not all one height: an open editor or a wrapped value
              // is taller, so each one reports its real size back.
              ref={virtualizer.measureElement}
              style={{ transform: `translateY(${item.start}px)` }}
            >
              <TreeRowView
                row={rows[item.index]}
                diffs={diffs}
                activeDiffPath={activeDiffPath}
                search={search}
                edit={edit}
                onCopy={handleCopy}
                onToggle={handleToggle}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Memoized: the editor re-renders on every keystroke, but the tree only needs
 * to change when the parsed document does — re-rendering thousands of nodes
 * for text that has not been re-parsed yet is pure waste.
 */
export const TreeView = memo(TreeViewImpl)
