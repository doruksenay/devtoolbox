import type { ChangeEvent, KeyboardEvent } from 'react'

interface Props {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  readOnly?: boolean
}

export function JsonTextarea({ value, onChange, placeholder, readOnly }: Props) {
  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    onChange(e.target.value)
  }

  // Support Tab key indentation
  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Tab') {
      e.preventDefault()
      const el = e.currentTarget
      const start = el.selectionStart
      const end = el.selectionEnd
      const newVal = value.substring(0, start) + '  ' + value.substring(end)
      onChange(newVal)
      // Restore cursor after React re-render
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
