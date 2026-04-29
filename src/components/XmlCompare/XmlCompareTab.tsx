import { useEffect, useRef, useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { XmlCodeEditor } from '../shared/XmlCodeEditor'
import type { DiffLine } from '../../types'

type PanelMode = 'text' | 'diff'

interface SideBySideRow {
  leftLine: string | null
  leftType: 'unchanged' | 'removed' | 'empty'
  rightLine: string | null
  rightType: 'unchanged' | 'added' | 'empty'
  isChange: boolean
}

function buildSideBySide(lines: DiffLine[]): SideBySideRow[] {
  const rows: SideBySideRow[] = []
  let i = 0
  while (i < lines.length) {
    if (lines[i].type === 'unchanged') {
      rows.push({
        leftLine: lines[i].value,
        leftType: 'unchanged',
        rightLine: lines[i].value,
        rightType: 'unchanged',
        isChange: false,
      })
      i++
    } else {
      // Collect a block of removed lines then added lines
      const removed: string[] = []
      while (i < lines.length && lines[i].type === 'removed') {
        removed.push(lines[i].value)
        i++
      }
      const added: string[] = []
      while (i < lines.length && lines[i].type === 'added') {
        added.push(lines[i].value)
        i++
      }
      const maxLen = Math.max(removed.length, added.length)
      for (let j = 0; j < maxLen; j++) {
        rows.push({
          leftLine: j < removed.length ? removed[j] : null,
          leftType: j < removed.length ? 'removed' : 'empty',
          rightLine: j < added.length ? added[j] : null,
          rightType: j < added.length ? 'added' : 'empty',
          isChange: true,
        })
      }
    }
  }
  return rows
}

export function XmlCompareTab() {
  const { state, dispatch, runXmlCompare } = useApp()
  const leftFileRef = useRef<HTMLInputElement>(null)
  const rightFileRef = useRef<HTMLInputElement>(null)
  const [diffIndex, setDiffIndex] = useState(0)
  const [leftMode, setLeftMode] = useState<PanelMode>('text')
  const [rightMode, setRightMode] = useState<PanelMode>('text')
  const hasAutoSwitched = useRef(false)
  const leftDiffRef = useRef<HTMLDivElement>(null)
  const rightDiffRef = useRef<HTMLDivElement>(null)
  const isSyncingScroll = useRef(false)

  const hasLeft = state.xmlCompareLeft.trim().length > 0
  const hasRight = state.xmlCompareRight.trim().length > 0
  const hasResult = state.xmlCompareLines !== null

  const sideBySideRows = useMemo(
    () => (state.xmlCompareLines ? buildSideBySide(state.xmlCompareLines) : []),
    [state.xmlCompareLines],
  )

  const changeRowIndexes = useMemo(
    () => sideBySideRows.map((r, i) => (r.isChange ? i : -1)).filter((i) => i !== -1),
    [sideBySideRows],
  )
  const totalDiffs = changeRowIndexes.length

  // Auto-compare with debounce
  useEffect(() => {
    if (!hasLeft && !hasRight) return
    const timer = setTimeout(runXmlCompare, 500)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.xmlCompareLeft, state.xmlCompareRight])

  // Auto-switch to diff mode on first successful compare
  useEffect(() => {
    if (hasResult && !hasAutoSwitched.current) {
      hasAutoSwitched.current = true
      setLeftMode('diff')
      setRightMode('diff')
    }
  }, [hasResult])

  function handleLeftDiffScroll() {
    if (isSyncingScroll.current || !rightDiffRef.current || !leftDiffRef.current) return
    isSyncingScroll.current = true
    rightDiffRef.current.scrollTop = leftDiffRef.current.scrollTop
    isSyncingScroll.current = false
  }

  function handleRightDiffScroll() {
    if (isSyncingScroll.current || !leftDiffRef.current || !rightDiffRef.current) return
    isSyncingScroll.current = true
    leftDiffRef.current.scrollTop = rightDiffRef.current.scrollTop
    isSyncingScroll.current = false
  }

  function scrollToDiffRow(idx: number) {
    const rowIdx = changeRowIndexes[idx]
    if (rowIdx == null) return
    setTimeout(() => {
      for (const ref of [leftDiffRef, rightDiffRef]) {
        const el = ref.current?.querySelector(`[data-row="${rowIdx}"]`) as HTMLElement | null
        if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
    }, 50)
  }

  function handlePrevDiff() {
    const next = (diffIndex - 1 + totalDiffs) % totalDiffs
    setDiffIndex(next)
    scrollToDiffRow(next)
  }

  function handleNextDiff() {
    const next = (diffIndex + 1) % totalDiffs
    setDiffIndex(next)
    scrollToDiffRow(next)
  }

  function handleClearAll() {
    dispatch({ type: 'CLEAR_XML_COMPARE' })
    setDiffIndex(0)
    hasAutoSwitched.current = false
    setLeftMode('text')
    setRightMode('text')
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

      {/* Side-by-side panels */}
      <div className="xml-compare-tab__editors">
        {/* Left panel */}
        <div className="xml-compare-tab__pane panel">
          <div className="panel__header">
            <span className="panel__label">Left XML</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {hasResult && (
                <div className="compare-mode-toggle">
                  <button
                    className={`compare-mode-toggle__btn${leftMode === 'text' ? ' compare-mode-toggle__btn--active' : ''}`}
                    onClick={() => setLeftMode('text')}
                  >
                    text
                  </button>
                  <button
                    className={`compare-mode-toggle__btn${leftMode === 'diff' ? ' compare-mode-toggle__btn--active' : ''}`}
                    onClick={() => setLeftMode('diff')}
                  >
                    diff
                  </button>
                </div>
              )}
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
            {leftMode === 'text' ? (
              <XmlCodeEditor
                value={state.xmlCompareLeft}
                onChange={(val) => dispatch({ type: 'SET_XML_COMPARE_LEFT', raw: val })}
                theme={state.theme}
              />
            ) : state.xmlCompareEqual ? (
              <div className="empty-state">
                <div className="empty-state__icon" style={{ color: 'var(--success)' }}>
                  ✓
                </div>
                <div className="empty-state__title" style={{ color: 'var(--success)' }}>
                  Files are identical
                </div>
              </div>
            ) : (
              <div className="xml-sbs-pane" ref={leftDiffRef} onScroll={handleLeftDiffScroll}>
                {sideBySideRows.map((row, i) => (
                  <div
                    key={i}
                    data-row={i}
                    className={`xml-sbs-row xml-sbs-row--${row.leftType}${changeRowIndexes[diffIndex] === i ? ' xml-sbs-row--active' : ''}`}
                  >
                    <span className="xml-sbs-row__marker">
                      {row.leftType === 'removed' ? '−' : ' '}
                    </span>
                    <span className="xml-sbs-row__content">{row.leftLine ?? ''}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="xml-compare-tab__pane panel">
          <div className="panel__header">
            <span className="panel__label">Right XML</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {hasResult && (
                <div className="compare-mode-toggle">
                  <button
                    className={`compare-mode-toggle__btn${rightMode === 'text' ? ' compare-mode-toggle__btn--active' : ''}`}
                    onClick={() => setRightMode('text')}
                  >
                    text
                  </button>
                  <button
                    className={`compare-mode-toggle__btn${rightMode === 'diff' ? ' compare-mode-toggle__btn--active' : ''}`}
                    onClick={() => setRightMode('diff')}
                  >
                    diff
                  </button>
                </div>
              )}
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
            {rightMode === 'text' ? (
              <XmlCodeEditor
                value={state.xmlCompareRight}
                onChange={(val) => dispatch({ type: 'SET_XML_COMPARE_RIGHT', raw: val })}
                theme={state.theme}
              />
            ) : state.xmlCompareEqual ? (
              <div className="empty-state">
                <div className="empty-state__icon" style={{ color: 'var(--success)' }}>
                  ✓
                </div>
                <div className="empty-state__title" style={{ color: 'var(--success)' }}>
                  Files are identical
                </div>
              </div>
            ) : (
              <div className="xml-sbs-pane" ref={rightDiffRef} onScroll={handleRightDiffScroll}>
                {sideBySideRows.map((row, i) => (
                  <div
                    key={i}
                    data-row={i}
                    className={`xml-sbs-row xml-sbs-row--${row.rightType}${changeRowIndexes[diffIndex] === i ? ' xml-sbs-row--active' : ''}`}
                  >
                    <span className="xml-sbs-row__marker">
                      {row.rightType === 'added' ? '+' : ' '}
                    </span>
                    <span className="xml-sbs-row__content">{row.rightLine ?? ''}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
