import type { AppState, AppAction } from '../../types'

export function yamlReducer(state: AppState, action: AppAction): AppState | null {
  switch (action.type) {
    case 'SET_YAML_INPUT':
      return { ...state, yamlInput: action.input }
    case 'SET_YAML_OUTPUT':
      return { ...state, yamlOutput: action.output, yamlError: null }
    case 'SET_YAML_ERROR':
      return { ...state, yamlError: action.error, yamlOutput: '' }
    case 'SET_YAML_MODE':
      return { ...state, yamlMode: action.mode, yamlOutput: '', yamlError: null }
    case 'CLEAR_YAML':
      return { ...state, yamlInput: '', yamlOutput: '', yamlError: null }
    default:
      return null
  }
}
