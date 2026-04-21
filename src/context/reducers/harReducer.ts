import type { AppState, AppAction } from '../../types'

export function harReducer(state: AppState, action: AppAction): AppState | null {
  switch (action.type) {
    case 'SET_HAR_RAW':
      return { ...state, harRaw: action.raw, harError: null, harSelectedEntry: null }
    case 'SET_HAR_ERROR':
      return { ...state, harError: action.error }
    case 'SET_HAR_SELECTED_ENTRY':
      return { ...state, harSelectedEntry: action.index }
    case 'SET_HAR_FILTER':
      return { ...state, harFilter: action.filter, harSelectedEntry: null }
    case 'SET_HAR_METHOD_FILTER':
      return { ...state, harMethodFilter: action.method, harSelectedEntry: null }
    case 'CLEAR_HAR':
      return { ...state, harRaw: '', harError: null, harSelectedEntry: null, harFilter: '', harMethodFilter: '' }
    default:
      return null
  }
}
