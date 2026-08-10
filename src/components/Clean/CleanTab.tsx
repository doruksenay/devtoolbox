import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { useToast } from '../Toast/ToastProvider'
import { cleanText, DEFAULT_CLEAN_OPTIONS, type CleanOptions } from '../../utils/textClean'

const OPTIONS_KEY = 'devtoolbox_clean_options'

const OPTION_LABELS: { key: keyof CleanOptions; label: string; title: string }[] = [
  { key: 'decodeEntities', label: 'Decode HTML entities', title: 'Convert &amp; → &, &#10; → newline, &nbsp; → space, …' },
  { key: 'replaceSpaces', label: 'Normalize spaces', title: 'Replace non-breaking & special spaces with a regular space' },
  { key: 'removeInvisibles', label: 'Remove invisible chars', title: 'Strip zero-width spaces, BOM, soft hyphens, …' },
  { key: 'trimTrailing', label: 'Trim trailing whitespace', title: 'Remove spaces/tabs at the end of each line' },
]

function loadOptions(): CleanOptions {
  try {
    const raw = localStorage.getItem(OPTIONS_KEY)
    if (raw) return { ...DEFAULT_CLEAN_OPTIONS, ...(JSON.parse(raw) as Partial<CleanOptions>) }
  } catch {
    // ignore
  }
  return DEFAULT_CLEAN_OPTIONS
}

export function CleanTab() {
  const { state, dispatch } = useApp()
  const { addToast } = useToast()

  const [options, setOptions] = useState<CleanOptions>(loadOptions)

  useEffect(() => {
    try {
      localStorage.setItem(OPTIONS_KEY, JSON.stringify(options))
    } catch {
      // ignore quota errors
    }
  }, [options])

  const setOption = useCallback((key: keyof CleanOptions, value: boolean) => {
    setOptions(prev => ({ ...prev, [key]: value }))
  }, [])

  const result = useMemo(
    () => cleanText(state.cleanInput, options),
    [state.cleanInput, options]
  )

  const handleCopy = useCallback(() => {
    if (!result.output) return
    navigator.clipboard.writeText(result.output).then(() => addToast('Copied to clipboard'))
  }, [result.output, addToast])

  const hasInput = state.cleanInput.length > 0
  const changed = result.output !== state.cleanInput
  const totalIssues = result.entityCount + result.findings.reduce((sum, f) => sum + f.count, 0)

  return (
    <div className="converter-tab">
      <div className="converter-tab__toolbar">
        <div className="clean-options">
          {OPTION_LABELS.map(opt => (
            <label key={opt.key} className="clean-options__item" title={opt.title} htmlFor={`clean-opt-${opt.key}`}>
              <input
                id={`clean-opt-${opt.key}`}
                type="checkbox"
                checked={options[opt.key]}
                onChange={e => setOption(opt.key, e.target.checked)}
                aria-labelledby={`clean-opt-label-${opt.key}`}
              />
              <span id={`clean-opt-label-${opt.key}`}>{opt.label}</span>
            </label>
          ))}
        </div>

        <div className="toolbar-sep" />

        <button className="btn btn-ghost" onClick={handleCopy} disabled={!result.output}>
          Copy Output
        </button>
        <button
          className="btn btn-primary"
          onClick={() => dispatch({ type: 'SET_CLEAN_INPUT', input: result.output })}
          disabled={!changed}
          title="Replace the input with the cleaned output"
        >
          Apply
        </button>

        <div className="toolbar-sep" />
        <button
          className="btn btn-danger"
          onClick={() => dispatch({ type: 'CLEAR_CLEAN' })}
          disabled={!hasInput}
        >
          Clear
        </button>
      </div>

      <div className="converter-tab__panels">
        <div className="panel converter-tab__pane">
          <div className="panel__header">
            <span className="panel__label" id="clean-input-label">Input (paste your code / text)</span>
            {hasInput && (
              <span className="text-xs text-muted mono">{state.cleanInput.length} chars</span>
            )}
          </div>
          <div className="panel__body">
            <textarea
              className="json-textarea"
              value={state.cleanInput}
              onChange={e => dispatch({ type: 'SET_CLEAN_INPUT', input: e.target.value })}
              placeholder="Paste text containing &amp;amp;, &amp;nbsp;, zero-width spaces, …"
              spellCheck={false}
              aria-labelledby="clean-input-label"
            />
          </div>
        </div>

        <div className="panel converter-tab__pane">
          <div className="panel__header">
            <span className="panel__label" id="clean-output-label">Cleaned Output</span>
            {result.output.length > 0 && (
              <span className="text-xs text-muted mono">{result.output.length} chars</span>
            )}
          </div>
          <div className="panel__body">
            <textarea
              className="json-textarea"
              value={result.output}
              readOnly
              placeholder="Cleaned text will appear here…"
              spellCheck={false}
              aria-labelledby="clean-output-label"
            />
          </div>
        </div>
      </div>

      {/* Findings report */}
      <div className="url-params-section">
        <div className="url-params-section__title">
          Detected Issues
          {hasInput && (
            <span className="clean-report__badge">
              {totalIssues === 0 ? 'none' : totalIssues}
            </span>
          )}
        </div>
        {!hasInput ? (
          <div className="clean-report__empty">Paste text above to scan for hidden characters.</div>
        ) : totalIssues === 0 ? (
          <div className="clean-report__empty">✓ No HTML entities or invisible characters found.</div>
        ) : (
          <table className="url-params-table">
            <thead>
              <tr>
                <th scope="col">Type</th>
                <th scope="col">Code</th>
                <th scope="col">Count</th>
              </tr>
            </thead>
            <tbody>
              {result.entityCount > 0 && (
                <tr>
                  <td className="url-params-table__key">HTML entities (e.g. &amp;amp;)</td>
                  <td className="url-params-table__val">&amp;…;</td>
                  <td className="url-params-table__val">{result.entityCount}</td>
                </tr>
              )}
              {result.findings.map(f => (
                <tr key={f.code}>
                  <td className="url-params-table__key">{f.label}</td>
                  <td className="url-params-table__val">{f.code}</td>
                  <td className="url-params-table__val">{f.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
