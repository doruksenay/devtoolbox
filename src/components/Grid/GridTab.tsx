import { useState, useMemo, useRef, useCallback } from 'react'
import { useApp } from '../../context/AppContext'
import { JsonTextarea } from '../shared/JsonTextarea'
import { parseJson } from '../../context/AppContext'

// ── Primitive value renderer ──────────────────────────────────────────────────
function PrimitiveSpan({ val }: { val: unknown }) {
  if (val === null) return <span className="jtg-null">null</span>
  if (typeof val === 'boolean') return <span className="jtg-bool">{String(val)}</span>
  if (typeof val === 'number') return <span className="jtg-number">{String(val)}</span>
  return <span className="jtg-string">&quot;{String(val)}&quot;</span>
}

function CellValue({ val }: { val: unknown }) {
  if (val !== null && typeof val === 'object') {
    const label = Array.isArray(val) ? `[${(val as unknown[]).length}]` : '{…}'
    return <span className="jtg-type-tag">{label}</span>
  }
  return <PrimitiveSpan val={val} />
}

// ── Tree grid node ─────────────────────────────────────────────────────────────
interface NodeProps {
  nodeKey: string | null
  data: unknown
  depth: number
}

function TreeGridNode({ nodeKey, data, depth }: NodeProps) {
  const [open, setOpen] = useState(depth < 2)

  // Primitive leaf
  if (data === null || typeof data !== 'object') {
    return (
      <div className="jtg-row">
        {nodeKey !== null && <div className="jtg-key">{nodeKey}</div>}
        <div className="jtg-val"><PrimitiveSpan val={data} /></div>
      </div>
    )
  }

  const isArr = Array.isArray(data)

  // Empty object / array
  if (isArr ? (data as unknown[]).length === 0 : Object.keys(data as object).length === 0) {
    return (
      <div className="jtg-row">
        {nodeKey !== null && <div className="jtg-key">{nodeKey}</div>}
        <div className="jtg-val jtg-val--type">{isArr ? '[ ]' : '{ }'}</div>
      </div>
    )
  }

  if (isArr) {
    const arr = data as unknown[]
    // Detect array-of-objects → render as mini-table
    const objectItems = arr.filter(
      (item) => item && typeof item === 'object' && !Array.isArray(item),
    ) as Record<string, unknown>[]
    const isObjectArr = objectItems.length === arr.length

    if (isObjectArr) {
      const columns = Array.from(
        objectItems.reduce((set, item) => {
          Object.keys(item).forEach((k) => set.add(k))
          return set
        }, new Set<string>()),
      )

      return (
        <div className="jtg-block">
          <div className="jtg-row jtg-row--parent">
            {nodeKey !== null && <div className="jtg-key">{nodeKey}</div>}
            <div className="jtg-val">
              <button className="jtg-toggle" onClick={() => setOpen((o) => !o)} type="button">
                {open ? '−' : '+'}
              </button>
              <span className="jtg-type-tag">[{arr.length}]</span>
            </div>
          </div>
          {open && (
            <div className="jtg-children">
              <table className="jtg-table">
                <thead>
                  <tr>
                    <th className="jtg-th jtg-th--index">#</th>
                    {columns.map((c) => (
                      <th key={c} className="jtg-th">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {objectItems.map((row, i) => (
                    <tr key={i} className="jtg-tr">
                      <td className="jtg-td jtg-td--index">{i + 1}</td>
                      {columns.map((c) => (
                        <td key={c} className="jtg-td">
                          <CellValue val={row[c]} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )
    }

    // Mixed / primitive array
    return (
      <div className="jtg-block">
        <div className="jtg-row jtg-row--parent">
          {nodeKey !== null && <div className="jtg-key">{nodeKey}</div>}
          <div className="jtg-val">
            <button className="jtg-toggle" onClick={() => setOpen((o) => !o)} type="button">
              {open ? '−' : '+'}
            </button>
            <span className="jtg-type-tag">[{arr.length}]</span>
          </div>
        </div>
        {open && (
          <div className="jtg-children">
            {arr.map((item, i) => (
              <TreeGridNode key={i} nodeKey={String(i)} data={item} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  // Object
  const entries = Object.entries(data as Record<string, unknown>)

  return (
    <div className="jtg-block">
      <div className="jtg-row jtg-row--parent">
        {nodeKey !== null && <div className="jtg-key">{nodeKey}</div>}
        <div className="jtg-val">
          <button className="jtg-toggle" onClick={() => setOpen((o) => !o)} type="button">
            {open ? '−' : '+'}
          </button>
          <span className="jtg-type-tag">{`{${entries.length}}`}</span>
        </div>
      </div>
      {open && (
        <div className="jtg-children">
          {entries.map(([k, v]) => (
            <TreeGridNode key={k} nodeKey={k} data={v} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export function GridTab() {
  const { state, dispatch } = useApp()
  const [leftWidth, setLeftWidth] = useState(50)

  const resizeDragging = useRef(false)
  const resizeStartX = useRef(0)
  const resizeStartWidth = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    resizeDragging.current = true
    resizeStartX.current = e.clientX
    resizeStartWidth.current = leftWidth

    function onMove(ev: MouseEvent) {
      if (!resizeDragging.current || !containerRef.current) return
      const containerWidth = containerRef.current.getBoundingClientRect().width
      const delta = ev.clientX - resizeStartX.current
      const newPct = resizeStartWidth.current + (delta / containerWidth) * 100
      setLeftWidth(Math.max(20, Math.min(80, newPct)))
    }
    function onUp() {
      resizeDragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [leftWidth])

  const parsed = useMemo(() => {
    if (!state.gridRaw.trim()) return { data: null, error: null }
    const result = parseJson(state.gridRaw)
    if (!result.valid) return { data: null, error: result.error }
    return { data: result.parsed, error: null }
  }, [state.gridRaw])

  return (
    <div className="grid-tab" ref={containerRef}>
      {/* Left: JSON editor */}
      <div className="grid-tab__left panel" style={{ width: `${leftWidth}%` }}>
        <div className="panel__header">
          <span className="panel__label">JSON Input</span>
          <div className="flex-row">
            <button
              className="btn btn-ghost"
              style={{ fontSize: 11 }}
              onClick={() => {
                if (state.editorRaw.trim()) {
                  dispatch({ type: 'SET_GRID_RAW', raw: state.editorRaw })
                }
              }}
              title="Copy JSON from Editor tab"
            >
              From Editor
            </button>
            <button
              className="btn btn-ghost"
              style={{ fontSize: 11 }}
              onClick={() => dispatch({ type: 'SET_GRID_RAW', raw: '' })}
            >
              Clear
            </button>
          </div>
        </div>
        <div className="panel__body">
          <JsonTextarea
            value={state.gridRaw}
            onChange={(val) => dispatch({ type: 'SET_GRID_RAW', raw: val })}
            placeholder={'{\n  "menu": {\n    "id": "file",\n    "value": "File"\n  }\n}'}
          />
        </div>
      </div>

      {/* Resize handle */}
      <div className="grid-tab__resize-handle" onMouseDown={onResizeMouseDown} title="Drag to resize" />

      {/* Right: Tree grid */}
      <div className="grid-tab__right panel">
        <div className="panel__header">
          <span className="panel__label">Grid</span>
        </div>
        <div className="panel__body">
          {parsed.error ? (
            <div className="empty-state">
              <div className="empty-state__icon text-error">✗</div>
              <div className="empty-state__title text-error">Invalid JSON</div>
              <div className="text-error mono" style={{ fontSize: 12 }}>{parsed.error}</div>
            </div>
          ) : parsed.data === null ? (
            <div className="empty-state">
              <div className="empty-state__icon">▦</div>
              <div className="empty-state__title">Paste JSON to explore</div>
              <div>Objects and arrays are shown as an interactive tree.</div>
            </div>
          ) : (
            <div className="jtg-root">
              <TreeGridNode nodeKey={null} data={parsed.data} depth={0} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
