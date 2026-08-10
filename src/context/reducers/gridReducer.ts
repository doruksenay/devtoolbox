import type { AppState, AppAction } from '../../types'

export function gridReducer(state: AppState, action: AppAction): AppState | null {
  switch (action.type) {
    case 'SET_GRID_RAW':
      return {
        ...state,
        gridRaw: action.raw,
      }

    default:
      return null
  }
}
