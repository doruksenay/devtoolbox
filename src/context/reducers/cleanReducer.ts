import type { AppState, AppAction } from '../../types'

export function cleanReducer(state: AppState, action: AppAction): AppState | null {
  switch (action.type) {
    case 'SET_CLEAN_INPUT':
      return { ...state, cleanInput: action.input }
    case 'CLEAR_CLEAN':
      return { ...state, cleanInput: '' }
    default:
      return null
  }
}
