import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { JsonTextarea } from '../shared/JsonTextarea'
import type { CodeEditorApi } from '../shared/CodeEditor'
import { FromEditorButton } from '../shared/FromEditorButton'
import { useToast } from '../Toast/ToastProvider'
import { useWorkerParse } from '../../hooks/useWorkerParse'
import { computeTreeMatches } from '../../utils/treeSearch'
import { locatePath } from '../../utils/jsonLocate'
import { toCsv, downloadCsv } from '../../utils/csv'
import { parseCsv } from '../../utils/csvImport'
import { checkFileSize, MAX_TEXT_FILE_BYTES } from '../../utils/limits'
import type { PathSegment } from '../../utils/jsonEdit'
import { setAtPath, deleteAtPath, valueToCopyText } from '../../utils/jsonEdit'
import type { ExpansionState, TableView } from './gridModel'
import { initialExpansion, setExpanded, setExpansionMode, pathToBreadcrumb } from './gridModel'
import { GridNode, type GridContext } from './GridNode'

/**
 * Parsing every keystroke re-walked the whole document; this lets a burst of
 * typing settle first. Large payloads then go through the worker so the main
 * thread keeps up.
 */
const PARSE_DEBOUNCE_MS = 250

interface ParsedState {
  data: unknown
  error: string | null
}

export function GridTab() {
  const { state, dispatch } = useApp()
  const { addToast } = useToast()
  const { parse } = useWorkerParse()

  const [leftWidth, setLeftWidth] = useState(50)
  const [parsed, setParsed] = useState<ParsedState>({ data: null, error: null })
  const [query, setQuery] = useState('')
  const [expansion, setExpansionState] = useState<ExpansionState>(initialExpansion)
  const [views, setViews] = useState<Map<string, TableView>>(() => new Map())
  const [focusedPath, setFocusedPath] = useState<string | null>(null)

  const resizeDragging = useRef(false)
  const resizeStartX = useRef(0)
  const resizeStartWidth = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const editorApi = useRef<CodeEditorApi | null>(null)
  const csvInputRef = useRef<HTMLInputElement>(null)

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

  // Keyboard equivalent of the drag: the handle is focusable, so the split can
  // be moved without a pointer.
  const onResizeKeyDown = useCallback((e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 2
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      setLeftWidth((w) => Math.max(20, w - step))
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      setLeftWidth((w) => Math.min(80, w + step))
    } else if (e.key === 'Home') {
      e.preventDefault()
      setLeftWidth(20)
    } else if (e.key === 'End') {
      e.preventDefault()
      setLeftWidth(80)
    }
  }, [])

  // ── Debounced parse ───────────────────────────
  useEffect(() => {
    const raw = state.gridRaw
    if (!raw.trim()) {
      setParsed({ data: null, error: null })
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      void parse(raw).then((result) => {
        if (cancelled) return
        setParsed(
          result.success
            ? { data: result.data ?? null, error: null }
            : { data: null, error: result.error ?? 'Invalid JSON' }
        )
      })
    }, PARSE_DEBOUNCE_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [state.gridRaw, parse])

  // ── Search ────────────────────────────────────
  const { matches, expandPaths } = useMemo(
    () => computeTreeMatches(parsed.data, query),
    [parsed.data, query]
  )
  const matchPaths = useMemo(() => new Set(matches), [matches])

  const search = query.trim() ? { query, matchPaths, expandPaths } : null

  // ── Editing ───────────────────────────────────
  // Writing back re-serializes the document, so the user's own spacing in the
  // left pane is replaced by standard formatting. That is the same trade the
  // Editor tab makes, and there is no way around it without a parser that
  // preserves positions for writes as well as reads.
  const applyEdit = useCallback((next: unknown) => {
    dispatch({ type: 'SET_GRID_RAW', raw: JSON.stringify(next, null, 2) })
  }, [dispatch])

  const edit = useMemo(() => {
    if (parsed.data === null) return null
    return {
      setValue: (segments: PathSegment[], value: unknown) => applyEdit(setAtPath(parsed.data, segments, value)),
      remove: (segments: PathSegment[]) => {
        setFocusedPath(null)
        applyEdit(deleteAtPath(parsed.data, segments))
      },
    }
  }, [parsed.data, applyEdit])

  // ── Row / cell actions ────────────────────────
  const handleCopy = useCallback((value: unknown) => {
    navigator.clipboard.writeText(valueToCopyText(value)).then(
      () => addToast('Copied to clipboard'),
      () => addToast('Could not copy to clipboard', 'error')
    )
  }, [addToast])

  const handleCopyPath = useCallback((path: string) => {
    navigator.clipboard.writeText(path).then(
      () => addToast(`Copied ${path}`),
      () => addToast('Could not copy to clipboard', 'error')
    )
  }, [addToast])

  // GridSync: locate the node in the raw text and select it on the left.
  const handleFocus = useCallback((path: string, segments: PathSegment[]) => {
    setFocusedPath(path)
    const range = locatePath(state.gridRaw, segments)
    if (range) editorApi.current?.selectRange(range.start, range.end)
  }, [state.gridRaw])

  const handleExportCsv = useCallback((rows: Record<string, unknown>[], columns: string[], path: string) => {
    if (columns.length === 0) {
      addToast('Nothing to export — every column is hidden', 'error')
      return
    }
    downloadCsv(toCsv(rows, columns), 'grid.csv')
    addToast(`Exported ${rows.length} row${rows.length === 1 ? '' : 's'} from ${pathToBreadcrumb(path)}`)
  }, [addToast])

  const setView = useCallback((path: string, view: TableView) => {
    setViews((current) => new Map(current).set(path, view))
  }, [])

  const ctx: GridContext = {
    expansion,
    setExpanded: (path, open) => setExpansionState((current) => setExpanded(current, path, open)),
    search,
    views,
    setView,
    edit,
    onCopy: handleCopy,
    onCopyPath: handleCopyPath,
    onFocus: handleFocus,
    focusedPath,
    onExportCsv: handleExportCsv,
  }

  // The inverse of the per-table CSV export: rows come back as an array of
  // objects, which is exactly the shape the grid renders as a table.
  function handleImportCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // reset so same file can be re-uploaded
    if (!file) return
    const sizeError = checkFileSize(file, MAX_TEXT_FILE_BYTES)
    if (sizeError) {
      addToast(sizeError, 'error')
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const { rows, columns, error } = parseCsv(ev.target?.result as string)
      // Leave the current document alone on failure — a bad pick should not
      // cost the user what they were already looking at.
      if (error) {
        addToast(error, 'error')
        return
      }
      dispatch({ type: 'SET_GRID_RAW', raw: JSON.stringify(rows, null, 2) })
      setFocusedPath(null)
      if (rows.length === 0) {
        // A header with no data rows parses cleanly but leaves an empty grid;
        // say so, or the blank table reads as a failed import.
        addToast('The file has a header row but no data — nothing to show', 'info')
        return
      }
      addToast(
        `Imported ${rows.length} row${rows.length === 1 ? '' : 's'} × ${columns.length} column${columns.length === 1 ? '' : 's'}`
      )
    }
    reader.onerror = () => addToast('Could not read the file', 'error')
    reader.readAsText(file)
  }

  function handleClear() {
    dispatch({ type: 'SET_GRID_RAW', raw: '' })
    setFocusedPath(null)
    setQuery('')
    setViews(new Map())
    setExpansionState(initialExpansion())
  }

  const hasData = parsed.data !== null

  return (
    <div className="grid-tab" ref={containerRef}>
      {/* Left: JSON editor */}
      <div className="grid-tab__left panel" style={{ width: `${leftWidth}%` }}>
        <div className="panel__header">
          <span className="panel__label">JSON Input</span>
          <div className="flex-row">
            <FromEditorButton onPick={(raw) => dispatch({ type: 'SET_GRID_RAW', raw })} />
            <button
              className="btn btn-ghost"
              style={{ fontSize: 11 }}
              onClick={() => csvInputRef.current?.click()}
              title="Load a CSV file as a table"
            >
              Import CSV
            </button>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              aria-label="Import CSV file"
              style={{ display: 'none' }}
              onChange={handleImportCsv}
            />
            <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={handleClear}>
              Clear
            </button>
          </div>
        </div>
        <div className="panel__body">
          <JsonTextarea
            value={state.gridRaw}
            onChange={(val) => dispatch({ type: 'SET_GRID_RAW', raw: val })}
            placeholder={'{\n  "menu": {\n    "id": "file",\n    "value": "File"\n  }\n}'}
            apiRef={editorApi}
          />
        </div>
      </div>

      {/* Resize handle */}
      <div
        className="grid-tab__resize-handle"
        role="slider"
        tabIndex={0}
        aria-label="Resize panes"
        aria-orientation="vertical"
        aria-valuemin={20}
        aria-valuemax={80}
        aria-valuenow={Math.round(leftWidth)}
        aria-valuetext={`JSON input pane ${Math.round(leftWidth)}% wide`}
        onMouseDown={onResizeMouseDown}
        onKeyDown={onResizeKeyDown}
        title="Drag to resize"
      />

      {/* Right: Tree grid */}
      <div className="grid-tab__right panel">
        <div className="panel__header">
          <span className="panel__label">Grid</span>
          {hasData && (
            <div className="flex-row">
              <button
                className="btn btn-ghost"
                style={{ fontSize: 11 }}
                onClick={() => setExpansionState(setExpansionMode('all'))}
                title="Expand every node"
              >
                Expand All
              </button>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 11 }}
                onClick={() => setExpansionState(setExpansionMode('none'))}
                title="Collapse every node"
              >
                Collapse All
              </button>
            </div>
          )}
        </div>

        {hasData && (
          <div className="tree-search">
            <span className="tree-search__icon" aria-hidden>⌕</span>
            <input
              className="tree-search__input"
              type="text"
              value={query}
              aria-label="Search keys and values"
              placeholder="Search keys and values…"
              spellCheck={false}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setQuery('')
              }}
            />
            {query.trim() && (
              <>
                <span className="tree-search__count">
                  {matches.length} match{matches.length === 1 ? '' : 'es'}
                </span>
                <button className="tree-search__nav" onClick={() => setQuery('')} title="Clear search" type="button">✕</button>
              </>
            )}
          </div>
        )}

        <div className="panel__body">
          {parsed.error ? (
            <div className="empty-state">
              <div className="empty-state__icon text-error">✗</div>
              <div className="empty-state__title text-error">Invalid JSON</div>
              <div className="text-error mono" style={{ fontSize: 12 }}>{parsed.error}</div>
            </div>
          ) : !hasData ? (
            <div className="empty-state">
              <div className="empty-state__icon">▦</div>
              <div className="empty-state__title">Paste JSON to explore</div>
              <div>Objects and arrays are shown as an interactive grid.</div>
            </div>
          ) : (
            <div className="jtg-root">
              <GridNode ctx={ctx} nodeKey={null} data={parsed.data} depth={0} path="$" segments={[]} />
            </div>
          )}
        </div>

        {focusedPath && (
          <div className="jtg-breadcrumb" title="Path of the selected node">
            <span className="jtg-breadcrumb__label">Path</span>
            <code className="jtg-breadcrumb__path">{pathToBreadcrumb(focusedPath)}</code>
            <button
              type="button"
              className="jtg-action"
              title="Copy path"
              aria-label="Copy path"
              onClick={() => handleCopyPath(focusedPath)}
            >⧉</button>
          </div>
        )}
      </div>
    </div>
  )
}
