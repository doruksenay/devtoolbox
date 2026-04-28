import { useState, useMemo, useRef, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { JsonTextarea } from '../shared/JsonTextarea'
import { TreeView } from '../Tree/TreeView'
import { computeJsonDiff } from '../../utils/jsonDiff'

type PanelMode = 'text' | 'tree'

// Delay before scrolling to a diff so that CollapsibleNode useEffect hooks
// have time to auto-expand the relevant tree nodes first.
const SCROLL_TO_DIFF_DELAY_MS = 100

export function CompareTab() {
  const { state, dispatch, runCompare } = useApp()
  const [treeKey, setTreeKey] = useState(0)
  const [treeForceOpen, setTreeForceOpen] = useState<boolean | undefined>(undefined)
  const [diffIndex, setDiffIndex] = useState(0)
  const leftPaneRef = useRef<HTMLDivElement>(null)
  const rightPaneRef = useRef<HTMLDivElement>(null)
  const [leftMode, setLeftMode] = useState<PanelMode>('text')
  const [rightMode, setRightMode] = useState<PanelMode>('text')
  const hasAutoSwitched = useRef(false)

  const hasResults =
    state.compareEqual !== null &&
    state.compareLeftParsed !== null &&
    state.compareRightParsed !== null

  // Auto-compare with debounce whenever both sides have content
  useEffect(() => {
    if (!state.compareLeft.trim() || !state.compareRight.trim()) return
    const timer = setTimeout(runCompare, 400)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.compareLeft, state.compareRight])

  // Auto-switch to tree mode on first successful compare
  useEffect(() => {
    if (hasResults && !hasAutoSwitched.current) {
      hasAutoSwitched.current = true
      setLeftMode('tree')
      setRightMode('tree')
    }
  }, [hasResults])

  // Compute diffs for highlighting
  const { leftDiffs, rightDiffs } = useMemo(() => {
    if (!hasResults) return { leftDiffs: null, rightDiffs: null }
    const leftDiffs = computeJsonDiff(state.compareLeftParsed, state.compareRightParsed, '$')
    const rightDiffs = computeJsonDiff(state.compareRightParsed, state.compareLeftParsed, '$')
    return { leftDiffs, rightDiffs }
  }, [hasResults, state.compareLeftParsed, state.compareRightParsed])

  // Collect distinct diff paths (sorted for navigation)
  const diffPaths = useMemo(() => {
    if (!leftDiffs) return []
    return Array.from(leftDiffs.keys()).sort()
  }, [leftDiffs])

  const totalDiffs = diffPaths.length

  function scrollToDiff(idx: number) {
    const path = diffPaths[idx]
    if (!path) return
    // Wait for React to re-render (nodes auto-expand via useEffect) before scrolling
    setTimeout(() => {
      for (const paneRef of [leftPaneRef, rightPaneRef]) {
        const el = paneRef.current?.querySelector(`[data-diff-path="${CSS.escape(path)}"]`)
        if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
    }, SCROLL_TO_DIFF_DELAY_MS)
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

  function handleExpandAll() {
    setTreeForceOpen(true)
    setTreeKey((k) => k + 1)
  }

  function handleCollapseAll() {
    setTreeForceOpen(false)
    setTreeKey((k) => k + 1)
  }

  function handleClearAll() {
    dispatch({ type: 'CLEAR_COMPARE' })
    hasAutoSwitched.current = false
    setLeftMode('text')
    setRightMode('text')
    setDiffIndex(0)
  }

  return (
    <div className="compare-tab">
      {/* Toolbar */}
      <div className="toolbar" style={{ flexShrink: 0 }}>
        <button className="btn btn-ghost" onClick={handleClearAll}>
          Clear all
        </button>

        {hasResults && (
          <>
            <div className="toolbar-sep" />
            <span
              className={`status-badge ${state.compareEqual ? 'status-badge--equal' : 'status-badge--notequal'}`}
            >
              {state.compareEqual ? '✓ Equal' : `⇄ ${totalDiffs} difference${totalDiffs !== 1 ? 's' : ''}`}
            </span>
            {!state.compareEqual && totalDiffs > 0 && (
              <div className="compare-nav">
                <button className="compare-nav__btn" onClick={handlePrevDiff} title="Previous difference">‹</button>
                <span className="compare-nav__count">{diffIndex + 1} / {totalDiffs}</span>
                <button className="compare-nav__btn" onClick={handleNextDiff} title="Next difference">›</button>
              </div>
            )}
            <button className="btn btn-ghost" onClick={handleExpandAll}>
              Expand All
            </button>
            <button className="btn btn-ghost" onClick={handleCollapseAll}>
              Collapse All
            </button>
          </>
        )}
        {state.compareError && (
          <span className="status-badge status-badge--invalid">✗ {state.compareError}</span>
        )}
      </div>

      {/* Side-by-side panels */}
      <div className="compare-tab__trees">
        {/* Left panel */}
        <div className="compare-tab__pane panel">
          <div className="panel__header">
            <span className="panel__label">Left JSON</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div className="compare-mode-toggle">
                <button
                  className={`compare-mode-toggle__btn${leftMode === 'text' ? ' compare-mode-toggle__btn--active' : ''}`}
                  onClick={() => setLeftMode('text')}
                >text</button>
                <button
                  className={`compare-mode-toggle__btn${leftMode === 'tree' ? ' compare-mode-toggle__btn--active' : ''}`}
                  onClick={() => setLeftMode('tree')}
                  disabled={!hasResults}
                >tree</button>
              </div>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 11 }}
                onClick={() => dispatch({ type: 'SET_COMPARE_LEFT', raw: '' })}
              >
                Clear
              </button>
            </div>
          </div>
          <div className="panel__body" ref={leftPaneRef}>
            {leftMode === 'text' ? (
              <JsonTextarea
                value={state.compareLeft}
                onChange={(val) => dispatch({ type: 'SET_COMPARE_LEFT', raw: val })}
                placeholder="Paste left JSON..."
              />
            ) : hasResults ? (
              <TreeView key={`left-${treeKey}`} data={state.compareLeftParsed} forceOpen={treeForceOpen} diffs={leftDiffs} activeDiffPath={diffPaths[diffIndex]} />
            ) : (
              <div className="empty-state">
                <div className="empty-state__icon">{ '{ }' }</div>
                <div className="empty-state__title">No data yet</div>
                <div>Switch to text mode and paste JSON</div>
              </div>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="compare-tab__pane panel">
          <div className="panel__header">
            <span className="panel__label">Right JSON</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div className="compare-mode-toggle">
                <button
                  className={`compare-mode-toggle__btn${rightMode === 'text' ? ' compare-mode-toggle__btn--active' : ''}`}
                  onClick={() => setRightMode('text')}
                >text</button>
                <button
                  className={`compare-mode-toggle__btn${rightMode === 'tree' ? ' compare-mode-toggle__btn--active' : ''}`}
                  onClick={() => setRightMode('tree')}
                  disabled={!hasResults}
                >tree</button>
              </div>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 11 }}
                onClick={() => dispatch({ type: 'SET_COMPARE_RIGHT', raw: '' })}
              >
                Clear
              </button>
            </div>
          </div>
          <div className="panel__body" ref={rightPaneRef}>
            {rightMode === 'text' ? (
              <JsonTextarea
                value={state.compareRight}
                onChange={(val) => dispatch({ type: 'SET_COMPARE_RIGHT', raw: val })}
                placeholder="Paste right JSON..."
              />
            ) : hasResults ? (
              <TreeView key={`right-${treeKey}`} data={state.compareRightParsed} forceOpen={treeForceOpen} diffs={rightDiffs} activeDiffPath={diffPaths[diffIndex]} />
            ) : state.compareError ? (
              <div className="empty-state">
                <div className="empty-state__icon text-error">✗</div>
                <div className="empty-state__title text-error">Compare failed</div>
                <div className="text-error mono" style={{ fontSize: 12 }}>{state.compareError}</div>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state__icon">{ '{ }' }</div>
                <div className="empty-state__title">No data yet</div>
                <div>Switch to text mode and paste JSON</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
