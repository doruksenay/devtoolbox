import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { JsonTextarea } from '../shared/JsonTextarea'

export function CompareTab() {
  const { state, dispatch, runCompare } = useApp()
  const [copiedLabel, setCopiedLabel] = useState('Export diff')

  function handleExport() {
    if (!state.compareLines) return
    const text = state.compareLines
      .map((l) => `${l.type === 'added' ? '+' : l.type === 'removed' ? '-' : ' '} ${l.value}`)
      .join('\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopiedLabel('Copied!')
      setTimeout(() => setCopiedLabel('Export diff'), 1500)
    })
  }

  const hasResults = state.compareLines !== null

  return (
    <div className="compare-tab">
      {/* Two JSON inputs */}
      <div className="compare-tab__inputs">
        <div className="compare-tab__pane">
          <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="panel__header">
              <span className="panel__label">Left (original)</span>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 11 }}
                onClick={() => dispatch({ type: 'SET_COMPARE_LEFT', raw: '' })}
              >
                Clear
              </button>
            </div>
            <div className="panel__body">
              <JsonTextarea
                value={state.compareLeft}
                onChange={(val) => dispatch({ type: 'SET_COMPARE_LEFT', raw: val })}
                placeholder="Paste original JSON..."
              />
            </div>
          </div>
        </div>

        <div className="compare-tab__pane">
          <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="panel__header">
              <span className="panel__label">Right (modified)</span>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 11 }}
                onClick={() => dispatch({ type: 'SET_COMPARE_RIGHT', raw: '' })}
              >
                Clear
              </button>
            </div>
            <div className="panel__body">
              <JsonTextarea
                value={state.compareRight}
                onChange={(val) => dispatch({ type: 'SET_COMPARE_RIGHT', raw: val })}
                placeholder="Paste modified JSON..."
              />
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar" style={{ flexShrink: 0 }}>
        <button
          className="btn btn-primary"
          onClick={runCompare}
          disabled={!state.compareLeft.trim() || !state.compareRight.trim()}
        >
          Compare ⇄
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => dispatch({ type: 'CLEAR_COMPARE' })}
        >
          Clear all
        </button>

        {hasResults && (
          <>
            <div className="toolbar-sep" />
            <span
              className={`status-badge ${state.compareEqual ? 'status-badge--equal' : 'status-badge--notequal'}`}
            >
              {state.compareEqual ? '✓ Equal' : '⇄ Differences found'}
            </span>
            <button className="btn btn-ghost" onClick={handleExport}>
              {copiedLabel}
            </button>
          </>
        )}
        {state.compareError && (
          <span className="status-badge status-badge--invalid">✗ {state.compareError}</span>
        )}
      </div>

      {/* Diff result */}
      <div className="compare-tab__result panel">
        <div className="panel__header">
          <span className="panel__label">Diff</span>
          {hasResults && (
            <span className="text-xs text-muted">
              {state.compareLines!.filter((l) => l.type !== 'unchanged').length} changed lines
            </span>
          )}
        </div>
        <div className="panel__body">
          {!hasResults && !state.compareError && (
            <div className="empty-state">
              <div className="empty-state__icon">⇄</div>
              <div className="empty-state__title">Nothing to compare yet</div>
              <div>Paste JSON in both panels and click Compare</div>
            </div>
          )}
          {state.compareError && !hasResults && (
            <div className="empty-state">
              <div className="empty-state__icon text-error">✗</div>
              <div className="empty-state__title text-error">Compare failed</div>
              <div className="text-error mono" style={{ fontSize: 12 }}>{state.compareError}</div>
            </div>
          )}
          {hasResults && (
            <div className="diff-view">
              {state.compareLines!.map((line, i) => (
                <div key={i} className={`diff-line diff-line--${line.type}`}>
                  <span className="diff-line__gutter">
                    {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                  </span>
                  {line.value}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
