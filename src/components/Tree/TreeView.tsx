import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import type { DiffType } from '../../utils/jsonDiff'
import { pathHasDiff } from '../../utils/jsonDiff'
import { computeTreeMatches, splitHighlight } from '../../utils/treeSearch'
import type { EditorSyntaxTheme } from '../../utils/editorThemes'
import { EDITOR_THEMES } from '../../utils/editorThemes'
import type { PathSegment } from '../../utils/jsonEdit'
import {
  setAtPath,
  renameKeyAtPath,
  parseEditedValue,
  valueToEditText,
  valueToCopyText,
} from '../../utils/jsonEdit'
import { useApp } from '../../context/AppContext'
import { useToast } from '../Toast/ToastProvider'

interface SearchContext {
  query: string
  matchPaths: Set<string>
  expandPaths: Set<string>
  activePath?: string
}

/** Present only when the tree is editable; absent trees render read-only. */
interface EditContext {
  setValue: (segments: PathSegment[], value: unknown) => void
  renameKey: (segments: PathSegment[], newKey: string) => void
}

interface TreeNodeProps {
  nodeKey: string | null
  data: unknown
  depth: number
  defaultExpanded?: boolean
  forceOpen?: boolean
  path?: string
  segments: PathSegment[]
  diffs?: Map<string, DiffType> | null
  activeDiffPath?: string
  search?: SearchContext | null
  edit?: EditContext | null
  onCopy: (value: unknown) => void
}

const MAX_AUTO_EXPAND_DEPTH = 2

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

/** Copy button revealed when the pointer (or keyboard focus) is on a row. */
function NodeActions({ value, onCopy }: { value: unknown; onCopy: (value: unknown) => void }) {
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
          className="tree-edit-input tree-edit-input--key"
          value={draft}
          autoFocus
          spellCheck={false}
          size={Math.max(draft.length, 1)}
          aria-label="Edit key"
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

const CHUNK_SIZE = 100

function CollapsibleNode({
  nodeKey, data, depth, forceOpen, path = '$', segments, diffs, activeDiffPath, search, edit, onCopy,
}: TreeNodeProps) {
  const [open, setOpen] = useState(forceOpen !== undefined ? forceOpen : depth < MAX_AUTO_EXPAND_DEPTH)
  const [visibleCount, setVisibleCount] = useState(CHUNK_SIZE)

  // Auto-expand this node when the active diff path falls inside its subtree
  useEffect(() => {
    if (!activeDiffPath) return
    if (
      activeDiffPath === path ||
      activeDiffPath.startsWith(path + '.') ||
      activeDiffPath.startsWith(path + '[')
    ) {
      setOpen(true)
    }
  }, [activeDiffPath, path])

  // Auto-expand this node when a search match lives inside its subtree
  useEffect(() => {
    if (search?.expandPaths.has(path)) setOpen(true)
  }, [search, path])

  const isArray = Array.isArray(data)
  const entries = useMemo(() => isArray
    ? (data as unknown[]).map((v, i) => [String(i), v] as [string, unknown])
    : Object.entries(data as Record<string, unknown>), [data, isArray])
  const count = entries.length
  const openBracket  = isArray ? '[' : '{'
  const closeBracket = isArray ? ']' : '}'
  const diffClass = getDiffClass(diffs, path)
  const containsDiffClass = getContainsDiffClass(diffs, path)
  const isActive = activeDiffPath === path
  const isSearchMatch = search?.matchPaths.has(path) ?? false
  const isActiveSearch = search?.activePath === path

  const visibleEntries = count > CHUNK_SIZE ? entries.slice(0, visibleCount) : entries
  const hasMore = visibleCount < count

  const dataSearchPath = isSearchMatch ? path : undefined

  return (
    <div
      className={`tree-node${diffClass}${isActive ? ' tree-node--active-diff' : ''}${isSearchMatch ? ' tree-node--search-match' : ''}${isActiveSearch ? ' tree-node--search-active' : ''}`}
      data-diff-path={diffClass ? path : undefined}
      data-search-path={dataSearchPath}
    >
      <div className="tree-node__row">
        <button
          className="tree-node__toggle"
          onClick={() => setOpen(!open)}
          type="button"
          aria-expanded={open}
          aria-label={open ? 'Collapse node' : 'Expand node'}
        >
          <span className={`tree-node__caret tree-node__caret--${open ? 'open' : 'closed'}`}>▾</span>
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
        {open ? (
          <span className="tree-node__bracket">{openBracket}</span>
        ) : (
          <>
            <button
              type="button"
              className={`tree-node__count-badge tree-node__count-badge--${isArray ? 'array' : 'object'}`}
              onClick={() => setOpen(true)}
              aria-label="Expand node"
            >
              {openBracket} … {count} {isArray ? (count === 1 ? 'item' : 'items') : (count === 1 ? 'prop' : 'props')} {closeBracket}
            </button>
            {containsDiffClass && (
              <span className={`tree-node__diff-pill ${containsDiffClass.trim()}`} title="Contains differences">⇄</span>
            )}
          </>
        )}
        <NodeActions value={data} onCopy={onCopy} />
      </div>

      {open && (
        <>
          <div className="tree-node__children">
            {visibleEntries.map(([k, v]) => {
              const childPath = isArray ? `${path}[${k}]` : `${path}.${k}`
              return (
                <TreeNodeComponent
                  key={k}
                  nodeKey={isArray ? null : k}
                  data={v}
                  depth={depth + 1}
                  forceOpen={forceOpen}
                  path={childPath}
                  segments={[...segments, isArray ? Number(k) : k]}
                  diffs={diffs}
                  activeDiffPath={activeDiffPath}
                  search={search}
                  edit={edit}
                  onCopy={onCopy}
                />
              )
            })}
            {hasMore && (
              <button
                className="btn btn-ghost tree-node__load-more"
                onClick={() => setVisibleCount((c) => c + CHUNK_SIZE)}
                type="button"
              >
                Show more ({count - visibleCount} remaining)
              </button>
            )}
          </div>
          <span className="tree-node__bracket">{closeBracket}</span>
        </>
      )}
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
        className={`tree-edit-input${rejected ? ' tree-edit-input--invalid' : ''}`}
        value={draft}
        autoFocus
        spellCheck={false}
        size={Math.max(draft.length, 1)}
        aria-label="Edit value"
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

function LeafNode({
  nodeKey, data, path = '$', segments, diffs, activeDiffPath, search, edit, onCopy,
}: {
  nodeKey: string | null
  data: unknown
  path?: string
  segments: PathSegment[]
  diffs?: Map<string, DiffType> | null
  activeDiffPath?: string
  search?: SearchContext | null
  edit?: EditContext | null
  onCopy: (value: unknown) => void
}) {
  const type = getType(data)
  let display: string
  let className: string

  switch (type) {
    case 'string':
      display = `"${String(data)}"`
      className = 'tree-value--string'
      break
    case 'number':
      display = String(data)
      className = 'tree-value--number'
      break
    case 'boolean':
      display = String(data)
      className = 'tree-value--boolean'
      break
    case 'null':
      display = 'null'
      className = 'tree-value--null'
      break
    default:
      display = String(data)
      className = 'tree-value--string'
  }

  const diffClass = getDiffClass(diffs, path)
  const isActive = activeDiffPath === path
  const isSearchMatch = search?.matchPaths.has(path) ?? false
  const isActiveSearch = search?.activePath === path

  return (
    <div
      className={`tree-leaf${diffClass}${isActive ? ' tree-node--active-diff' : ''}${isSearchMatch ? ' tree-node--search-match' : ''}${isActiveSearch ? ' tree-node--search-active' : ''}`}
      data-diff-path={diffClass ? path : undefined}
      data-search-path={isSearchMatch ? path : undefined}
    >
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
      <NodeActions value={data} onCopy={onCopy} />
    </div>
  )
}

function TreeNodeComponent({
  nodeKey, data, depth, forceOpen, path = '$', segments, diffs, activeDiffPath, search, edit, onCopy,
}: TreeNodeProps) {
  const type = getType(data)

  if (type === 'object' || type === 'array') {
    const obj = data as Record<string, unknown> | unknown[]
    const isEmpty = Array.isArray(obj) ? obj.length === 0 : Object.keys(obj).length === 0
    if (isEmpty) {
      const diffClass = getDiffClass(diffs, path)
      const isActive = activeDiffPath === path
      const isSearchMatch = search?.matchPaths.has(path) ?? false
      const isActiveSearch = search?.activePath === path
      return (
        <div
          className={`tree-leaf${diffClass}${isActive ? ' tree-node--active-diff' : ''}${isSearchMatch ? ' tree-node--search-match' : ''}${isActiveSearch ? ' tree-node--search-active' : ''}`}
          data-diff-path={diffClass ? path : undefined}
          data-search-path={isSearchMatch ? path : undefined}
        >
          {nodeKey !== null && (
            <NodeKey
              nodeKey={nodeKey}
              segments={segments}
              className="tree-leaf__key"
              search={search}
              edit={edit}
            />
          )}
          <span className="tree-node__bracket">{Array.isArray(obj) ? '[]' : '{}'}</span>
          <NodeActions value={data} onCopy={onCopy} />
        </div>
      )
    }
    return (
      <CollapsibleNode
        nodeKey={nodeKey} data={data} depth={depth} forceOpen={forceOpen} path={path}
        segments={segments} diffs={diffs} activeDiffPath={activeDiffPath} search={search}
        edit={edit} onCopy={onCopy}
      />
    )
  }

  return (
    <LeafNode
      nodeKey={nodeKey} data={data} path={path} segments={segments} diffs={diffs}
      activeDiffPath={activeDiffPath} search={search} edit={edit} onCopy={onCopy}
    />
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

const SCROLL_TO_MATCH_DELAY_MS = 60

export function TreeView({ data, forceOpen, diffs, activeDiffPath, syntaxTheme, enableSearch = true, onChange }: TreeViewProps) {
  const { state } = useApp()
  const { addToast } = useToast()
  const theme: EditorSyntaxTheme = (syntaxTheme ?? state.editorSyntaxTheme ?? 'default') as EditorSyntaxTheme
  const colorMode = state.theme === 'dark' ? 'dark' : 'light'
  const colors = EDITOR_THEMES[theme][colorMode]

  const [query, setQuery] = useState('')
  const [matchIndex, setMatchIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

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

  // Reset the active match whenever the query (and thus the match set) changes
  useEffect(() => {
    setMatchIndex(0)
  }, [query])

  // Scroll the active match into view once nodes have expanded
  useEffect(() => {
    if (!activePath) return
    const timer = setTimeout(() => {
      const el = containerRef.current?.querySelector(`[data-search-path="${CSS.escape(activePath)}"]`)
      if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, SCROLL_TO_MATCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [activePath])

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
    }
  }, [onChange, data, addToast])

  const search: SearchContext | null = query.trim()
    ? { query, matchPaths, expandPaths, activePath }
    : null

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
        <TreeNodeComponent
          nodeKey={null}
          data={data}
          depth={0}
          forceOpen={forceOpen}
          path="$"
          segments={[]}
          diffs={diffs}
          activeDiffPath={activeDiffPath}
          search={search}
          edit={edit}
          onCopy={handleCopy}
        />
      </div>
    </div>
  )
}
