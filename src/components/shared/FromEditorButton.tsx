import { useState } from 'react'
import { useApp } from '../../context/AppContext'

interface Props {
  /** Called with the raw content of the chosen editor document. */
  onPick: (raw: string) => void
  title?: string
  label?: string
}

/**
 * "From Editor" button. When the editor has more than one document open, a bar
 * appears at the bottom asking which tab to pull the JSON from.
 */
export function FromEditorButton({ onPick, title = 'Copy JSON from Editor tab', label = 'From Editor' }: Props) {
  const { state } = useApp()
  const [picking, setPicking] = useState(false)

  const docs = state.editorDocs
  const hasContent = docs.some((d) => d.raw.trim())

  function handleClick() {
    if (!hasContent) return
    if (docs.length <= 1) {
      const raw = docs[0]?.raw ?? state.editorRaw
      if (raw.trim()) onPick(raw)
      return
    }
    setPicking(true)
  }

  return (
    <>
      <button
        className="btn btn-ghost"
        style={{ fontSize: 11 }}
        onClick={handleClick}
        title={title}
      >
        {label}
      </button>

      {picking && (
        <div className="editor-picker-bar" role="dialog" aria-label="Choose editor tab">
          <span className="editor-picker-bar__label">Which editor tab?</span>
          <div className="editor-picker-bar__tabs">
            {docs.map((doc) => (
              <button
                key={doc.id}
                className="btn btn-ghost editor-picker-bar__tab"
                disabled={!doc.raw.trim()}
                title={doc.raw.trim() ? doc.name : `${doc.name} (empty)`}
                onClick={() => {
                  setPicking(false)
                  onPick(doc.raw)
                }}
              >
                {doc.name}
              </button>
            ))}
          </div>
          <button
            className="btn btn-ghost editor-picker-bar__cancel"
            onClick={() => setPicking(false)}
          >
            Cancel
          </button>
        </div>
      )}
    </>
  )
}
