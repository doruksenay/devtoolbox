import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  type ReactNode,
  type Dispatch,
} from 'react'
import { JSONPath } from 'jsonpath-plus'
import * as Diff from 'diff'
import type { AppState, AppAction, TabId, DiffLine, ParseResult } from '../types'

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

const STORAGE_KEY = 'json_workbench_state_v1'

export function parseJson(raw: string): ParseResult {
  if (!raw.trim()) return { valid: false, parsed: null, error: 'Input is empty' }
  try {
    const parsed = JSON.parse(raw)
    return { valid: true, parsed, error: null }
  } catch (e) {
    return { valid: false, parsed: null, error: (e as Error).message }
  }
}

function parseXml(raw: string): { valid: boolean; error: string | null } {
  if (!raw.trim()) return { valid: false, error: 'Input is empty' }
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(raw, 'application/xml')
    const parseError = doc.querySelector('parsererror')
    if (parseError) {
      return { valid: false, error: parseError.textContent?.trim() ?? 'Invalid XML' }
    }
    return { valid: true, error: null }
  } catch (e) {
    return { valid: false, error: (e as Error).message }
  }
}

function beautify(raw: string): string {
  return JSON.stringify(JSON.parse(raw), null, 2)
}

// ─────────────────────────────────────────────
//  Initial state (loaded from localStorage)
// ─────────────────────────────────────────────
function loadPersistedState(): Partial<AppState> {
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    if (!s) return {}
    return JSON.parse(s) as Partial<AppState>
  } catch {
    return {}
  }
}

const persisted = loadPersistedState()

const initialState: AppState = {
  activeTab: (persisted.activeTab as TabId) ?? 'editor',
  editorRaw: persisted.editorRaw ?? '',
  editorParsed: null,
  editorValid: null,
  editorError: null,
  compareLeft: persisted.compareLeft ?? '',
  compareLeftParsed: null,
  compareLeftError: null,
  compareRight: persisted.compareRight ?? '',
  compareRightParsed: null,
  compareRightError: null,
  compareLines: null,
  compareEqual: null,
  compareError: null,
  xmlRaw: persisted.xmlRaw ?? '',
  xmlValid: null,
  xmlError: null,
  gridRaw: persisted.gridRaw ?? '',
  gridParsed: null,
  gridError: null,
  gridPath: persisted.gridPath ?? '$',
  queryRaw: persisted.queryRaw ?? '',
  queryParsed: null,
  queryError: null,
  queryExpression: persisted.queryExpression ?? '',
  queryResults: null,
  queryPaths: null,
  queryRunError: null,
  theme: (persisted.theme as 'dark' | 'light') ?? 'dark',
}

// ─────────────────────────────────────────────
//  Reducer
// ─────────────────────────────────────────────
function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_TAB':
      return { ...state, activeTab: action.tab }

    case 'SET_EDITOR_RAW':
      return {
        ...state,
        editorRaw: action.raw,
        editorValid: null,
        editorError: null,
        editorParsed: null,
      }

    case 'SET_EDITOR_PARSED':
      return {
        ...state,
        editorParsed: action.parsed,
        editorValid: true,
        editorError: null,
      }

    case 'SET_EDITOR_ERROR':
      return {
        ...state,
        editorValid: false,
        editorError: action.error,
        editorParsed: null,
      }

    case 'CLEAR_EDITOR':
      return {
        ...state,
        editorRaw: '',
        editorParsed: null,
        editorValid: null,
        editorError: null,
      }

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

    case 'SET_GRID_RAW':
      return {
        ...state,
        gridRaw: action.raw,
        gridParsed: null,
        gridError: null,
      }

    case 'SET_GRID_PATH':
      return { ...state, gridPath: action.path }

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

    case 'TOGGLE_THEME':
      return { ...state, theme: state.theme === 'dark' ? 'light' : 'dark' }

    default:
      return state
  }
}

// ─────────────────────────────────────────────
//  Context
// ─────────────────────────────────────────────
interface AppContextValue {
  state: AppState
  dispatch: Dispatch<AppAction>
  // convenience actions
  validateEditor: () => void
  beautifyEditor: () => void
  minifyEditor: () => void
  runCompare: () => void
  validateXml: () => void
  runQuery: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

function persistState(state: AppState) {
  try {
    const toSave: Partial<AppState> = {
      activeTab: state.activeTab,
      editorRaw: state.editorRaw,
      compareLeft: state.compareLeft,
      compareRight: state.compareRight,
      xmlRaw: state.xmlRaw,
      gridRaw: state.gridRaw,
      gridPath: state.gridPath,
      queryRaw: state.queryRaw,
      queryExpression: state.queryExpression,
      theme: state.theme,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
  } catch {
    // ignore quota errors
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  // Persist on every state change
  useEffect(() => {
    persistState(state)
  }, [state])

  // Apply theme class to <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme)
  }, [state.theme])

  const validateEditor = useCallback(() => {
    const { parsed, error } = (() => {
      const result = parseJson(state.editorRaw)
      return { parsed: result.parsed, error: result.error }
    })()
    if (error) {
      dispatch({ type: 'SET_EDITOR_ERROR', error })
    } else {
      dispatch({ type: 'SET_EDITOR_PARSED', parsed, error: null })
    }
  }, [state.editorRaw])

  const beautifyEditor = useCallback(() => {
    const result = parseJson(state.editorRaw)
    if (!result.valid || result.error) {
      dispatch({ type: 'SET_EDITOR_ERROR', error: result.error ?? 'Invalid JSON' })
      return
    }
    const pretty = beautify(state.editorRaw)
    dispatch({ type: 'SET_EDITOR_RAW', raw: pretty })
    dispatch({ type: 'SET_EDITOR_PARSED', parsed: result.parsed, error: null })
  }, [state.editorRaw])

  const minifyEditor = useCallback(() => {
    const result = parseJson(state.editorRaw)
    if (!result.valid || result.error) {
      dispatch({ type: 'SET_EDITOR_ERROR', error: result.error ?? 'Invalid JSON' })
      return
    }
    const minified = JSON.stringify(result.parsed)
    dispatch({ type: 'SET_EDITOR_RAW', raw: minified })
    dispatch({ type: 'SET_EDITOR_PARSED', parsed: result.parsed, error: null })
  }, [state.editorRaw])

  const runCompare = useCallback(() => {
    const leftResult = parseJson(state.compareLeft)
    const rightResult = parseJson(state.compareRight)

    if (!leftResult.valid) {
      dispatch({ type: 'SET_COMPARE_ERROR', error: `Left JSON error: ${leftResult.error}` })
      return
    }
    if (!rightResult.valid) {
      dispatch({ type: 'SET_COMPARE_ERROR', error: `Right JSON error: ${rightResult.error}` })
      return
    }

    dispatch({
      type: 'SET_COMPARE_PARSED',
      compareLeftParsed: leftResult.parsed,
      compareRightParsed: rightResult.parsed,
    })

    const leftPretty = JSON.stringify(leftResult.parsed, null, 2)
    const rightPretty = JSON.stringify(rightResult.parsed, null, 2)

    const rawChanges = Diff.diffLines(leftPretty, rightPretty)
    const lines: DiffLine[] = []
    for (const part of rawChanges) {
      const partLines = part.value.split('\n')
      // trailing empty string from split
      const cleaned = partLines[partLines.length - 1] === '' ? partLines.slice(0, -1) : partLines
      for (const line of cleaned) {
        lines.push({
          type: part.added ? 'added' : part.removed ? 'removed' : 'unchanged',
          value: line,
        })
      }
    }
    const equal = leftPretty === rightPretty
    dispatch({ type: 'SET_COMPARE_RESULT', lines, equal })
  }, [state.compareLeft, state.compareRight])

  const validateXml = useCallback(() => {
    const result = parseXml(state.xmlRaw)
    if (!result.valid || result.error) {
      dispatch({ type: 'SET_XML_ERROR', error: result.error ?? 'Invalid XML' })
      return
    }
    dispatch({ type: 'SET_XML_VALID' })
  }, [state.xmlRaw])

  const runQuery = useCallback(() => {
    const result = parseJson(state.queryRaw)
    if (!result.valid) {
      dispatch({ type: 'SET_QUERY_RUN_ERROR', error: `JSON parse error: ${result.error}` })
      return
    }
    if (!state.queryExpression.trim()) {
      dispatch({ type: 'SET_QUERY_RUN_ERROR', error: 'JSONPath expression is empty' })
      return
    }
    try {
      const results = JSONPath({
        path: state.queryExpression,
        json: result.parsed as object,
        resultType: 'value',
      }) as unknown[]

      const paths = JSONPath({
        path: state.queryExpression,
        json: result.parsed as object,
        resultType: 'path',
      }) as string[]

      dispatch({ type: 'SET_QUERY_RESULTS', results, paths })
    } catch (e) {
      dispatch({ type: 'SET_QUERY_RUN_ERROR', error: (e as Error).message })
    }
  }, [state.queryRaw, state.queryExpression])

  return (
    <AppContext.Provider
      value={{ state, dispatch, validateEditor, beautifyEditor, minifyEditor, runCompare, validateXml, runQuery }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
