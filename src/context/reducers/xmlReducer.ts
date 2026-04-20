import type { AppState, AppAction } from '../../types'

export function xmlReducer(state: AppState, action: AppAction): AppState | null {
  switch (action.type) {
    case 'SET_XML_RAW':
      return {
        ...state,
        xmlRaw: action.raw,
        xmlValid: null,
        xmlError: null,
      }

    case 'SET_XML_VALID':
      return {
        ...state,
        xmlValid: true,
        xmlError: null,
      }

    case 'SET_XML_ERROR':
      return {
        ...state,
        xmlValid: false,
        xmlError: action.error,
      }

    case 'CLEAR_XML':
      return {
        ...state,
        xmlRaw: '',
        xmlValid: null,
        xmlError: null,
      }

    default:
      return null
  }
}
