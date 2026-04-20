import type { AppState, AppAction } from '../../types'

export function queryReducer(state: AppState, action: AppAction): AppState | null {
  switch (action.type) {
    case 'SET_QUERY_RAW':
      return {
        ...state,
        queryRaw: action.raw,
        queryParsed: null,
        queryError: null,
        queryResults: null,
        queryPaths: null,
        queryRunError: null,
      }

    case 'SET_QUERY_EXPRESSION':
      return {
        ...state,
        queryExpression: action.expr,
        queryResults: null,
        queryPaths: null,
        queryRunError: null,
      }

    case 'SET_QUERY_RESULTS':
      return {
        ...state,
        queryResults: action.results,
        queryPaths: action.paths,
        queryRunError: null,
      }

    case 'SET_QUERY_RUN_ERROR':
      return {
        ...state,
        queryResults: null,
        queryPaths: null,
        queryRunError: action.error,
      }

    default:
      return null
  }
}
