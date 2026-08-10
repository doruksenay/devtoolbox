import type { AppState, AppAction } from '../../types'
import { isTabId } from '../../types'
import type { EditorSyntaxTheme } from '../../utils/editorThemes'
import { editorReducer } from './editorReducer'
import { restoreEditorDocs } from './editorDocs'
import { compareReducer } from './compareReducer'
import { xmlReducer } from './xmlReducer'
import { gridReducer } from './gridReducer'
import { queryReducer } from './queryReducer'
import { harReducer } from './harReducer'
import { cronReducer } from './cronReducer'
import { jwtReducer } from './jwtReducer'
import { drawReducer } from './drawReducer'
import { cleanReducer } from './cleanReducer'
import { taxReducer } from './taxReducer'
import { getRegion } from '../../utils/salesTaxCanada'

const featureReducers = [
  editorReducer,
  compareReducer,
  xmlReducer,
  gridReducer,
  queryReducer,
  harReducer,
  cronReducer,
  jwtReducer,
  drawReducer,
  cleanReducer,
  taxReducer,
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
      // Persisted rows can predate tool/region removals, so anything that maps
      // onto a fixed set is validated before it is restored — an unknown value
      // would otherwise leave the app rendering nothing.
      return {
        ...state,
        activeTab: isTabId(s.activeTab) ? s.activeTab : state.activeTab,
        ...restoreEditorDocs(state, s),
        compareLeft: s.compareLeft ?? state.compareLeft,
        compareRight: s.compareRight ?? state.compareRight,
        xmlRaw: s.xmlRaw ?? state.xmlRaw,
        gridRaw: s.gridRaw ?? state.gridRaw,
        queryRaw: s.queryRaw ?? state.queryRaw,
        queryExpression: s.queryExpression ?? state.queryExpression,
        taxAmount: s.taxAmount ?? state.taxAmount,
        taxProvince: s.taxProvince && getRegion(s.taxProvince) ? s.taxProvince : state.taxProvince,
        taxIncludesTax: s.taxIncludesTax ?? state.taxIncludesTax,
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
