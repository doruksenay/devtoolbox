import { useState, useMemo, useEffect, useRef } from 'react'
import type { DiffType } from '../../utils/jsonDiff'
import { pathHasDiff } from '../../utils/jsonDiff'
import { computeTreeMatches, splitHighlight } from '../../utils/treeSearch'
import type { EditorSyntaxTheme } from '../../utils/editorThemes'
import { EDITOR_THEMES } from '../../utils/editorThemes'
import { useApp } from '../../context/AppContext'

interface SearchContext {
  query: string
  matchPaths: Set<string>
  expandPaths: Set<string>
  activePath?: string
}

interface TreeNodeProps {
  nodeKey: string | null
  data: unknown
  depth: number
  defaultExpanded?: boolean
  forceOpen?: boolean
  path?: string
  diffs?: Map<string, DiffType> | null
  activeDiffPath?: string
  search?: SearchContext | null
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

const CHUNK_SIZE = 100

function CollapsibleNode({ nodeKey, data, depth, forceOpen, path = '$', diffs, activeDiffPath, search }: TreeNodeProps) {
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
      <button className="tree-node__toggle" onClick={() => setOpen(!open)} type="button">
        <span className={`tree-node__caret tree-node__caret--${open ? 'open' : 'closed'}`}>▾</span>
        {nodeKey !== null && (
          <>
            <span className="tree-node__key">"<Highlight text={nodeKey} query={search?.query} />"</span>
            <span className="tree-node__bracket">: </span>
          </>
        )}
        {open ? (
          <span className="tree-node__bracket">{openBracket}</span>
        ) : (
          <>
            <span className={`tree-node__count-badge tree-node__count-badge--${isArray ? 'array' : 'object'}`}>
              {openBracket} … {count} {isArray ? (count === 1 ? 'item' : 'items') : (count === 1 ? 'prop' : 'props')} {closeBracket}
            </span>
            {containsDiffClass && (
              <span className={`tree-node__diff-pill ${containsDiffClass.trim()}`} title="Contains differences">⇄</span>
            )}
          </>
        )}
      </button>

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
                  diffs={diffs}
                  activeDiffPath={activeDiffPath}
                  search={search}
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

function LeafNode({ nodeKey, data, path = '$', diffs, activeDiffPath, search }: { nodeKey: string | null; data: unknown; path?: string; diffs?: Map<string, DiffType> | null; activeDiffPath?: string; search?: SearchContext | null }) {
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
        <>
          <span className="tree-leaf__key">"<Highlight text={nodeKey} query={search?.query} />"</span>
          <span className="tree-node__bracket">: </span>
        </>
      )}
      <span className={className}><Highlight text={display} query={search?.query} /></span>
    </div>
  )
}

function TreeNodeComponent({ nodeKey, data, depth, forceOpen, path = '$', diffs, activeDiffPath, search }: TreeNodeProps) {
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
            <>
              <span className="tree-leaf__key">"<Highlight text={nodeKey} query={search?.query} />"</span>
              <span className="tree-node__bracket">: </span>
            </>
          )}
          <span className="tree-node__bracket">{Array.isArray(obj) ? '[]' : '{}'}</span>
        </div>
      )
    }
    return <CollapsibleNode nodeKey={nodeKey} data={data} depth={depth} forceOpen={forceOpen} path={path} diffs={diffs} activeDiffPath={activeDiffPath} search={search} />
  }

  return <LeafNode nodeKey={nodeKey} data={data} path={path} diffs={diffs} activeDiffPath={activeDiffPath} search={search} />
}

interface TreeViewProps {
  data: unknown
  forceOpen?: boolean
  diffs?: Map<string, DiffType> | null
  activeDiffPath?: string
  syntaxTheme?: EditorSyntaxTheme
  /** Show the built-in search bar. Defaults to true. */
  enableSearch?: boolean
}

const SCROLL_TO_MATCH_DELAY_MS = 60

export function TreeView({ data, forceOpen, diffs, activeDiffPath, syntaxTheme, enableSearch = true }: TreeViewProps) {
  const { state } = useApp()
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
      <div className="tree-view" ref={containerRef}>
        <TreeNodeComponent nodeKey={null} data={data} depth={0} forceOpen={forceOpen} path="$" diffs={diffs} activeDiffPath={activeDiffPath} search={search} />
      </div>
    </div>
  )
}
