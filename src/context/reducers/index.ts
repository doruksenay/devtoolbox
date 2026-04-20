import type { AppState, AppAction } from '../../types'
import { editorReducer } from './editorReducer'
import { compareReducer } from './compareReducer'
import { xmlReducer } from './xmlReducer'
import { gridReducer } from './gridReducer'
import { queryReducer } from './queryReducer'

const featureReducers = [
  editorReducer,
  compareReducer,
  xmlReducer,
  gridReducer,
  queryReducer,
]

export function rootReducer(state: AppState, action: AppAction): AppState {
  // Global actions
  switch (action.type) {
    case 'SET_TAB':
      return { ...state, activeTab: action.tab }
    case 'TOGGLE_THEME':
      return { ...state, theme: state.theme === 'dark' ? 'light' : 'dark' }
  }

  // Delegate to feature reducers
  for (const reducer of featureReducers) {
    const result = reducer(state, action)
    if (result !== null) return result
  }

  return state
}
