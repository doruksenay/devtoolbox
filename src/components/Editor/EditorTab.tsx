import { useRef, useState, useCallback } from 'react'
import { useApp } from '../../context/AppContext'
import { JsonTextarea } from '../shared/JsonTextarea'
import { TreeView } from '../Tree/TreeView'
import { useToast } from '../Toast/ToastProvider'
import { EDITOR_THEMES, EDITOR_THEME_ORDER } from '../../utils/editorThemes'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'

type ViewMode = 'code' | 'tree'

const ajv = new Ajv({ allErrors: true })
addFormats(ajv)

export function EditorTab() {
  const { state, dispatch, validateEditor, beautifyEditor, minifyEditor } = useApp()
  const { addToast } = useToast()
  const [view, setView] = useState<ViewMode>('code')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [treeKey, setTreeKey] = useState(0)
  const [treeForceOpen, setTreeForceOpen] = useState<boolean | undefined>(undefined)
  const [showSchema, setShowSchema] = useState(false)
  const [showUrlInput, setShowUrlInput] = useState(false)

  function handleExpandAll() {
    setTreeForceOpen(true)
    setTreeKey((k) => k + 1)
  }

  function handleCollapseAll() {
    setTreeForceOpen(false)
    setTreeKey((k) => k + 1)
  }

  const hasContent = state.editorRaw.trim().length > 0

  // ── Actions ──────────────────────────────────
  function handleCopy() {
    if (!state.editorRaw) return
    navigator.clipboard.writeText(state.editorRaw).then(() => {
      addToast('Copied to clipboard')
    })
  }

  function handleClear() {
    dispatch({ type: 'CLEAR_EDITOR' })
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
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      dispatch({ type: 'SET_EDITOR_RAW', raw: text })
    }
    reader.readAsText(file)
    e.target.value = '' // reset so same file can be re-uploaded
  }

  // When switching to tree view, validate first
  function handleViewSwitch(next: ViewMode) {
    if (next === 'tree') validateEditor()
    setView(next)
  }

  // ── JSON Schema Validation ────────────────────
  const handleSchemaValidate = useCallback(() => {
    if (!state.schemaInput.trim() || !state.editorRaw.trim()) return
    try {
      const schema = JSON.parse(state.schemaInput)
      const data = JSON.parse(state.editorRaw)
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
  }, [state.schemaInput, state.editorRaw, dispatch])

  // ── URL Fetch ─────────────────────────────────
  const handleFetchUrl = useCallback(async () => {
    if (!state.fetchUrl.trim()) return
    dispatch({ type: 'SET_FETCH_LOADING', loading: true })
    try {
      const res = await fetch(state.fetchUrl)
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      const text = await res.text()
      dispatch({ type: 'SET_EDITOR_RAW', raw: text })
      dispatch({ type: 'SET_FETCH_LOADING', loading: false })
    } catch (e) {
      dispatch({ type: 'SET_FETCH_ERROR', error: (e as Error).message })
    }
  }, [state.fetchUrl, dispatch])

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

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="editor-theme-picker">
            <span className="editor-theme-picker__icon">🎨</span>
            <select
              className="editor-theme-picker__select"
              value={state.editorSyntaxTheme}
              onChange={(e) => dispatch({ type: 'SET_EDITOR_SYNTAX_THEME', theme: e.target.value as import('../../utils/editorThemes').EditorSyntaxTheme })}
              title="Editor syntax theme"
            >
              {EDITOR_THEME_ORDER.map((id) => (
                <option key={id} value={id}>{EDITOR_THEMES[id].label}</option>
              ))}
            </select>
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

      {/* URL Fetch Bar */}
      {showUrlInput && (
        <div className="editor-tab__url-bar">
          <input
            className="filter-input"
            style={{ flex: 1 }}
            value={state.fetchUrl}
            onChange={(e) => dispatch({ type: 'SET_FETCH_URL', url: e.target.value })}
            placeholder="https://api.example.com/data.json"
            onKeyDown={(e) => { if (e.key === 'Enter') handleFetchUrl() }}
          />
          <button className="btn btn-primary" onClick={handleFetchUrl} disabled={!state.fetchUrl.trim() || state.fetchLoading}>
            {state.fetchLoading ? 'Loading...' : 'Fetch'}
          </button>
          {state.fetchError && <span className="text-error text-xs">{state.fetchError}</span>}
        </div>
      )}

      {/* JSON Schema Validation Panel */}
      {showSchema && (
        <div className="editor-tab__schema-bar">
          <textarea
            className="json-textarea"
            style={{ height: 100, flex: 1 }}
            value={state.schemaInput}
            onChange={(e) => dispatch({ type: 'SET_SCHEMA_INPUT', raw: e.target.value })}
            placeholder='Paste JSON Schema here...\n{"type":"object","properties":{...}}'
            spellCheck={false}
          />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={handleSchemaValidate} disabled={!state.schemaInput.trim() || !hasContent}>
              Validate Schema
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
            <span className="panel__label">{view === 'code' ? 'JSON' : 'Tree View'}</span>
            {view === 'code' && (
              <span className="text-xs text-muted" style={{ fontFamily: 'var(--font-mono)' }}>
                {state.editorRaw.length} chars · {state.editorRaw.split('\n').length} lines
              </span>
            )}
            {view === 'tree' && (
              <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
                <button className="btn btn-ghost" style={{ padding: '2px 10px', fontSize: 12, height: 24 }} onClick={handleExpandAll} disabled={!hasContent} title="Expand all nodes">
                  Expand All
                </button>
                <button className="btn btn-ghost" style={{ padding: '2px 10px', fontSize: 12, height: 24 }} onClick={handleCollapseAll} disabled={!hasContent} title="Collapse all nodes">
                  Collapse All
                </button>
              </div>
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
              <TreeView key={treeKey} data={editorParsed} forceOpen={treeForceOpen} />
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
