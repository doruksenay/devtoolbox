import { useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { JsonTextarea } from '../shared/JsonTextarea'
import { TreeView } from '../Tree/TreeView'

type ViewMode = 'code' | 'tree'

export function EditorTab() {
  const { state, dispatch, validateEditor, beautifyEditor, minifyEditor } = useApp()
  const [view, setView] = useState<ViewMode>('code')
  const [copyLabel, setCopyLabel] = useState('Copy')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const hasContent = state.editorRaw.trim().length > 0

  // ── Actions ──────────────────────────────────
  function handleCopy() {
    if (!state.editorRaw) return
    navigator.clipboard.writeText(state.editorRaw).then(() => {
      setCopyLabel('Copied!')
      setTimeout(() => setCopyLabel('Copy'), 1500)
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
          {copyLabel}
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
        <button className="btn btn-danger" onClick={handleClear} disabled={!hasContent}>
          Clear
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
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
              <TreeView data={editorParsed} />
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
