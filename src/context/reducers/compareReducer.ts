import type { AppState, AppAction } from '../../types'

export function compareReducer(state: AppState, action: AppAction): AppState | null {
  switch (action.type) {
    case 'SET_COMPARE_LEFT':
      return {
        ...state,
        compareLeft: action.raw,
        compareLeftParsed: null,
        compareLeftError: null,
        compareLines: null,
        compareEqual: null,
        compareError: null,
      }

    case 'SET_COMPARE_RIGHT':
      return {
        ...state,
        compareRight: action.raw,
        compareRightParsed: null,
        compareRightError: null,
        compareLines: null,
        compareEqual: null,
        compareError: null,
      }

    case 'SET_COMPARE_RESULT':
      return {
        ...state,
        compareLines: action.lines,
        compareEqual: action.equal,
        compareError: null,
      }

    case 'SET_COMPARE_PARSED':
      return {
        ...state,
        compareLeftParsed: action.compareLeftParsed,
        compareRightParsed: action.compareRightParsed,
        compareError: null,
      }

    case 'SET_COMPARE_ERROR':
      return { ...state, compareError: action.error }

    case 'CLEAR_COMPARE':
      return {
        ...state,
        compareLeft: '',
        compareRight: '',
        compareLeftParsed: null,
        compareRightParsed: null,
        compareLeftError: null,
        compareRightError: null,
        compareLines: null,
        compareEqual: null,
        compareError: null,
      }

    default:
      return null
  }
}
