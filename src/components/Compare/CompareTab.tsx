import { useState, useMemo, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import { JsonTextarea } from '../shared/JsonTextarea'
import { TreeView } from '../Tree/TreeView'
import { computeJsonDiff } from '../../utils/jsonDiff'

export function CompareTab() {
  const { state, dispatch, runCompare } = useApp()
  const [treeKey, setTreeKey] = useState(0)
  const [treeForceOpen, setTreeForceOpen] = useState<boolean | undefined>(undefined)
  const [diffIndex, setDiffIndex] = useState(0)
  const leftPaneRef = useRef<HTMLDivElement>(null)
  const rightPaneRef = useRef<HTMLDivElement>(null)

  const hasResults =
    state.compareEqual !== null &&
    state.compareLeftParsed !== null &&
    state.compareRightParsed !== null

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
    // Find elements with data-diff-path matching this path in both panes
    for (const paneRef of [leftPaneRef, rightPaneRef]) {
      const el = paneRef.current?.querySelector(`[data-diff-path="${CSS.escape(path)}"]`)
      if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
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

      {/* Side-by-side tree compare */}
      <div className="compare-tab__trees">
        <div className="compare-tab__pane panel">
          <div className="panel__header">
            <span className="panel__label">Left Tree</span>
          </div>
          <div className="panel__body" ref={leftPaneRef}>
            {hasResults ? (
              <TreeView key={`left-${treeKey}`} data={state.compareLeftParsed} forceOpen={treeForceOpen} diffs={leftDiffs} activeDiffPath={diffPaths[diffIndex]} />
            ) : (
              <div className="empty-state">
                <div className="empty-state__icon">{ '{ }' }</div>
                <div className="empty-state__title">Left tree is not ready</div>
                <div>Run Compare to render tree view</div>
              </div>
            )}
          </div>
        </div>

        <div className="compare-tab__pane panel">
          <div className="panel__header">
            <span className="panel__label">Right Tree</span>
          </div>
          <div className="panel__body" ref={rightPaneRef}>
            {hasResults ? (
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
                <div className="empty-state__title">Right tree is not ready</div>
                <div>Run Compare to render side-by-side tree view</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
