import type { AppState, AppAction, TabId } from '../../types'
import type { EditorSyntaxTheme } from '../../utils/editorThemes'
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
import { soapReducer } from './soapReducer'

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
  soapReducer,
]

export function rootReducer(state: AppState, action: AppAction): AppState {
  // Global actions
  switch (action.type) {
    case 'SET_TAB':
      return { ...state, activeTab: action.tab }
    case 'TOGGLE_THEME':
      return { ...state, theme: state.theme === 'dark' ? 'light' : 'dark' }
    case 'SET_EDITOR_SYNTAX_THEME':
      return { ...state, editorSyntaxTheme: action.theme }
    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarCollapsed: !state.sidebarCollapsed }
    case 'TOGGLE_COMMAND_PALETTE':
      return { ...state, commandPaletteOpen: !state.commandPaletteOpen }
    case 'SET_COMMAND_PALETTE_OPEN':
      return { ...state, commandPaletteOpen: action.open }
    case 'LOAD_PERSISTED_STATE': {
      const s = action.payload
      return {
        ...state,
        activeTab: (s.activeTab as TabId) ?? state.activeTab,
        editorRaw: s.editorRaw ?? state.editorRaw,
        compareLeft: s.compareLeft ?? state.compareLeft,
        compareRight: s.compareRight ?? state.compareRight,
        xmlRaw: s.xmlRaw ?? state.xmlRaw,
        gridRaw: s.gridRaw ?? state.gridRaw,
        gridPath: s.gridPath ?? state.gridPath,
        queryRaw: s.queryRaw ?? state.queryRaw,
        queryExpression: s.queryExpression ?? state.queryExpression,
        theme: (s.theme as 'dark' | 'light') ?? state.theme,
        editorSyntaxTheme: (s.editorSyntaxTheme as EditorSyntaxTheme) ?? state.editorSyntaxTheme,
        sidebarCollapsed: typeof s.sidebarCollapsed === 'boolean' ? s.sidebarCollapsed : state.sidebarCollapsed,
      }
    }
  }

  // Delegate to feature reducers
  for (const reducer of featureReducers) {
    const result = reducer(state, action)
    if (result !== null) return result
  }

  return state
}
