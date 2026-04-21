import type { AppState, AppAction } from '../../types'

export function base64Reducer(state: AppState, action: AppAction): AppState | null {
  switch (action.type) {
    case 'SET_BASE64_INPUT':
      return { ...state, base64Input: action.input }
    case 'SET_BASE64_OUTPUT':
      return { ...state, base64Output: action.output, base64Error: null }
    case 'SET_BASE64_ERROR':
      return { ...state, base64Error: action.error, base64Output: '' }
    case 'SET_BASE64_MODE':
      return { ...state, base64Mode: action.mode, base64Output: '', base64Error: null }
    case 'CLEAR_BASE64':
      return { ...state, base64Input: '', base64Output: '', base64Error: null }
    default:
      return null
  }
}
