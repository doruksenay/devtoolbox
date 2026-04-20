import type { AppState, AppAction } from '../../types'

export function editorReducer(state: AppState, action: AppAction): AppState | null {
  switch (action.type) {
    case 'SET_EDITOR_RAW':
      return {
        ...state,
        editorRaw: action.raw,
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
        editorParsed: null,
        editorValid: null,
        editorError: null,
      }

    default:
      return null
  }
}
