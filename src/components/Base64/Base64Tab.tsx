import { useCallback, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import { useToast } from '../Toast/ToastProvider'

export function Base64Tab() {
  const { state, dispatch } = useApp()
  const { addToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleConvert = useCallback(() => {
    const input = state.base64Input
    if (!input) return
    try {
      if (state.base64Mode === 'encode') {
        const bytes = new TextEncoder().encode(input)
        const binStr = Array.from(bytes).map(b => String.fromCharCode(b)).join('')
        const output = btoa(binStr)
        dispatch({ type: 'SET_BASE64_OUTPUT', output, error: null })
      } else {
        const binStr = atob(input.trim())
        const bytes = Uint8Array.from(binStr, c => c.charCodeAt(0))
        const output = new TextDecoder().decode(bytes)
        dispatch({ type: 'SET_BASE64_OUTPUT', output, error: null })
      }
    } catch (e) {
      dispatch({ type: 'SET_BASE64_ERROR', error: (e as Error).message })
    }
  }, [state.base64Input, state.base64Mode, dispatch])

  const handleCopy = useCallback(() => {
    if (!state.base64Output) return
    navigator.clipboard.writeText(state.base64Output).then(() => addToast('Copied to clipboard'))
  }, [state.base64Output, addToast])

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const result = ev.target?.result as string
      // result is a data URL: "data:<mime>;base64,<data>"
      if (state.base64Mode === 'encode') {
        const base64 = result.split(',')[1]
        dispatch({ type: 'SET_BASE64_OUTPUT', output: base64, error: null })
        dispatch({ type: 'SET_BASE64_INPUT', input: `[file: ${file.name}]` })
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }, [state.base64Mode, dispatch])

  const hasInput = state.base64Input.trim().length > 0
  const hasOutput = state.base64Output.trim().length > 0

  return (
    <div className="converter-tab">
      <div className="converter-tab__toolbar">
        <div className="mode-toggle">
          <button
            className={`mode-toggle__btn${state.base64Mode === 'encode' ? ' mode-toggle__btn--active' : ''}`}
            onClick={() => dispatch({ type: 'SET_BASE64_MODE', mode: 'encode' })}
          >
            Encode
          </button>
          <button
            className={`mode-toggle__btn${state.base64Mode === 'decode' ? ' mode-toggle__btn--active' : ''}`}
            onClick={() => dispatch({ type: 'SET_BASE64_MODE', mode: 'decode' })}
          >
            Decode
          </button>
        </div>

        <div className="toolbar-sep" />

        <button className="btn btn-primary" onClick={handleConvert} disabled={!hasInput}>
          {state.base64Mode === 'encode' ? 'Encode' : 'Decode'}
        </button>
        {state.base64Mode === 'encode' && (
          <>
            <button className="btn btn-ghost" onClick={() => fileInputRef.current?.click()} title="Encode a file to Base64">
              Encode File
            </button>
            <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileUpload} />
          </>
        )}
        <button className="btn btn-ghost" onClick={handleCopy} disabled={!hasOutput}>
          Copy Output
        </button>

        <div className="toolbar-sep" />
        <button
          className="btn btn-danger"
          onClick={() => dispatch({ type: 'CLEAR_BASE64' })}
          disabled={!hasInput && !hasOutput}
        >
          Clear
        </button>
      </div>

      <div className="converter-tab__panels">
        <div className="panel converter-tab__pane">
          <div className="panel__header">
            <span className="panel__label">
              {state.base64Mode === 'encode' ? 'Plain Text Input' : 'Base64 Input'}
            </span>
            {hasInput && (
              <span className="text-xs text-muted mono">{state.base64Input.length} chars</span>
            )}
          </div>
          <div className="panel__body">
            <textarea
              className="json-textarea"
              value={state.base64Input}
              onChange={e => dispatch({ type: 'SET_BASE64_INPUT', input: e.target.value })}
              placeholder={state.base64Mode === 'encode'
                ? 'Enter text to encode…'
                : 'Paste Base64 string to decode…'}
              spellCheck={false}
            />
          </div>
        </div>

        <div className="panel converter-tab__pane">
          <div className="panel__header">
            <span className="panel__label">
              {state.base64Mode === 'encode' ? 'Base64 Output' : 'Decoded Text'}
            </span>
            {hasOutput && (
              <span className="text-xs text-muted mono">{state.base64Output.length} chars</span>
            )}
          </div>
          <div className="panel__body">
            {state.base64Error ? (
              <div className="converter-tab__error">
                <span className="text-error">✗ {state.base64Error}</span>
              </div>
            ) : (
              <textarea
                className="json-textarea"
                value={state.base64Output}
                readOnly
                placeholder="Output will appear here…"
                spellCheck={false}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
