import type { AppState, AppAction } from '../../types'

export function soapReducer(state: AppState, action: AppAction): AppState | null {
  switch (action.type) {
    case 'SET_SOAP_INPUT':
      return { ...state, soapInput: action.input, soapError: null }
    case 'SET_SOAP_ERROR':
      return { ...state, soapError: action.error }
    case 'CLEAR_SOAP':
      return { ...state, soapInput: '', soapError: null }
    default:
      return null
  }
}
