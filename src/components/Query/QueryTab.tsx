import { useState, useRef, useCallback } from 'react'
import { useApp } from '../../context/AppContext'
import { JsonTextarea } from '../shared/JsonTextarea'
import { FromEditorButton } from '../shared/FromEditorButton'

const EXAMPLE_QUERIES = [
  { expr: '$..*', label: 'All values (deep)' },
  { expr: '$[*]', label: 'Top-level items' },
  { expr: '$..id', label: 'All id fields' },
  { expr: '$.users[*].name', label: 'User names' },
  { expr: '$.orders[?(@.status=="ACTIVE")]', label: 'Active orders' },
]

export function QueryTab() {
  const { state, dispatch, runQuery } = useApp()
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [copiedAll, setCopiedAll] = useState(false)
  const [exprWidth, setExprWidth] = useState(320)
  const [topHeight, setTopHeight] = useState(220)

  const topRef = useRef<HTMLDivElement>(null)

  // Horizontal resize (JSON pane ↔ expr pane)
  const hResizeDragging = useRef(false)
  const hResizeStartX = useRef(0)
  const hResizeStartW = useRef(0)

  const onHResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    hResizeDragging.current = true
    hResizeStartX.current = e.clientX
    hResizeStartW.current = exprWidth

    function onMove(ev: MouseEvent) {
      if (!hResizeDragging.current) return
      const delta = hResizeStartX.current - ev.clientX
      setExprWidth(Math.max(240, Math.min(520, hResizeStartW.current + delta)))
    }
    function onUp() {
      hResizeDragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [exprWidth])

  // Vertical resize (top pane ↔ results)
  const vResizeDragging = useRef(false)
  const vResizeStartY = useRef(0)
  const vResizeStartH = useRef(0)

  const onVResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    vResizeDragging.current = true
    vResizeStartY.current = e.clientY
    vResizeStartH.current = topHeight

    function onMove(ev: MouseEvent) {
      if (!vResizeDragging.current) return
      const delta = ev.clientY - vResizeStartY.current
      setTopHeight(Math.max(120, Math.min(520, vResizeStartH.current + delta)))
    }
    function onUp() {
      vResizeDragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [topHeight])

  // Keyboard equivalents for the drag handles: the panes stay resizable
  // without a pointer. Steps match the drag clamps above.
  const onHResizeKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const delta = e.key === 'ArrowLeft' ? 20 : -20
    setExprWidth(w => Math.max(240, Math.min(520, w + delta)))
  }, [])

  const onVResizeKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    const delta = e.key === 'ArrowDown' ? 20 : -20
    setTopHeight(h => Math.max(120, Math.min(520, h + delta)))
  }, [])

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      runQuery()
    }
  }

  function formatValue(val: unknown): string {
    if (val === null) return 'null'
    return typeof val === 'object' ? JSON.stringify(val) : String(val)
  }

  function copyResult(val: unknown, idx: number) {
    navigator.clipboard.writeText(JSON.stringify(val, null, 2)).then(() => {
      setCopiedIdx(idx)
      setTimeout(() => setCopiedIdx(null), 1200)
    })
  }

  function copyAllResults() {
    const results = state.queryResults
    if (!results || results.length === 0) return
    const joined = results.map(formatValue).join(', ')
    navigator.clipboard.writeText(joined).then(() => {
      setCopiedAll(true)
      setTimeout(() => setCopiedAll(false), 1200)
    })
  }

  const hasResults = state.queryResults !== null
  const resultCount = state.queryResults?.length ?? 0

  return (
    <div className="query-tab">
      {/* Top: JSON input + expression pane */}
      <div className="query-tab__top" ref={topRef} style={{ height: topHeight }}>
        <div className="query-tab__json-pane">
          <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="panel__header">
              <span className="panel__label">JSON Input</span>
              <div className="flex-row">
                <FromEditorButton
                  onPick={(raw) => dispatch({ type: 'SET_QUERY_RAW', raw })}
                />
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 11 }}
                  onClick={() => dispatch({ type: 'SET_QUERY_RAW', raw: '' })}
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="panel__body">
              <JsonTextarea
                value={state.queryRaw}
                onChange={(val) => dispatch({ type: 'SET_QUERY_RAW', raw: val })}
              />
            </div>
          </div>
        </div>

        {/* Horizontal resize handle */}
        <div
          className="query-tab__h-resize-handle"
          onMouseDown={onHResizeMouseDown}
          onKeyDown={onHResizeKeyDown}
          title="Drag to resize"
          role="slider"
          aria-orientation="vertical"
          aria-label="Resize the expression pane"
          aria-valuenow={exprWidth}
          aria-valuemin={240}
          aria-valuemax={520}
          tabIndex={0}
        />

        <div className="query-tab__expr-pane" style={{ width: exprWidth }}>
          <div className="panel__label" style={{ marginBottom: 8 }} id="query-expr-label">JSONPath Expression</div>
          {/* Ctrl+Enter lives on the two focusable controls rather than on the
              wrapper, so the shortcut keeps working without a static element
              owning keyboard events. */}
          <div className="expr-input-wrap">
            <input
              className="expr-input"
              value={state.queryExpression}
              onChange={(e) => dispatch({ type: 'SET_QUERY_EXPRESSION', expr: e.target.value })}
              onKeyDown={handleKeyDown}
              placeholder="$.users[*].name"
              spellCheck={false}
              aria-labelledby="query-expr-label"
            />
            <button
              className="btn btn-primary"
              onClick={runQuery}
              onKeyDown={handleKeyDown}
              disabled={!state.queryRaw.trim() || !state.queryExpression.trim()}
            >
              Run
            </button>
          </div>

          <div className="expr-hint-row">
            <div className="text-xs text-muted">
              Press <kbd style={{ background: 'var(--bg-elevated)', padding: '2px 5px', borderRadius: 3, fontSize: '0.9em' }}>Ctrl+Enter</kbd> to run
            </div>
            <button
              className="btn btn-ghost"
              style={{ fontSize: 11 }}
              onClick={copyAllResults}
              disabled={!hasResults || resultCount === 0}
              title="Copy all matched values, comma separated"
            >
              {copiedAll ? 'Copied!' : 'Copy All'}
            </button>
          </div>

          {/* Example queries */}
          <div>
            <div className="panel__label" style={{ marginBottom: 8 }}>Examples</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {EXAMPLE_QUERIES.map((ex) => (
                <button
                  key={ex.expr}
                  className="btn btn-ghost query-example-btn"
                  onClick={() => dispatch({ type: 'SET_QUERY_EXPRESSION', expr: ex.expr })}
                >
                  <span className="query-example-btn__expr">{ex.expr}</span>
                  <span className="query-example-btn__label">{ex.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Vertical resize handle */}
      <div
        className="query-tab__v-resize-handle"
        onMouseDown={onVResizeMouseDown}
        onKeyDown={onVResizeKeyDown}
        title="Drag to resize"
        role="slider"
        aria-orientation="horizontal"
        aria-label="Resize the results pane"
        aria-valuenow={topHeight}
        aria-valuemin={120}
        aria-valuemax={520}
        tabIndex={0}
      />

      {/* Results */}
      <div className="query-tab__results panel">
        <div className="panel__header">
          <span className="panel__label">Results</span>
          {hasResults && (
            <span className="status-badge status-badge--info">
              {resultCount} {resultCount === 1 ? 'match' : 'matches'}
            </span>
          )}
        </div>
        <div className="panel__body">
          {state.queryRunError && (
            <div className="empty-state">
              <div className="empty-state__icon text-error">✗</div>
              <div className="empty-state__title text-error">Query failed</div>
              <div className="text-error mono" style={{ fontSize: 12 }}>{state.queryRunError}</div>
            </div>
          )}

          {!hasResults && !state.queryRunError && (
            <div className="empty-state">
              <div className="empty-state__icon">⌕</div>
              <div className="empty-state__title">No query run yet</div>
              <div>Paste JSON, enter a JSONPath expression, and click Run</div>
            </div>
          )}

          {hasResults && resultCount === 0 && (
            <div className="empty-state">
              <div className="empty-state__title">No matches</div>
              <div>The expression matched nothing. Try a different path.</div>
            </div>
          )}

          {hasResults && resultCount > 0 && (
            <div className="result-list">
              {state.queryResults!.map((val, i) => (
                <div key={i} className="result-item">
                  <div className="result-item__path">
                    {state.queryPaths?.[i] ?? `[${i}]`}
                    <button
                      className="btn btn-ghost"
                      style={{ padding: '1px 6px', fontSize: 10, marginLeft: 8 }}
                      onClick={() => copyResult(val, i)}
                    >
                      {copiedIdx === i ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="result-item__value">
                    {typeof val === 'object'
                      ? JSON.stringify(val, null, 2)
                      : val === null
                        ? 'null'
                        : String(val)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
