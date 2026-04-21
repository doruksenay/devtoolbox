import { useCallback } from 'react'
import yaml from 'js-yaml'
import { useApp } from '../../context/AppContext'
import { useToast } from '../Toast/ToastProvider'

export function YamlTab() {
  const { state, dispatch } = useApp()
  const { addToast } = useToast()

  const handleConvert = useCallback(() => {
    const input = state.yamlInput.trim()
    if (!input) return
    try {
      if (state.yamlMode === 'yaml-to-json') {
        const parsed = yaml.load(input)
        const output = JSON.stringify(parsed, null, 2)
        dispatch({ type: 'SET_YAML_OUTPUT', output, error: null })
      } else {
        const parsed = JSON.parse(input)
        const output = yaml.dump(parsed, { indent: 2 })
        dispatch({ type: 'SET_YAML_OUTPUT', output, error: null })
      }
    } catch (e) {
      dispatch({ type: 'SET_YAML_ERROR', error: (e as Error).message })
    }
  }, [state.yamlInput, state.yamlMode, dispatch])

  const handleCopy = useCallback(() => {
    if (!state.yamlOutput) return
    navigator.clipboard.writeText(state.yamlOutput).then(() => addToast('Copied to clipboard'))
  }, [state.yamlOutput, addToast])

  const handleDownload = useCallback(() => {
    if (!state.yamlOutput) return
    const ext = state.yamlMode === 'yaml-to-json' ? 'json' : 'yaml'
    const mime = state.yamlMode === 'yaml-to-json' ? 'application/json' : 'application/x-yaml'
    const blob = new Blob([state.yamlOutput], { type: mime })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `output.${ext}`
    a.click()
    URL.revokeObjectURL(a.href)
    addToast('Downloaded')
  }, [state.yamlOutput, state.yamlMode, addToast])

  const hasInput = state.yamlInput.trim().length > 0
  const hasOutput = state.yamlOutput.trim().length > 0

  return (
    <div className="converter-tab">
      <div className="converter-tab__toolbar">
        <div className="mode-toggle">
          <button
            className={`mode-toggle__btn${state.yamlMode === 'yaml-to-json' ? ' mode-toggle__btn--active' : ''}`}
            onClick={() => dispatch({ type: 'SET_YAML_MODE', mode: 'yaml-to-json' })}
          >
            YAML → JSON
          </button>
          <button
            className={`mode-toggle__btn${state.yamlMode === 'json-to-yaml' ? ' mode-toggle__btn--active' : ''}`}
            onClick={() => dispatch({ type: 'SET_YAML_MODE', mode: 'json-to-yaml' })}
          >
            JSON → YAML
          </button>
        </div>

        <div className="toolbar-sep" />

        <button className="btn btn-primary" onClick={handleConvert} disabled={!hasInput}>
          Convert
        </button>
        <button className="btn btn-ghost" onClick={handleCopy} disabled={!hasOutput}>
          Copy Output
        </button>
        <button className="btn btn-ghost" onClick={handleDownload} disabled={!hasOutput}>
          Download
        </button>

        <div className="toolbar-sep" />
        <button
          className="btn btn-danger"
          onClick={() => dispatch({ type: 'CLEAR_YAML' })}
          disabled={!hasInput && !hasOutput}
        >
          Clear
        </button>
      </div>

      <div className="converter-tab__panels">
        <div className="panel converter-tab__pane">
          <div className="panel__header">
            <span className="panel__label">
              {state.yamlMode === 'yaml-to-json' ? 'YAML Input' : 'JSON Input'}
            </span>
            {hasInput && (
              <span className="text-xs text-muted mono">
                {state.yamlInput.length} chars
              </span>
            )}
          </div>
          <div className="panel__body">
            <textarea
              className="json-textarea"
              value={state.yamlInput}
              onChange={e => dispatch({ type: 'SET_YAML_INPUT', input: e.target.value })}
              placeholder={state.yamlMode === 'yaml-to-json'
                ? 'name: John\nage: 30\naddress:\n  city: Istanbul'
                : '{\n  "name": "John",\n  "age": 30\n}'}
              spellCheck={false}
              autoCapitalize="off"
            />
          </div>
        </div>

        <div className="panel converter-tab__pane">
          <div className="panel__header">
            <span className="panel__label">
              {state.yamlMode === 'yaml-to-json' ? 'JSON Output' : 'YAML Output'}
            </span>
            {hasOutput && (
              <span className="text-xs text-muted mono">
                {state.yamlOutput.length} chars
              </span>
            )}
          </div>
          <div className="panel__body">
            {state.yamlError ? (
              <div className="converter-tab__error">
                <span className="text-error">✗ {state.yamlError}</span>
              </div>
            ) : (
              <textarea
                className="json-textarea"
                value={state.yamlOutput}
                readOnly
                placeholder="Output will appear here after conversion…"
                spellCheck={false}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
