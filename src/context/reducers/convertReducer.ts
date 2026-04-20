import type { AppState, AppAction } from '../../types'

export function convertReducer(state: AppState, action: AppAction): AppState | null {
  switch (action.type) {
    case 'SET_CONVERT_INPUT':
      return { ...state, convertInput: action.raw, convertError: null }
    case 'SET_CONVERT_OUTPUT':
      return { ...state, convertOutput: action.output, convertError: null }
    case 'SET_CONVERT_MODE':
      return { ...state, convertMode: action.mode, convertOutput: '', convertError: null }
    case 'SET_CONVERT_ERROR':
      return { ...state, convertError: action.error, convertOutput: '' }
    case 'CLEAR_CONVERT':
      return { ...state, convertInput: '', convertOutput: '', convertError: null }
    case 'SET_SCHEMA_INPUT':
      return { ...state, schemaInput: action.raw, schemaError: null, schemaValid: null }
    case 'SET_SCHEMA_RESULT':
      return { ...state, schemaValid: action.valid, schemaError: action.error }
    case 'SET_FETCH_URL':
      return { ...state, fetchUrl: action.url, fetchError: null }
    case 'SET_FETCH_LOADING':
      return { ...state, fetchLoading: action.loading }
    case 'SET_FETCH_ERROR':
      return { ...state, fetchError: action.error, fetchLoading: false }
    default:
      return null
  }
}
