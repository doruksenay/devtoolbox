import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'

export function EditorDocTabs() {
  const { state, dispatch } = useApp()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId) inputRef.current?.select()
  }, [editingId])

  function startRename(id: string, name: string) {
    setEditingId(id)
    setDraft(name)
  }

  function commitRename() {
    if (editingId) dispatch({ type: 'RENAME_EDITOR_DOC', id: editingId, name: draft })
    setEditingId(null)
  }

  return (
    <div className="doc-tabs" role="tablist" aria-label="JSON documents">
      {state.editorDocs.map((doc) => {
        const active = doc.id === state.editorActiveDocId
        return (
          <div
            key={doc.id}
            role="tab"
            aria-selected={active}
            tabIndex={0}
            className={`doc-tabs__tab${active ? ' doc-tabs__tab--active' : ''}`}
            onClick={() => dispatch({ type: 'SELECT_EDITOR_DOC', id: doc.id })}
            onDoubleClick={() => startRename(doc.id, doc.name)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                dispatch({ type: 'SELECT_EDITOR_DOC', id: doc.id })
              }
            }}
            title="Double-click to rename"
          >
            {editingId === doc.id ? (
              <input
                ref={inputRef}
                className="doc-tabs__rename"
                aria-label={`Rename ${doc.name}`}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitRename}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === 'Enter') commitRename()
                  if (e.key === 'Escape') setEditingId(null)
                }}
              />
            ) : (
              <span className="doc-tabs__label">{doc.name}</span>
            )}
            <button
              className="doc-tabs__close"
              aria-label={`Close ${doc.name}`}
              title="Close tab"
              onClick={(e) => {
                e.stopPropagation()
                dispatch({ type: 'CLOSE_EDITOR_DOC', id: doc.id })
              }}
            >
              ×
            </button>
          </div>
        )
      })}
      <button
        className="doc-tabs__add"
        aria-label="New tab"
        title="New tab"
        onClick={() => dispatch({ type: 'ADD_EDITOR_DOC' })}
      >
        +
      </button>
    </div>
  )
}
