import { useState, useMemo, useEffect } from 'react'
import type { DiffType } from '../../utils/jsonDiff'
import { pathHasDiff } from '../../utils/jsonDiff'
import type { EditorSyntaxTheme } from '../../utils/editorThemes'
import { EDITOR_THEMES } from '../../utils/editorThemes'
import { useApp } from '../../context/AppContext'

interface TreeNodeProps {
  nodeKey: string | null
  data: unknown
  depth: number
  defaultExpanded?: boolean
  forceOpen?: boolean
  path?: string
  diffs?: Map<string, DiffType> | null
  activeDiffPath?: string
}

const MAX_AUTO_EXPAND_DEPTH = 2

function getType(val: unknown): string {
  if (val === null) return 'null'
  if (Array.isArray(val)) return 'array'
  return typeof val
}

function getDiffClass(diffs: Map<string, DiffType> | null | undefined, path: string): string {
  if (!diffs) return ''
  const diff = pathHasDiff(diffs, path)
  if (!diff) return ''
  switch (diff) {
    case 'added': return ' tree-node--added'
    case 'removed': return ' tree-node--removed'
    case 'changed': return ' tree-node--changed'
    default: return ''
  }
}

const CHUNK_SIZE = 100

function CollapsibleNode({ nodeKey, data, depth, forceOpen, path = '$', diffs, activeDiffPath }: TreeNodeProps) {
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

  const isArray = Array.isArray(data)
  const entries = useMemo(() => isArray
    ? (data as unknown[]).map((v, i) => [String(i), v] as [string, unknown])
    : Object.entries(data as Record<string, unknown>), [data, isArray])
  const count = entries.length
  const openBracket  = isArray ? '[' : '{'
  const closeBracket = isArray ? ']' : '}'
  const diffClass = getDiffClass(diffs, path)
  const isActive = activeDiffPath === path

  const visibleEntries = count > CHUNK_SIZE ? entries.slice(0, visibleCount) : entries
  const hasMore = visibleCount < count

  return (
    <div className={`tree-node${diffClass}${isActive ? ' tree-node--active-diff' : ''}`} data-diff-path={diffClass ? path : undefined}>
      <button className="tree-node__toggle" onClick={() => setOpen(!open)} type="button">
        <span className={`tree-node__caret tree-node__caret--${open ? 'open' : 'closed'}`}>▾</span>
        {nodeKey !== null && (
          <>
            <span className="tree-node__key">"{nodeKey}"</span>
            <span className="tree-node__bracket">: </span>
          </>
        )}
        {open ? (
          <span className="tree-node__bracket">{openBracket}</span>
        ) : (
          <span className={`tree-node__count-badge tree-node__count-badge--${isArray ? 'array' : 'object'}`}>
            {openBracket} … {count} {isArray ? (count === 1 ? 'item' : 'items') : (count === 1 ? 'prop' : 'props')} {closeBracket}
          </span>
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

function LeafNode({ nodeKey, data, path = '$', diffs, activeDiffPath }: { nodeKey: string | null; data: unknown; path?: string; diffs?: Map<string, DiffType> | null; activeDiffPath?: string }) {
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

  return (
    <div className={`tree-leaf${diffClass}${isActive ? ' tree-node--active-diff' : ''}`} data-diff-path={diffClass ? path : undefined}>
      {nodeKey !== null && (
        <>
          <span className="tree-leaf__key">"{nodeKey}"</span>
          <span className="tree-node__bracket">: </span>
        </>
      )}
      <span className={className}>{display}</span>
    </div>
  )
}

function TreeNodeComponent({ nodeKey, data, depth, forceOpen, path = '$', diffs, activeDiffPath }: TreeNodeProps) {
  const type = getType(data)

  if (type === 'object' || type === 'array') {
    const obj = data as Record<string, unknown> | unknown[]
    const isEmpty = Array.isArray(obj) ? obj.length === 0 : Object.keys(obj).length === 0
    if (isEmpty) {
      const diffClass = getDiffClass(diffs, path)
      const isActive = activeDiffPath === path
      return (
        <div className={`tree-leaf${diffClass}${isActive ? ' tree-node--active-diff' : ''}`} data-diff-path={diffClass ? path : undefined}>
          {nodeKey !== null && (
            <>
              <span className="tree-leaf__key">"{nodeKey}"</span>
              <span className="tree-node__bracket">: </span>
            </>
          )}
          <span className="tree-node__bracket">{Array.isArray(obj) ? '[]' : '{}'}</span>
        </div>
      )
    }
    return <CollapsibleNode nodeKey={nodeKey} data={data} depth={depth} forceOpen={forceOpen} path={path} diffs={diffs} activeDiffPath={activeDiffPath} />
  }

  return <LeafNode nodeKey={nodeKey} data={data} path={path} diffs={diffs} activeDiffPath={activeDiffPath} />
}

interface TreeViewProps {
  data: unknown
  forceOpen?: boolean
  diffs?: Map<string, DiffType> | null
  activeDiffPath?: string
  syntaxTheme?: EditorSyntaxTheme
}

export function TreeView({ data, forceOpen, diffs, activeDiffPath, syntaxTheme }: TreeViewProps) {
  const { state } = useApp()
  const theme: EditorSyntaxTheme = (syntaxTheme ?? state.editorSyntaxTheme ?? 'default') as EditorSyntaxTheme
  const colorMode = state.theme === 'dark' ? 'dark' : 'light'
  const colors = EDITOR_THEMES[theme][colorMode]

  const cssVars = {
    '--tree-string-color': colors.string,
    '--tree-number-color': colors.number,
    '--tree-boolean-color': colors.boolean,
    '--tree-null-color': colors.null,
    '--tree-key-color': colors.key,
  } as React.CSSProperties

  return (
    <div className="tree-view" style={cssVars}>
      <TreeNodeComponent nodeKey={null} data={data} depth={0} forceOpen={forceOpen} path="$" diffs={diffs} activeDiffPath={activeDiffPath} />
    </div>
  )
}
