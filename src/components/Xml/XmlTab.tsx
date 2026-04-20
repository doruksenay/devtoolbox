import { useState } from 'react'
import { useApp } from '../../context/AppContext'

export function XmlTab() {
  const { state, dispatch, validateXml } = useApp()
  const [copied, setCopied] = useState(false)
  const hasContent = state.xmlRaw.trim().length > 0

  function handleCopy() {
    if (!hasContent) return
    navigator.clipboard.writeText(state.xmlRaw).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    })
  }

  return (
    <div className="xml-tab">
      <div className="xml-tab__toolbar">
        <button className="btn btn-primary" onClick={validateXml} disabled={!hasContent}>
          Validate XML
        </button>
        <button className="btn btn-ghost" onClick={handleCopy} disabled={!hasContent}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
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
        </div>
        <div className="panel__body">
          <textarea
            className="json-textarea"
            value={state.xmlRaw}
            onChange={(e) => dispatch({ type: 'SET_XML_RAW', raw: e.target.value })}
            placeholder={`<root>\n  <item id="1">hello</item>\n</root>`}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
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
