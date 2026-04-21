import type { ChangeEvent, KeyboardEvent } from 'react'
import { CodeEditor } from './CodeEditor'
import { useApp } from '../../context/AppContext'

interface Props {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  readOnly?: boolean
}

export function JsonTextarea({ value, onChange, placeholder, readOnly }: Props) {
  const { state } = useApp()

  // Use CodeMirror for the editor
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <CodeEditor
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        theme={state.theme}
        syntaxTheme={state.editorSyntaxTheme}
      />
      {!value && placeholder && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 50,
            color: 'var(--text-muted)',
            pointerEvents: 'none',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            opacity: 0.6,
          }}
        >
          {placeholder}
        </div>
      )}
    </div>
  )
}

/** Fallback simple textarea (kept for XML tab and other non-JSON inputs) */
export function SimpleTextarea({ value, onChange, placeholder, readOnly }: Props) {
  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    onChange(e.target.value)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Tab') {
      e.preventDefault()
      const el = e.currentTarget
      const start = el.selectionStart
      const end = el.selectionEnd
      const newVal = value.substring(0, start) + '  ' + value.substring(end)
      onChange(newVal)
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 2
      })
    }
  }

  return (
    <textarea
      className="json-textarea"
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder={placeholder ?? 'Paste JSON here...'}
      spellCheck={false}
      autoCapitalize="off"
      autoCorrect="off"
      readOnly={readOnly}
    />
  )
}

