import type { AppState, AppAction } from '../../types'

export function taxReducer(state: AppState, action: AppAction): AppState | null {
  switch (action.type) {
    case 'SET_TAX_INCOME':
      return { ...state, taxIncome: action.income }
    case 'SET_TAX_PROVINCE':
      return { ...state, taxProvince: action.province }
    case 'CLEAR_TAX':
      return { ...state, taxIncome: '' }
    default:
      return null
  }
}
