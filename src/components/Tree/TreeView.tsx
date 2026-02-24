import { useState } from 'react'

interface TreeNodeProps {
  nodeKey: string | null
  data: unknown
  depth: number
  defaultExpanded?: boolean
  forceOpen?: boolean
}

const MAX_AUTO_EXPAND_DEPTH = 2

function getType(val: unknown): string {
  if (val === null) return 'null'
  if (Array.isArray(val)) return 'array'
  return typeof val
}

function CollapsibleNode({ nodeKey, data, depth, forceOpen }: TreeNodeProps) {
  const [open, setOpen] = useState(forceOpen !== undefined ? forceOpen : depth < MAX_AUTO_EXPAND_DEPTH)

  const isArray = Array.isArray(data)
  const entries = isArray
    ? (data as unknown[]).map((v, i) => [String(i), v] as [string, unknown])
    : Object.entries(data as Record<string, unknown>)
  const count = entries.length
  const openBracket  = isArray ? '[' : '{'
  const closeBracket = isArray ? ']' : '}'

  return (
    <div className="tree-node">
      <button className="tree-node__toggle" onClick={() => setOpen(!open)} type="button">
        <span className={`tree-node__caret tree-node__caret--${open ? 'open' : 'closed'}`}>▾</span>
        {nodeKey !== null && (
          <>
            <span className="tree-node__key">"{nodeKey}"</span>
            <span className="tree-node__bracket">: </span>
          </>
        )}
        <span className="tree-node__bracket">{openBracket}</span>
        {!open && (
          <>
            <span className="tree-node__bracket">…</span>
            <span className="tree-node__bracket">{closeBracket}</span>
            <span className="tree-node__count">{count} {count === 1 ? 'item' : 'items'}</span>
          </>
        )}
      </button>

      {open && (
        <>
          <div className="tree-node__children">
            {entries.map(([k, v]) => (
              <TreeNodeComponent key={k} nodeKey={isArray ? null : k} data={v} depth={depth + 1} forceOpen={forceOpen} />
            ))}
          </div>
          <span className="tree-node__bracket">{closeBracket}</span>
        </>
      )}
    </div>
  )
}

function LeafNode({ nodeKey, data }: { nodeKey: string | null; data: unknown }) {
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

  return (
    <div className="tree-leaf">
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

function TreeNodeComponent({ nodeKey, data, depth, forceOpen }: TreeNodeProps) {
  const type = getType(data)

  if (type === 'object' || type === 'array') {
    const obj = data as Record<string, unknown> | unknown[]
    const isEmpty = Array.isArray(obj) ? obj.length === 0 : Object.keys(obj).length === 0
    if (isEmpty) {
      return (
        <div className="tree-leaf">
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
    return <CollapsibleNode nodeKey={nodeKey} data={data} depth={depth} forceOpen={forceOpen} />
  }

  return <LeafNode nodeKey={nodeKey} data={data} />
}

interface TreeViewProps {
  data: unknown
  forceOpen?: boolean
}

export function TreeView({ data, forceOpen }: TreeViewProps) {
  return (
    <div className="tree-view">
      <TreeNodeComponent nodeKey={null} data={data} depth={0} forceOpen={forceOpen} />
    </div>
  )
}
