import type { AppState, AppAction } from '../../types'

export function jwtReducer(state: AppState, action: AppAction): AppState | null {
  switch (action.type) {
    case 'SET_JWT_INPUT':
      return { ...state, jwtInput: action.input, jwtError: null }
    case 'CLEAR_JWT':
      return { ...state, jwtInput: '', jwtError: null }
    default:
      return null
  }
}
