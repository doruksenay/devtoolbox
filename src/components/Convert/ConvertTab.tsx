import { useState } from 'react'
import { useApp } from '../../context/AppContext'

function xmlToJson(xml: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'application/xml')
  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new Error(parseError.textContent?.trim() ?? 'Invalid XML')
  }

  function nodeToObj(node: Element): unknown {
    const obj: Record<string, unknown> = {}

    // Attributes
    if (node.attributes.length > 0) {
      const attrs: Record<string, string> = {}
      for (let i = 0; i < node.attributes.length; i++) {
        const attr = node.attributes[i]
        attrs[`@${attr.name}`] = attr.value
      }
      Object.assign(obj, attrs)
    }

    // Children
    const children = Array.from(node.childNodes)
    const elementChildren = children.filter((c) => c.nodeType === Node.ELEMENT_NODE)
    const textContent = children
      .filter((c) => c.nodeType === Node.TEXT_NODE || c.nodeType === Node.CDATA_SECTION_NODE)
      .map((c) => c.textContent)
      .join('')
      .trim()

    if (elementChildren.length === 0) {
      // Leaf node
      if (Object.keys(obj).length === 0) {
        return textContent || null
      }
      if (textContent) {
        obj['#text'] = textContent
      }
      return obj
    }

    // Group children by tag name
    for (const child of elementChildren) {
      const el = child as Element
      const key = el.tagName
      const value = nodeToObj(el)

      if (obj[key] !== undefined) {
        if (!Array.isArray(obj[key])) {
          obj[key] = [obj[key]]
        }
        ;(obj[key] as unknown[]).push(value)
      } else {
        obj[key] = value
      }
    }

    if (textContent) {
      obj['#text'] = textContent
    }

    return obj
  }

  const root = doc.documentElement
  const result = { [root.tagName]: nodeToObj(root) }
  return JSON.stringify(result, null, 2)
}

function jsonToXml(json: string): string {
  const parsed = JSON.parse(json)

  function objToXml(key: string, value: unknown, indent: number): string {
    const pad = '  '.repeat(indent)

    if (value === null || value === undefined) {
      return `${pad}<${key}/>`
    }

    if (typeof value !== 'object') {
      return `${pad}<${key}>${escapeXml(String(value))}</${key}>`
    }

    if (Array.isArray(value)) {
      return value.map((item) => objToXml(key, item, indent)).join('\n')
    }

    const obj = value as Record<string, unknown>
    const attrs: string[] = []
    const children: string[] = []
    let textContent = ''

    for (const [k, v] of Object.entries(obj)) {
      if (k.startsWith('@')) {
        attrs.push(`${k.slice(1)}="${escapeXml(String(v))}"`)
      } else if (k === '#text') {
        textContent = String(v)
      } else {
        children.push(objToXml(k, v, indent + 1))
      }
    }

    const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : ''

    if (children.length === 0 && !textContent) {
      return `${pad}<${key}${attrStr}/>`
    }

    if (children.length === 0) {
      return `${pad}<${key}${attrStr}>${escapeXml(textContent)}</${key}>`
    }

    return `${pad}<${key}${attrStr}>\n${children.join('\n')}\n${pad}</${key}>`
  }

  function escapeXml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('JSON root must be an object')
  }

  const keys = Object.keys(parsed)
  const lines = keys.map((k) => objToXml(k, parsed[k], 0))
  const result = lines.join('\n')

  return keys.length === 1 ? result : `<root>\n${lines.map(l => '  ' + l).join('\n')}\n</root>`
}

export function ConvertTab() {
  const { state, dispatch } = useApp()
  const [copied, setCopied] = useState(false)

  function handleConvert() {
    if (!state.convertInput.trim()) return
    try {
      const output =
        state.convertMode === 'xml-to-json'
          ? xmlToJson(state.convertInput)
          : jsonToXml(state.convertInput)
      dispatch({ type: 'SET_CONVERT_OUTPUT', output, error: null })
    } catch (e) {
      dispatch({ type: 'SET_CONVERT_ERROR', error: (e as Error).message })
    }
  }

  function handleCopy() {
    if (!state.convertOutput) return
    navigator.clipboard.writeText(state.convertOutput).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    })
  }

  function handleDownload() {
    if (!state.convertOutput) return
    const ext = state.convertMode === 'xml-to-json' ? 'json' : 'xml'
    const mime = state.convertMode === 'xml-to-json' ? 'application/json' : 'application/xml'
    const blob = new Blob([state.convertOutput], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `converted.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const hasInput = state.convertInput.trim().length > 0
  const hasOutput = state.convertOutput.length > 0

  return (
    <div className="convert-tab">
      {/* Mode selector + toolbar */}
      <div className="convert-tab__toolbar">
        <div className="view-toggle">
          <button
            className={`view-toggle__btn${state.convertMode === 'xml-to-json' ? ' view-toggle__btn--active' : ''}`}
            onClick={() => dispatch({ type: 'SET_CONVERT_MODE', mode: 'xml-to-json' })}
          >
            XML → JSON
          </button>
          <button
            className={`view-toggle__btn${state.convertMode === 'json-to-xml' ? ' view-toggle__btn--active' : ''}`}
            onClick={() => dispatch({ type: 'SET_CONVERT_MODE', mode: 'json-to-xml' })}
          >
            JSON → XML
          </button>
        </div>

        <button className="btn btn-primary" onClick={handleConvert} disabled={!hasInput}>
          Convert
        </button>

        <div className="toolbar-sep" />

        <button className="btn btn-ghost" onClick={handleCopy} disabled={!hasOutput}>
          {copied ? 'Copied!' : 'Copy Output'}
        </button>
        <button className="btn btn-ghost" onClick={handleDownload} disabled={!hasOutput}>
          Download
        </button>
        <button
          className="btn btn-danger"
          onClick={() => dispatch({ type: 'CLEAR_CONVERT' })}
          disabled={!hasInput && !hasOutput}
        >
          Clear
        </button>

        {state.convertError && (
          <span className="status-badge status-badge--invalid">✗ {state.convertError}</span>
        )}
      </div>

      {/* Input/Output panels */}
      <div className="convert-tab__panels">
        <div className="panel convert-tab__pane">
          <div className="panel__header">
            <span className="panel__label">
              {state.convertMode === 'xml-to-json' ? 'XML Input' : 'JSON Input'}
            </span>
          </div>
          <div className="panel__body">
            <textarea
              className="json-textarea"
              value={state.convertInput}
              onChange={(e) => dispatch({ type: 'SET_CONVERT_INPUT', raw: e.target.value })}
              placeholder={
                state.convertMode === 'xml-to-json'
                  ? '<root>\n  <item id="1">Hello</item>\n</root>'
                  : '{\n  "root": {\n    "item": "Hello"\n  }\n}'
              }
              spellCheck={false}
            />
          </div>
        </div>

        <div className="panel convert-tab__pane">
          <div className="panel__header">
            <span className="panel__label">
              {state.convertMode === 'xml-to-json' ? 'JSON Output' : 'XML Output'}
            </span>
          </div>
          <div className="panel__body">
            <textarea
              className="json-textarea"
              value={state.convertOutput}
              readOnly
              placeholder="Output will appear here..."
            />
          </div>
        </div>
      </div>
    </div>
  )
}
