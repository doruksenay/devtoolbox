import { useCallback, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { useToast } from '../Toast/ToastProvider'

function parseQueryString(qs: string): { key: string; value: string }[] {
  const cleaned = qs.startsWith('?') ? qs.slice(1) : qs
  if (!cleaned.trim()) return []
  return cleaned.split('&').map(part => {
    const eq = part.indexOf('=')
    if (eq === -1) return { key: decodeURIComponent(part), value: '' }
    return {
      key: decodeURIComponent(part.slice(0, eq)),
      value: decodeURIComponent(part.slice(eq + 1)),
    }
  })
}

export function UrlTab() {
  const { state, dispatch } = useApp()
  const { addToast } = useToast()

  const handleConvert = useCallback(() => {
    const input = state.urlInput
    if (!input) return
    try {
      if (state.urlMode === 'encode') {
        const output = encodeURIComponent(input)
        dispatch({ type: 'SET_URL_OUTPUT', output, error: null })
      } else {
        const output = decodeURIComponent(input)
        dispatch({ type: 'SET_URL_OUTPUT', output, error: null })
      }
    } catch (e) {
      dispatch({ type: 'SET_URL_ERROR', error: (e as Error).message })
    }
  }, [state.urlInput, state.urlMode, dispatch])

  const handleCopy = useCallback(() => {
    if (!state.urlOutput) return
    navigator.clipboard.writeText(state.urlOutput).then(() => addToast('Copied to clipboard'))
  }, [state.urlOutput, addToast])

  const queryParams = useMemo(() => {
    const text = state.urlMode === 'decode' ? state.urlOutput : state.urlInput
    return parseQueryString(text)
  }, [state.urlMode, state.urlInput, state.urlOutput])

  const hasInput = state.urlInput.trim().length > 0
  const hasOutput = state.urlOutput.trim().length > 0

  return (
    <div className="converter-tab">
      <div className="converter-tab__toolbar">
        <div className="mode-toggle">
          <button
            className={`mode-toggle__btn${state.urlMode === 'encode' ? ' mode-toggle__btn--active' : ''}`}
            onClick={() => dispatch({ type: 'SET_URL_MODE', mode: 'encode' })}
          >
            Encode
          </button>
          <button
            className={`mode-toggle__btn${state.urlMode === 'decode' ? ' mode-toggle__btn--active' : ''}`}
            onClick={() => dispatch({ type: 'SET_URL_MODE', mode: 'decode' })}
          >
            Decode
          </button>
        </div>

        <div className="toolbar-sep" />

        <button className="btn btn-primary" onClick={handleConvert} disabled={!hasInput}>
          {state.urlMode === 'encode' ? 'Encode' : 'Decode'}
        </button>
        <button className="btn btn-ghost" onClick={handleCopy} disabled={!hasOutput}>
          Copy Output
        </button>

        <div className="toolbar-sep" />
        <button
          className="btn btn-danger"
          onClick={() => dispatch({ type: 'CLEAR_URL' })}
          disabled={!hasInput && !hasOutput}
        >
          Clear
        </button>
      </div>

      <div className="converter-tab__panels">
        <div className="panel converter-tab__pane">
          <div className="panel__header">
            <span className="panel__label">
              {state.urlMode === 'encode' ? 'Plain Text / URL' : 'Encoded URL'}
            </span>
          </div>
          <div className="panel__body">
            <textarea
              className="json-textarea"
              value={state.urlInput}
              onChange={e => dispatch({ type: 'SET_URL_INPUT', input: e.target.value })}
              placeholder={state.urlMode === 'encode'
                ? 'https://example.com/path?name=John Doe&city=New York'
                : 'https%3A%2F%2Fexample.com%2Fpath%3Fname%3DJohn%20Doe'}
              spellCheck={false}
            />
          </div>
        </div>

        <div className="panel converter-tab__pane">
          <div className="panel__header">
            <span className="panel__label">
              {state.urlMode === 'encode' ? 'Encoded Output' : 'Decoded URL'}
            </span>
          </div>
          <div className="panel__body">
            {state.urlError ? (
              <div className="converter-tab__error">
                <span className="text-error">✗ {state.urlError}</span>
              </div>
            ) : (
              <textarea
                className="json-textarea"
                value={state.urlOutput}
                readOnly
                placeholder="Output will appear here…"
                spellCheck={false}
              />
            )}
          </div>
        </div>
      </div>

      {/* Query string parser */}
      {queryParams.length > 0 && (
        <div className="url-params-section">
          <div className="url-params-section__title">Query Parameters</div>
          <table className="url-params-table">
            <thead>
              <tr>
                <th>Key</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {queryParams.map((p, i) => (
                <tr key={i}>
                  <td className="url-params-table__key">{p.key}</td>
                  <td className="url-params-table__val">{p.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
