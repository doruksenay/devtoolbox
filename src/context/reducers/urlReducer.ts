import type { AppState, AppAction } from '../../types'

export function urlReducer(state: AppState, action: AppAction): AppState | null {
  switch (action.type) {
    case 'SET_URL_INPUT':
      return { ...state, urlInput: action.input }
    case 'SET_URL_OUTPUT':
      return { ...state, urlOutput: action.output, urlError: null }
    case 'SET_URL_ERROR':
      return { ...state, urlError: action.error, urlOutput: '' }
    case 'SET_URL_MODE':
      return { ...state, urlMode: action.mode, urlOutput: '', urlError: null }
    case 'CLEAR_URL':
      return { ...state, urlInput: '', urlOutput: '', urlError: null }
    default:
      return null
  }
}
