import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { JsonTextarea } from '../shared/JsonTextarea'

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

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      runQuery()
    }
  }

  function copyResult(val: unknown, idx: number) {
    navigator.clipboard.writeText(JSON.stringify(val, null, 2)).then(() => {
      setCopiedIdx(idx)
      setTimeout(() => setCopiedIdx(null), 1200)
    })
  }

  const hasResults = state.queryResults !== null
  const resultCount = state.queryResults?.length ?? 0

  return (
    <div className="query-tab">
      {/* Top: JSON input + expression pane */}
      <div className="query-tab__top">
        <div className="query-tab__json-pane">
          <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="panel__header">
              <span className="panel__label">JSON Input</span>
              <div className="flex-row">
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 11 }}
                  onClick={() => {
                    if (state.editorRaw.trim()) {
                      dispatch({ type: 'SET_QUERY_RAW', raw: state.editorRaw })
                    }
                  }}
                  title="Copy JSON from Editor tab"
                >
                  From Editor
                </button>
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

        <div className="query-tab__expr-pane">
          <div className="panel__label">JSONPath expression</div>
          <div className="expr-input-wrap" onKeyDown={handleKeyDown}>
            <input
              className="expr-input"
              value={state.queryExpression}
              onChange={(e) => dispatch({ type: 'SET_QUERY_EXPRESSION', expr: e.target.value })}
              placeholder="$.users[*].name"
              spellCheck={false}
            />
            <button
              className="btn btn-primary"
              onClick={runQuery}
              disabled={!state.queryRaw.trim() || !state.queryExpression.trim()}
            >
              Run
            </button>
          </div>

          <div className="text-xs text-muted">
            Press <kbd style={{ background: 'var(--bg-elevated)', padding: '1px 4px', borderRadius: 3 }}>Ctrl+Enter</kbd> to run
          </div>

          {/* Example queries */}
          <div>
            <div className="panel__label" style={{ marginBottom: 4 }}>Examples</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {EXAMPLE_QUERIES.map((ex) => (
                <button
                  key={ex.expr}
                  className="btn btn-ghost"
                  style={{ justifyContent: 'flex-start', fontSize: 11.5 }}
                  onClick={() => dispatch({ type: 'SET_QUERY_EXPRESSION', expr: ex.expr })}
                >
                  <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{ex.expr}</span>
                  <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>{ex.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

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
