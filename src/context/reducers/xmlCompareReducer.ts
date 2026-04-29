import type { AppState, AppAction } from '../../types'

export function xmlCompareReducer(state: AppState, action: AppAction): AppState | null {
  switch (action.type) {
    case 'SET_XML_COMPARE_LEFT':
      return {
        ...state,
        xmlCompareLeft: action.raw,
        xmlCompareLines: null,
        xmlCompareEqual: null,
        xmlCompareError: null,
      }

    case 'SET_XML_COMPARE_RIGHT':
      return {
        ...state,
        xmlCompareRight: action.raw,
        xmlCompareLines: null,
        xmlCompareEqual: null,
        xmlCompareError: null,
      }

    case 'SET_XML_COMPARE_RESULT':
      return {
        ...state,
        xmlCompareLines: action.lines,
        xmlCompareEqual: action.equal,
        xmlCompareError: null,
      }

    case 'SET_XML_COMPARE_ERROR':
      return {
        ...state,
        xmlCompareLines: null,
        xmlCompareEqual: null,
        xmlCompareError: action.error,
      }

    case 'CLEAR_XML_COMPARE':
      return {
        ...state,
        xmlCompareLeft: '',
        xmlCompareRight: '',
        xmlCompareLines: null,
        xmlCompareEqual: null,
        xmlCompareError: null,
      }

    default:
      return null
  }
}
