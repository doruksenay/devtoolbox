import type { AppState, AppAction } from '../../types'

export function drawReducer(state: AppState, action: AppAction): AppState | null {
  switch (action.type) {
    case 'SET_DRAW_SHAPES':
      return { ...state, drawShapes: action.shapes }
    case 'SET_DRAW_CONNECTIONS':
      return { ...state, drawConnections: action.connections }
    case 'SET_DRAW_TOOL':
      return { ...state, drawTool: action.tool }
    case 'SET_DRAW_SELECTED_IDS':
      return { ...state, drawSelectedIds: action.ids }
    case 'SET_DRAW_SELECTED_COLOR':
      return { ...state, drawSelectedColor: action.color }
    case 'CLEAR_DRAW':
      return { ...state, drawShapes: [], drawConnections: [], drawSelectedIds: [] }
    default:
      return null
  }
}
