import type { AppState, AppAction } from '../../types'
import { makeDoc, nextDocName, syncActiveDoc } from './editorDocs'

export function editorReducer(state: AppState, action: AppAction): AppState | null {
  switch (action.type) {
    case 'SET_EDITOR_RAW':
      return {
        ...state,
        editorRaw: action.raw,
        editorDocs: syncActiveDoc(state, action.raw),
        editorValid: null,
        editorError: null,
        editorParsed: null,
      }

    case 'SET_EDITOR_PARSED':
      return {
        ...state,
        editorParsed: action.parsed,
        editorValid: true,
        editorError: null,
      }

    case 'SET_EDITOR_ERROR':
      return {
        ...state,
        editorValid: false,
        editorError: action.error,
        editorParsed: null,
      }

    case 'CLEAR_EDITOR':
      return {
        ...state,
        editorRaw: '',
        editorDocs: syncActiveDoc(state, ''),
        editorParsed: null,
        editorValid: null,
        editorError: null,
      }

    case 'ADD_EDITOR_DOC': {
      const raw = action.raw ?? ''
      // Reuse a single empty tab instead of leaving a blank one behind.
      if (raw && state.editorDocs.length === 1 && !state.editorDocs[0].raw.trim()) {
        const only = state.editorDocs[0]
        return {
          ...state,
          editorDocs: [{ ...only, name: action.name?.trim() || only.name, raw }],
          editorActiveDocId: only.id,
          editorRaw: raw,
          editorParsed: null,
          editorValid: null,
          editorError: null,
        }
      }
      const doc = makeDoc(action.name?.trim() || nextDocName(state.editorDocs), raw)
      return {
        ...state,
        editorDocs: [...state.editorDocs, doc],
        editorActiveDocId: doc.id,
        editorRaw: raw,
        editorParsed: null,
        editorValid: null,
        editorError: null,
      }
    }

    case 'CLOSE_EDITOR_DOC': {
      const index = state.editorDocs.findIndex((d) => d.id === action.id)
      if (index === -1) return state

      const remaining = state.editorDocs.filter((d) => d.id !== action.id)
      if (remaining.length === 0) {
        const doc = makeDoc('Tab 1')
        return {
          ...state,
          editorDocs: [doc],
          editorActiveDocId: doc.id,
          editorRaw: '',
          editorParsed: null,
          editorValid: null,
          editorError: null,
        }
      }

      if (action.id !== state.editorActiveDocId) {
        return { ...state, editorDocs: remaining }
      }

      const next = remaining[Math.min(index, remaining.length - 1)]
      return {
        ...state,
        editorDocs: remaining,
        editorActiveDocId: next.id,
        editorRaw: next.raw,
        editorParsed: null,
        editorValid: null,
        editorError: null,
      }
    }

    case 'SELECT_EDITOR_DOC': {
      if (action.id === state.editorActiveDocId) return state
      const doc = state.editorDocs.find((d) => d.id === action.id)
      if (!doc) return state
      return {
        ...state,
        editorActiveDocId: doc.id,
        editorRaw: doc.raw,
        editorParsed: null,
        editorValid: null,
        editorError: null,
      }
    }

    case 'RENAME_EDITOR_DOC': {
      const name = action.name.trim()
      if (!name) return state
      return {
        ...state,
        editorDocs: state.editorDocs.map((d) =>
          d.id === action.id ? { ...d, name } : d
        ),
      }
    }

    default:
      return null
  }
}
