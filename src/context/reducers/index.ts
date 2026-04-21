import type { AppState, AppAction } from '../../types'
import { editorReducer } from './editorReducer'
import { compareReducer } from './compareReducer'
import { xmlReducer } from './xmlReducer'
import { gridReducer } from './gridReducer'
import { queryReducer } from './queryReducer'
import { convertReducer } from './convertReducer'
import { harReducer } from './harReducer'
import { cronReducer } from './cronReducer'
import { jwtReducer } from './jwtReducer'
import { drawReducer } from './drawReducer'
import { yamlReducer } from './yamlReducer'
import { base64Reducer } from './base64Reducer'
import { urlReducer } from './urlReducer'

const featureReducers = [
  editorReducer,
  compareReducer,
  xmlReducer,
  gridReducer,
  queryReducer,
  convertReducer,
  harReducer,
  cronReducer,
  jwtReducer,
  drawReducer,
  yamlReducer,
  base64Reducer,
  urlReducer,
]

export function rootReducer(state: AppState, action: AppAction): AppState {
  // Global actions
  switch (action.type) {
    case 'SET_TAB':
      return { ...state, activeTab: action.tab }
    case 'TOGGLE_THEME':
      return { ...state, theme: state.theme === 'dark' ? 'light' : 'dark' }
    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarCollapsed: !state.sidebarCollapsed }
    case 'TOGGLE_COMMAND_PALETTE':
      return { ...state, commandPaletteOpen: !state.commandPaletteOpen }
    case 'SET_COMMAND_PALETTE_OPEN':
      return { ...state, commandPaletteOpen: action.open }
  }

  // Delegate to feature reducers
  for (const reducer of featureReducers) {
    const result = reducer(state, action)
    if (result !== null) return result
  }

  return state
}
