import { useRef } from 'react'
import { useApp } from '../../context/AppContext'
import { useToast } from '../Toast/ToastProvider'
import { XmlCodeEditor } from '../shared/XmlCodeEditor'
import { checkFileSize, MAX_TEXT_FILE_BYTES } from '../../utils/limits'

export function XmlTab() {
  const { state, dispatch, validateXml, formatXmlAction } = useApp()
  const { addToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const hasContent = state.xmlRaw.trim().length > 0

  function handleCopy() {
    if (!hasContent) return
    navigator.clipboard.writeText(state.xmlRaw).then(() => {
      addToast('Copied to clipboard')
    })
  }

  function handleDownload() {
    const blob = new Blob([state.xmlRaw], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'data.xml'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const sizeError = checkFileSize(file, MAX_TEXT_FILE_BYTES)
    if (sizeError) {
      // A rejected upload leaves the document untouched, so this is reported as
      // a toast rather than through the validation state of the current XML.
      addToast(sizeError, 'error')
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      dispatch({ type: 'SET_XML_RAW', raw: text })
    }
    reader.readAsText(file)
  }

  return (
    <div className="xml-tab">
      <div className="xml-tab__toolbar">
        <button className="btn btn-primary" onClick={validateXml} disabled={!hasContent}>
          Validate
        </button>
        <button className="btn btn-secondary" onClick={formatXmlAction} disabled={!hasContent}>
          Format
        </button>

        <div className="toolbar-sep" />

        <button className="btn btn-ghost" onClick={handleCopy} disabled={!hasContent}>
          Copy
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => fileInputRef.current?.click()}
          title="Upload XML file"
        >
          Upload
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xml,application/xml,text/xml,text/plain"
          style={{ display: 'none' }}
          onChange={handleUpload}
          aria-label="Upload XML file"
        />
        <button className="btn btn-ghost" onClick={handleDownload} disabled={!hasContent}>
          Download
        </button>

        <div className="toolbar-sep" />
        <button className="btn btn-danger" onClick={() => dispatch({ type: 'CLEAR_XML' })} disabled={!hasContent}>
          Clear
        </button>

        <div style={{ marginLeft: 'auto' }}>
          {state.xmlValid === true && <span className="status-badge status-badge--valid">✓ Valid XML</span>}
          {state.xmlValid === false && <span className="status-badge status-badge--invalid">✗ Invalid XML</span>}
        </div>
      </div>

      <div className="xml-tab__pane panel">
        <div className="panel__header">
          <span className="panel__label">XML Input</span>
          {hasContent && (
            <span className="text-xs text-muted" style={{ fontFamily: 'var(--font-mono)' }}>
              {state.xmlRaw.length} chars · {state.xmlRaw.split('\n').length} lines
            </span>
          )}
        </div>
        <div className="panel__body">
          <XmlCodeEditor
            value={state.xmlRaw}
            onChange={(val) => dispatch({ type: 'SET_XML_RAW', raw: val })}
            theme={state.theme}
          />
        </div>
        {state.xmlValid === false && state.xmlError && (
          <div className="error-bar">
            ✗ {state.xmlError}
          </div>
        )}
      </div>
    </div>
  )
}
