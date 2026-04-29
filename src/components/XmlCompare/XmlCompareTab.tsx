import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { XmlCodeEditor } from '../shared/XmlCodeEditor'

export function XmlCompareTab() {
  const { state, dispatch, runXmlCompare } = useApp()
  const leftFileRef = useRef<HTMLInputElement>(null)
  const rightFileRef = useRef<HTMLInputElement>(null)
  const [diffIndex, setDiffIndex] = useState(0)
  const diffResultRef = useRef<HTMLDivElement>(null)

  const hasLeft = state.xmlCompareLeft.trim().length > 0
  const hasRight = state.xmlCompareRight.trim().length > 0
  const hasResult = state.xmlCompareLines !== null

  // Auto-compare with debounce
  useEffect(() => {
    if (!hasLeft && !hasRight) return
    const timer = setTimeout(runXmlCompare, 500)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.xmlCompareLeft, state.xmlCompareRight])

  // Count diffs
  const diffLineIndexes = (state.xmlCompareLines ?? [])
    .map((l, i) => (l.type !== 'unchanged' ? i : -1))
    .filter((i) => i !== -1)
  const totalDiffs = diffLineIndexes.length

  function scrollToDiff(idx: number) {
    const lineIdx = diffLineIndexes[idx]
    if (lineIdx == null || !diffResultRef.current) return
    const el = diffResultRef.current.querySelector(`[data-line-index="${lineIdx}"]`)
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  function handlePrevDiff() {
    const next = (diffIndex - 1 + totalDiffs) % totalDiffs
    setDiffIndex(next)
    scrollToDiff(next)
  }

  function handleNextDiff() {
    const next = (diffIndex + 1) % totalDiffs
    setDiffIndex(next)
    scrollToDiff(next)
  }

  function handleClearAll() {
    dispatch({ type: 'CLEAR_XML_COMPARE' })
    setDiffIndex(0)
  }

  function handleFileUpload(side: 'left' | 'right', e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      if (side === 'left') {
        dispatch({ type: 'SET_XML_COMPARE_LEFT', raw: text })
      } else {
        dispatch({ type: 'SET_XML_COMPARE_RIGHT', raw: text })
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="xml-compare-tab">
      {/* Toolbar */}
      <div className="toolbar" style={{ flexShrink: 0 }}>
        <button className="btn btn-ghost" onClick={handleClearAll}>
          Clear all
        </button>

        {hasResult && (
          <>
            <div className="toolbar-sep" />
            <span
              className={`status-badge ${state.xmlCompareEqual ? 'status-badge--equal' : 'status-badge--notequal'}`}
            >
              {state.xmlCompareEqual
                ? '✓ Identical'
                : `⇄ ${totalDiffs} change${totalDiffs !== 1 ? 's' : ''}`}
            </span>
            {!state.xmlCompareEqual && totalDiffs > 0 && (
              <div className="compare-nav">
                <button className="compare-nav__btn" onClick={handlePrevDiff} title="Previous change">
                  ‹
                </button>
                <span className="compare-nav__count">
                  {diffIndex + 1} / {totalDiffs}
                </span>
                <button className="compare-nav__btn" onClick={handleNextDiff} title="Next change">
                  ›
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Editors */}
      <div className="xml-compare-tab__editors">
        {/* Left panel */}
        <div className="xml-compare-tab__pane panel">
          <div className="panel__header">
            <span className="panel__label">Left XML</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 11 }}
                onClick={() => leftFileRef.current?.click()}
              >
                Upload
              </button>
              <input
                ref={leftFileRef}
                type="file"
                accept=".xml,application/xml,text/xml,text/plain"
                style={{ display: 'none' }}
                onChange={(e) => handleFileUpload('left', e)}
              />
              <button
                className="btn btn-ghost"
                style={{ fontSize: 11 }}
                onClick={() => dispatch({ type: 'SET_XML_COMPARE_LEFT', raw: '' })}
                disabled={!hasLeft}
              >
                Clear
              </button>
            </div>
          </div>
          <div className="panel__body">
            <XmlCodeEditor
              value={state.xmlCompareLeft}
              onChange={(val) => dispatch({ type: 'SET_XML_COMPARE_LEFT', raw: val })}
              theme={state.theme}
            />
          </div>
        </div>

        {/* Right panel */}
        <div className="xml-compare-tab__pane panel">
          <div className="panel__header">
            <span className="panel__label">Right XML</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 11 }}
                onClick={() => rightFileRef.current?.click()}
              >
                Upload
              </button>
              <input
                ref={rightFileRef}
                type="file"
                accept=".xml,application/xml,text/xml,text/plain"
                style={{ display: 'none' }}
                onChange={(e) => handleFileUpload('right', e)}
              />
              <button
                className="btn btn-ghost"
                style={{ fontSize: 11 }}
                onClick={() => dispatch({ type: 'SET_XML_COMPARE_RIGHT', raw: '' })}
                disabled={!hasRight}
              >
                Clear
              </button>
            </div>
          </div>
          <div className="panel__body">
            <XmlCodeEditor
              value={state.xmlCompareRight}
              onChange={(val) => dispatch({ type: 'SET_XML_COMPARE_RIGHT', raw: val })}
              theme={state.theme}
            />
          </div>
        </div>
      </div>

      {/* Diff result */}
      {hasResult && (
        <div className="xml-compare-tab__result panel">
          <div className="panel__header">
            <span className="panel__label">Diff</span>
            {!state.xmlCompareEqual && (
              <span className="text-xs text-muted">
                {state.xmlCompareLines?.filter((l) => l.type === 'added').length} added ·{' '}
                {state.xmlCompareLines?.filter((l) => l.type === 'removed').length} removed
              </span>
            )}
          </div>
          <div className="panel__body" ref={diffResultRef}>
            {state.xmlCompareEqual ? (
              <div className="empty-state">
                <div className="empty-state__icon" style={{ color: 'var(--success)' }}>✓</div>
                <div className="empty-state__title" style={{ color: 'var(--success)' }}>
                  Files are identical
                </div>
              </div>
            ) : (
              <div className="xml-diff-lines">
                {(state.xmlCompareLines ?? []).map((line, i) => (
                  <div
                    key={i}
                    data-line-index={i}
                    className={`xml-diff-line xml-diff-line--${line.type}${
                      diffLineIndexes[diffIndex] === i ? ' xml-diff-line--active' : ''
                    }`}
                  >
                    <span className="xml-diff-line__marker">
                      {line.type === 'added' ? '+' : line.type === 'removed' ? '−' : ' '}
                    </span>
                    <span className="xml-diff-line__content">{line.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
