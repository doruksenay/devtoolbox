import type { AppState, AppAction } from '../../types'

export function taxReducer(state: AppState, action: AppAction): AppState | null {
  switch (action.type) {
    case 'SET_TAX_AMOUNT':
      return { ...state, taxAmount: action.amount }
    case 'SET_TAX_PROVINCE':
      return { ...state, taxProvince: action.province }
    case 'SET_TAX_INCLUDES_TAX':
      return { ...state, taxIncludesTax: action.included }
    case 'CLEAR_TAX':
      return { ...state, taxAmount: '' }
    default:
      return null
  }
}
