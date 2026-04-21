import type { AppState, AppAction } from '../../types'

export function cronReducer(state: AppState, action: AppAction): AppState | null {
  switch (action.type) {
    case 'SET_CRON_EXPRESSION':
      return { ...state, cronExpression: action.expression, cronError: null }
    default:
      return null
  }
}
