import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { JsonTextarea } from '../shared/JsonTextarea'
import { EditorDocTabs } from './EditorDocTabs'
import { TreeView } from '../Tree/TreeView'
import { useToast } from '../Toast/ToastProvider'
import { EDITOR_THEMES, EDITOR_THEME_ORDER } from '../../utils/editorThemes'
import { checkFileSize, formatBytes, FETCH_TIMEOUT_MS, MAX_FETCH_BYTES, MAX_TEXT_FILE_BYTES } from '../../utils/limits'
import { repairJson } from '../../utils/jsonRepair'
import { unescapeJsonString, escapeJsonString } from '../../utils/jsonUnescape'
import { looksLikeJsonl, parseJsonl, toJsonl } from '../../utils/jsonl'
import { inferSchema } from '../../utils/jsonInfer'
import { IconPalette } from '../icons/Icons'
// Type-only: erased at build time, so ajv stays out of the initial bundle.
import type Ajv from 'ajv'

type ViewMode = 'code' | 'tree'

/**
 * A repair the user has been offered but not yet accepted. `text` is absent
 * when the pass failed outright, which is what makes Apply unavailable.
 */
interface RepairPreview {
  text?: string
  changes: string[]
  error?: string
}

/** Which direction the JSONL entry offers, or `null` when neither applies. */
type JsonlMode = 'from' | 'to' | null

export function EditorTab() {
  const { state, dispatch, validateEditor, beautifyEditor, minifyEditor } = useApp()
  const { addToast } = useToast()
  const [view, setView] = useState<ViewMode>('code')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [treeKey, setTreeKey] = useState(0)
  const [treeForceOpen, setTreeForceOpen] = useState<boolean | undefined>(undefined)
  const [showSchema, setShowSchema] = useState(false)
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [themePickerOpen, setThemePickerOpen] = useState(false)
  const themePickerRef = useRef<HTMLDivElement>(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)
  const [repairPreview, setRepairPreview] = useState<RepairPreview | null>(null)
  // Cached across validations so the lazy chunk is only fetched and wired up once.
  const ajvRef = useRef<Ajv | null>(null)
  // Controls the in-flight URL fetch, if any.
  const fetchAbortRef = useRef<AbortController | null>(null)

  // Leaving the tab mid-fetch shouldn't leave the request running.
  useEffect(() => () => fetchAbortRef.current?.abort(), [])

  useEffect(() => {
    if (!themePickerOpen) return
    function handleClick(e: MouseEvent) {
      if (themePickerRef.current && !themePickerRef.current.contains(e.target as Node)) {
        setThemePickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [themePickerOpen])

  // The overflow menu closes the same two ways every menu should: a click that
  // lands outside it, or Escape. The key handler lives on the document rather
  // than on the wrapper so it works no matter which item currently has focus.
  useEffect(() => {
    if (!moreOpen) return
    function handleClick(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMoreOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [moreOpen])

  // A repair proposal is only valid for the text it was computed from. Editing
  // the document — or switching to another one — retires it, so Apply can never
  // overwrite work the user did after the preview went up.
  useEffect(() => {
    setRepairPreview(null)
  }, [state.editorRaw])

  function handleExpandAll() {
    setTreeForceOpen(true)
    setTreeKey((k) => k + 1)
  }

  function handleCollapseAll() {
    setTreeForceOpen(false)
    setTreeKey((k) => k + 1)
  }

  const hasContent = state.editorRaw.trim().length > 0

  // Which way round the escape and JSONL entries should read. Offering both
  // directions at once would make the user work out which one their document
  // needs; the document already knows, so the menu asks it.
  const { canUnescape, jsonlMode } = useMemo<{ canUnescape: boolean; jsonlMode: JsonlMode }>(() => {
    const trimmed = state.editorRaw.trim()
    if (!trimmed) return { canUnescape: false, jsonlMode: null }
    let parsed: unknown
    let parsedOk = false
    try {
      parsed = JSON.parse(trimmed)
      parsedOk = true
    } catch {
      // Not a single JSON document — it may still be JSONL, checked below.
    }
    return {
      canUnescape: parsedOk && typeof parsed === 'string',
      jsonlMode: looksLikeJsonl(state.editorRaw) ? 'from' : parsedOk && Array.isArray(parsed) ? 'to' : null,
    }
  }, [state.editorRaw])

  // An edit made in the tree is written straight back to the document, so
  // switching to Code view shows the change already applied. The parsed value
  // is set alongside the raw text because SET_EDITOR_RAW invalidates it.
  const handleTreeChange = useCallback((next: unknown) => {
    dispatch({ type: 'SET_EDITOR_RAW', raw: JSON.stringify(next, null, 2) })
    dispatch({ type: 'SET_EDITOR_PARSED', parsed: next, error: null })
  }, [dispatch])

  // ── Actions ──────────────────────────────────
  function handleCopy() {
    if (!state.editorRaw) return
    navigator.clipboard.writeText(state.editorRaw).then(() => {
      addToast('Copied to clipboard')
    })
  }

  function handleClear() {
    dispatch({ type: 'CLEAR_EDITOR' })
    // Tree view has nothing to show once the document is empty, so clearing
    // from it would strand the user on an empty state telling them to switch.
    setView('code')
  }

  function handleDownload() {
    const blob = new Blob([state.editorRaw], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'data.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
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
      const text = ev.target?.result as string
      dispatch({ type: 'SET_EDITOR_RAW', raw: text })
    }
    reader.readAsText(file)
  }

  // ── Overflow menu actions ─────────────────────
  // A repair rewrites the user's document, so it is proposed rather than
  // performed: the change list goes on screen first and nothing is dispatched
  // until Apply. Input that already parses has nothing to show, and input the
  // pass could not rescue has nothing to apply.
  function handleRepair() {
    setMoreOpen(false)
    const result = repairJson(state.editorRaw)
    if (!result.ok) {
      setRepairPreview({ changes: result.changes ?? [], error: result.error ?? 'Could not repair this JSON' })
      return
    }
    const changes = result.changes ?? []
    if (changes.length === 0) {
      setRepairPreview(null)
      addToast('Nothing to repair — the JSON is already valid', 'info')
      return
    }
    setRepairPreview({ text: result.text, changes })
  }

  function handleApplyRepair() {
    if (!repairPreview?.text) return
    dispatch({ type: 'SET_EDITOR_RAW', raw: repairPreview.text })
    setRepairPreview(null)
    addToast('Repaired the JSON')
  }

  function handleUnescape() {
    setMoreOpen(false)
    const result = unescapeJsonString(state.editorRaw)
    if (!result.ok || result.text === undefined) {
      addToast(result.error ?? 'Could not unescape this input', 'error')
      return
    }
    dispatch({ type: 'SET_EDITOR_RAW', raw: result.text })
    const layers = result.layers ?? 0
    addToast(layers === 0 ? 'Nothing to unescape' : `Unescaped ${layers} ${layers === 1 ? 'layer' : 'layers'}`)
  }

  function handleEscape() {
    setMoreOpen(false)
    const result = escapeJsonString(state.editorRaw)
    if (!result.ok || result.text === undefined) {
      addToast(result.error ?? 'Could not escape this input', 'error')
      return
    }
    dispatch({ type: 'SET_EDITOR_RAW', raw: result.text })
    addToast('Escaped as a JSON string')
  }

  function handleFromJsonl() {
    setMoreOpen(false)
    const result = parseJsonl(state.editorRaw)
    if (!result.ok || !result.rows) {
      addToast(result.error ?? 'Could not parse this as JSONL', 'error')
      return
    }
    dispatch({ type: 'SET_EDITOR_RAW', raw: JSON.stringify(result.rows, null, 2) })
    addToast(`Converted ${result.rows.length} ${result.rows.length === 1 ? 'line' : 'lines'} to a JSON array`)
  }

  function handleToJsonl() {
    setMoreOpen(false)
    let parsed: unknown
    try {
      parsed = JSON.parse(state.editorRaw)
    } catch (e) {
      addToast((e as Error).message, 'error')
      return
    }
    if (!Array.isArray(parsed)) {
      addToast('Only a JSON array can be converted to JSONL', 'error')
      return
    }
    dispatch({ type: 'SET_EDITOR_RAW', raw: toJsonl(parsed) })
    addToast(`Converted ${parsed.length} ${parsed.length === 1 ? 'row' : 'rows'} to JSONL`)
  }

  // When switching to tree view, validate first
  function handleViewSwitch(next: ViewMode) {
    if (next === 'tree') validateEditor()
    setView(next)
  }

  // ── JSON Schema Validation ────────────────────
  // ajv + ajv-formats are pulled in on demand: this is the default tab, so most
  // sessions never open the Schema panel and shouldn't pay for the bundle.
  const getAjv = useCallback(async () => {
    if (ajvRef.current) return ajvRef.current
    const { default: Ajv } = await import('ajv')
    const { default: addFormats } = await import('ajv-formats')
    const instance = new Ajv({ allErrors: true })
    addFormats(instance)
    ajvRef.current = instance
    return instance
  }, [])

  const handleSchemaValidate = useCallback(async () => {
    if (!state.schemaInput.trim() || !state.editorRaw.trim()) return
    try {
      const schema = JSON.parse(state.schemaInput)
      const data = JSON.parse(state.editorRaw)
      const ajv = await getAjv()
      const validate = ajv.compile(schema)
      const valid = validate(data)
      if (valid) {
        dispatch({ type: 'SET_SCHEMA_RESULT', valid: true, error: null })
      } else {
        const errors = validate.errors?.map((e) => `${e.instancePath || '/'}: ${e.message}`).join('\n') ?? 'Invalid'
        dispatch({ type: 'SET_SCHEMA_RESULT', valid: false, error: errors })
      }
    } catch (e) {
      dispatch({ type: 'SET_SCHEMA_RESULT', valid: false, error: (e as Error).message })
    }
  }, [state.schemaInput, state.editorRaw, dispatch, getAjv])

  // Writing an inferred schema into the same box the user edits by hand means
  // the generated draft is a starting point, not a separate read-only artefact.
  const handleSchemaGenerate = useCallback(() => {
    if (!state.editorRaw.trim()) return
    let data: unknown
    try {
      data = JSON.parse(state.editorRaw)
    } catch (e) {
      addToast(`Cannot generate a schema: ${(e as Error).message}`, 'error')
      return
    }
    dispatch({ type: 'SET_SCHEMA_INPUT', raw: JSON.stringify(inferSchema(data), null, 2) })
    addToast('Schema generated from the current document')
  }, [state.editorRaw, dispatch, addToast])

  // ── URL Fetch ─────────────────────────────────
  const handleFetchUrl = useCallback(async () => {
    if (!state.fetchUrl.trim()) return
    // A hung endpoint used to strand the user on "Loading..." with no way out,
    // so every request is bounded by a timeout and cancellable by hand.
    const controller = new AbortController()
    fetchAbortRef.current = controller
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, FETCH_TIMEOUT_MS)
    dispatch({ type: 'SET_FETCH_LOADING', loading: true })
    try {
      const res = await fetch(state.fetchUrl, { signal: controller.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      const declared = Number(res.headers.get('content-length'))
      if (declared > MAX_FETCH_BYTES) {
        throw new Error(`Response is too large (${formatBytes(declared)}). The limit is ${formatBytes(MAX_FETCH_BYTES)}.`)
      }
      const text = await res.text()
      // Servers may omit or understate Content-Length, so the body is checked too.
      if (text.length > MAX_FETCH_BYTES) {
        throw new Error(`Response is too large (${formatBytes(text.length)}). The limit is ${formatBytes(MAX_FETCH_BYTES)}.`)
      }
      dispatch({ type: 'SET_EDITOR_RAW', raw: text })
      dispatch({ type: 'SET_FETCH_LOADING', loading: false })
    } catch (e) {
      const err = e as Error
      const message =
        err.name === 'AbortError'
          ? timedOut
            ? `Request timed out after ${FETCH_TIMEOUT_MS / 1000}s`
            : 'Fetch cancelled'
          : err.message
      dispatch({ type: 'SET_FETCH_ERROR', error: message })
    } finally {
      clearTimeout(timer)
      if (fetchAbortRef.current === controller) fetchAbortRef.current = null
    }
  }, [state.fetchUrl, dispatch])

  const handleCancelFetch = useCallback(() => {
    fetchAbortRef.current?.abort()
  }, [])

  // ── Render ────────────────────────────────────
  const { editorValid, editorError, editorParsed } = state

  let statusBadge = null
  if (editorValid === true) {
    statusBadge = <span className="status-badge status-badge--valid">✓ Valid JSON</span>
  } else if (editorValid === false) {
    statusBadge = <span className="status-badge status-badge--invalid">✗ Invalid</span>
  }

  return (
    <div className="editor-tab">
      {/* Document tabs */}
      <EditorDocTabs />

      {/* Toolbar */}
      <div className="editor-tab__toolbar">
        <button className="btn btn-primary" onClick={beautifyEditor} disabled={!hasContent}>
          Beautify
        </button>
        <button className="btn btn-secondary" onClick={minifyEditor} disabled={!hasContent}>
          Minify
        </button>
        <button className="btn btn-secondary" onClick={validateEditor} disabled={!hasContent}>
          Validate
        </button>

        <div className="toolbar-sep" />

        <button className="btn btn-ghost" onClick={handleCopy} disabled={!hasContent}>
          Copy
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => fileInputRef.current?.click()}
          title="Upload JSON file"
        >
          Upload
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json,text/plain"
          aria-label="Upload JSON file"
          style={{ display: 'none' }}
          onChange={handleUpload}
        />
        <button className="btn btn-ghost" onClick={handleDownload} disabled={!hasContent}>
          Download
        </button>

        <div className="toolbar-sep" />
        <button className="btn btn-ghost" onClick={() => setShowUrlInput(!showUrlInput)} title="Load JSON from URL">
          URL
        </button>
        <button className="btn btn-ghost" onClick={() => setShowSchema(!showSchema)} title="Validate against JSON Schema">
          Schema
        </button>

        <div className="toolbar-sep" />
        <button className="btn btn-danger" onClick={handleClear} disabled={!hasContent}>
          Clear
        </button>

        <div className="toolbar-sep" />
        <div className="editor-more-menu" ref={moreRef}>
          <button
            className="btn btn-ghost"
            onClick={() => setMoreOpen((o) => !o)}
            aria-haspopup="true"
            aria-expanded={moreOpen}
            title="More JSON tools"
          >
            ⋯ More
          </button>
          {moreOpen && (
            <div className="editor-more-menu__menu">
              <button className="editor-more-menu__option" onClick={handleRepair} disabled={!hasContent}>
                Repair JSON
              </button>
              {canUnescape ? (
                <button className="editor-more-menu__option" onClick={handleUnescape}>
                  Unescape string
                </button>
              ) : (
                <button className="editor-more-menu__option" onClick={handleEscape} disabled={!hasContent}>
                  Escape as string
                </button>
              )}
              {jsonlMode === 'from' ? (
                <button className="editor-more-menu__option" onClick={handleFromJsonl}>
                  Convert from JSONL
                </button>
              ) : (
                <button className="editor-more-menu__option" onClick={handleToJsonl} disabled={jsonlMode !== 'to'}>
                  Convert to JSONL
                </button>
              )}
            </div>
          )}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="editor-theme-picker" ref={themePickerRef}>
            <button
              className="editor-theme-picker__btn"
              onClick={() => setThemePickerOpen((o) => !o)}
              title="Editor syntax theme"
            >
              <IconPalette size={13} className="editor-theme-picker__icon" />
              <span>{EDITOR_THEMES[state.editorSyntaxTheme].label}</span>
              <svg className="editor-theme-picker__chevron" width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {themePickerOpen && (
              <div className="editor-theme-picker__menu">
                {EDITOR_THEME_ORDER.map((id) => (
                  <button
                    key={id}
                    className={`editor-theme-picker__option${id === state.editorSyntaxTheme ? ' editor-theme-picker__option--active' : ''}`}
                    onClick={() => {
                      dispatch({ type: 'SET_EDITOR_SYNTAX_THEME', theme: id })
                      setThemePickerOpen(false)
                    }}
                  >
                    {EDITOR_THEMES[id].label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {statusBadge}
          <div className="view-toggle">
            <button
              className={`view-toggle__btn${view === 'code' ? ' view-toggle__btn--active' : ''}`}
              onClick={() => handleViewSwitch('code')}
            >
              Code
            </button>
            <button
              className={`view-toggle__btn${view === 'tree' ? ' view-toggle__btn--active' : ''}`}
              onClick={() => handleViewSwitch('tree')}
            >
              Tree
            </button>
          </div>
        </div>
      </div>

      {/* Repair Preview Bar */}
      {repairPreview && (
        <div className="editor-tab__repair-bar">
          {repairPreview.error ? (
            <div className="text-error text-xs mono" style={{ whiteSpace: 'pre-wrap' }}>
              ✗ Could not repair this JSON — {repairPreview.error}
            </div>
          ) : (
            <>
              {/* No count here: an entry can stand for several fixes of the
                  same kind, so its own "(×n)" is the honest number. */}
              <div className="text-xs">Repairs to apply:</div>
              <ul className="editor-tab__repair-list">
                {repairPreview.changes.map((change) => (
                  <li key={change}>{change}</li>
                ))}
              </ul>
            </>
          )}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {repairPreview.text !== undefined && (
              <button className="btn btn-primary" onClick={handleApplyRepair}>
                Apply
              </button>
            )}
            <button className="btn btn-ghost" onClick={() => setRepairPreview(null)}>
              {repairPreview.text === undefined ? 'Dismiss' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      {/* URL Fetch Bar */}
      {showUrlInput && (
        <div className="editor-tab__url-bar">
          <input
            className="filter-input"
            style={{ flex: 1 }}
            aria-label="JSON URL"
            value={state.fetchUrl}
            onChange={(e) => dispatch({ type: 'SET_FETCH_URL', url: e.target.value })}
            placeholder="https://api.example.com/data.json"
            onKeyDown={(e) => { if (e.key === 'Enter' && !state.fetchLoading) handleFetchUrl() }}
          />
          {state.fetchLoading ? (
            <button className="btn btn-secondary" onClick={handleCancelFetch}>
              Cancel
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleFetchUrl} disabled={!state.fetchUrl.trim()}>
              Fetch
            </button>
          )}
          {state.fetchError && <span className="text-error text-xs">{state.fetchError}</span>}
        </div>
      )}

      {/* JSON Schema Validation Panel */}
      {showSchema && (
        <div className="editor-tab__schema-bar">
          <textarea
            className="json-textarea"
            style={{ height: 100, flex: 1 }}
            aria-label="JSON Schema"
            value={state.schemaInput}
            onChange={(e) => dispatch({ type: 'SET_SCHEMA_INPUT', raw: e.target.value })}
            placeholder='Paste JSON Schema here...\n{"type":"object","properties":{...}}'
            spellCheck={false}
          />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={handleSchemaValidate} disabled={!state.schemaInput.trim() || !hasContent}>
              Validate Schema
            </button>
            <button className="btn btn-secondary" onClick={handleSchemaGenerate} disabled={!hasContent} title="Infer a JSON Schema from the current document">
              Generate from data
            </button>
            {state.schemaValid === true && <span className="status-badge status-badge--valid">✓ Schema Valid</span>}
            {state.schemaValid === false && <span className="status-badge status-badge--invalid">✗ Schema Invalid</span>}
          </div>
          {state.schemaError && (
            <div className="text-error text-xs mono" style={{ whiteSpace: 'pre-wrap', maxHeight: 80, overflow: 'auto' }}>
              {state.schemaError}
            </div>
          )}
        </div>
      )}

      {/* Main area */}
      <div className="editor-tab__split">
        <div className="editor-tab__pane panel">
          <div className="panel__header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="panel__label">{view === 'code' ? 'JSON' : 'Tree View'}</span>
              {view === 'tree' && (
                <>
                  <button className="btn btn-ghost" style={{ padding: '2px 10px', fontSize: 12, height: 24 }} onClick={handleExpandAll} disabled={!hasContent} title="Expand all nodes">
                    Expand All
                  </button>
                  <button className="btn btn-ghost" style={{ padding: '2px 10px', fontSize: 12, height: 24 }} onClick={handleCollapseAll} disabled={!hasContent} title="Collapse all nodes">
                    Collapse All
                  </button>
                </>
              )}
            </div>
            {view === 'code' && (
              <span className="text-xs text-muted" style={{ fontFamily: 'var(--font-mono)' }}>
                {state.editorRaw.length} chars · {state.editorRaw.split('\n').length} lines
              </span>
            )}
          </div>
          <div className="panel__body">
            {view === 'code' ? (
              <JsonTextarea
                value={state.editorRaw}
                onChange={(val) => dispatch({ type: 'SET_EDITOR_RAW', raw: val })}
              />
            ) : editorValid === false ? (
              <div className="empty-state">
                <div className="empty-state__icon">✗</div>
                <div className="empty-state__title">Cannot render tree</div>
                <div className="text-error" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                  {editorError}
                </div>
              </div>
            ) : editorParsed !== null ? (
              <TreeView
                key={treeKey}
                data={editorParsed}
                forceOpen={treeForceOpen}
                onChange={handleTreeChange}
              />
            ) : !hasContent ? (
              <div className="empty-state">
                <div className="empty-state__icon">{ '{ }' }</div>
                <div className="empty-state__title">No JSON loaded</div>
                <div>Switch to Code view and paste JSON, then come back</div>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state__title">Click Validate or Beautify first</div>
              </div>
            )}
          </div>
          {editorValid === false && view === 'code' && editorError && (
            <div className="error-bar">
              ✗ {editorError}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
