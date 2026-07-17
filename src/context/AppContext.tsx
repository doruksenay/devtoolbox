import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
  type Dispatch,
} from 'react'
import { JSONPath } from 'jsonpath-plus'
import * as Diff from 'diff'
import type { AppState, AppAction, DiffLine, ParseResult } from '../types'
import type { EditorSyntaxTheme } from '../utils/editorThemes'
import { rootReducer } from './reducers'
import { supabase } from '../lib/supabase'
import { formatJsonError } from '../utils/jsonError'

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

const STORAGE_KEY = 'devtoolbox_state_v1'

export function parseJson(raw: string): ParseResult {
  if (!raw.trim()) return { valid: false, parsed: null, error: 'Input is empty' }
  try {
    const parsed = JSON.parse(raw)
    return { valid: true, parsed, error: null }
  } catch (e) {
    const message = (e as Error).message
    return { valid: false, parsed: null, error: formatJsonError(raw, message) }
  }
}

export function parseXml(raw: string): { valid: boolean; error: string | null } {
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

export function formatXml(raw: string): string {
  const PADDING = '  '
  let formatted = ''
  let indent = 0
  const lines = raw
    .replace(/(>)(<)(\/*)/g, '$1\n$2$3')
    .replace(/\r\n|\r/g, '\n')
    .split('\n')

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    if (line.startsWith('</')) {
      indent = Math.max(indent - 1, 0)
    }

    formatted += PADDING.repeat(indent) + line + '\n'

    if (line.startsWith('<') && !line.startsWith('</') && !line.startsWith('<?') && !line.endsWith('/>') && !line.includes('</')) {
      indent++
    }
  }

  return formatted.trim()
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

// For anonymous users we start with an empty slate (no localStorage restore)
const initialState: AppState = {
  activeTab: 'editor',
  editorRaw: '',
  editorParsed: null,
  editorValid: null,
  editorError: null,
  compareLeft: '',
  compareLeftParsed: null,
  compareLeftError: null,
  compareRight: '',
  compareRightParsed: null,
  compareRightError: null,
  compareLines: null,
  compareEqual: null,
  compareError: null,
  xmlRaw: '',
  xmlValid: null,
  xmlError: null,
  xmlCompareLeft: '',
  xmlCompareRight: '',
  xmlCompareLines: null,
  xmlCompareEqual: null,
  xmlCompareError: null,
  gridRaw: '',
  gridParsed: null,
  gridError: null,
  gridPath: '$',
  queryRaw: '',
  queryParsed: null,
  queryError: null,
  queryExpression: '',
  queryResults: null,
  queryPaths: null,
  queryRunError: null,
  theme: 'dark',
  editorSyntaxTheme: 'default' as EditorSyntaxTheme,
  convertInput: '',
  convertOutput: '',
  convertMode: 'xml-to-json',
  convertError: null,
  schemaInput: '',
  schemaError: null,
  schemaValid: null,
  fetchUrl: '',
  fetchLoading: false,
  fetchError: null,
  harRaw: '',
  harError: null,
  harSelectedEntry: null,
  harFilter: '',
  harMethodFilter: '',
  cronExpression: '*/5 * * * *',
  cronError: null,
  jwtInput: '',
  jwtError: null,
  drawShapes: [],
  drawConnections: [],
  drawTool: 'select',
  drawSelectedIds: [],
  drawSelectedColor: '#4f8ef7',
  yamlInput: '',
  yamlOutput: '',
  yamlMode: 'yaml-to-json',
  yamlError: null,
  base64Input: '',
  base64Output: '',
  base64Mode: 'encode',
  base64Error: null,
  urlInput: '',
  urlOutput: '',
  urlMode: 'encode',
  urlError: null,
  soapInput: '',
  soapError: null,
  sidebarCollapsed: false,
  commandPaletteOpen: false,
}

// ─────────────────────────────────────────────
//  Helpers: what fields we persist
// ─────────────────────────────────────────────
function buildSavePayload(state: AppState): Partial<AppState> {
  return {
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
    editorSyntaxTheme: state.editorSyntaxTheme,
    sidebarCollapsed: state.sidebarCollapsed,
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
  runXmlCompare: () => void
  validateXml: () => void
  formatXmlAction: () => void
  runQuery: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(rootReducer, initialState)
  // Track current Supabase user id so we know whether to persist to DB
  const userIdRef = useRef<string | null>(null)
  // Prevent writing back state that we just loaded from Supabase
  const suppressNextPersistRef = useRef(false)

  // ── Load state for logged-in user on mount / auth change ──────────────
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const uid = session?.user?.id ?? null
      userIdRef.current = uid

      if (uid) {
        // Load persisted state from Supabase
        const { data } = await supabase
          .from('user_states')
          .select('state')
          .eq('user_id', uid)
          .maybeSingle()

        if (data?.state) {
          suppressNextPersistRef.current = true
          dispatch({ type: 'LOAD_PERSISTED_STATE', payload: data.state as Partial<AppState> })
        }
      } else {
        // Anonymous — restore from localStorage (preferences like theme)
        const saved = loadPersistedState()
        if (Object.keys(saved).length > 0) {
          suppressNextPersistRef.current = true
          dispatch({ type: 'LOAD_PERSISTED_STATE', payload: saved })
        }
      }
    })

    return () => { listener.subscription.unsubscribe() }
  }, [])

  // ── Persist on every state change ────────────────────────────────────
  useEffect(() => {
    if (suppressNextPersistRef.current) {
      suppressNextPersistRef.current = false
      return
    }

    const payload = buildSavePayload(state)
    const uid = userIdRef.current

    if (uid) {
      // Logged-in: upsert into Supabase (fire-and-forget)
      supabase
        .from('user_states')
        .upsert({ user_id: uid, state: payload, updated_at: new Date().toISOString() })
        .then(() => undefined)
    } else {
      // Anonymous: only persist preferences (theme, sidebar), NOT content
      try {
        const prefsOnly: Partial<AppState> = {
          theme: state.theme,
          editorSyntaxTheme: state.editorSyntaxTheme,
          sidebarCollapsed: state.sidebarCollapsed,
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prefsOnly))
      } catch {
        // ignore quota errors
      }
    }
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

  const runXmlCompare = useCallback(() => {
    const leftRaw = state.xmlCompareLeft
    const rightRaw = state.xmlCompareRight

    if (!leftRaw.trim() && !rightRaw.trim()) {
      dispatch({ type: 'CLEAR_XML_COMPARE' })
      return
    }

    const rawChanges = Diff.diffLines(leftRaw, rightRaw)
    const lines: DiffLine[] = []
    for (const part of rawChanges) {
      const partLines = part.value.split('\n')
      const cleaned = partLines[partLines.length - 1] === '' ? partLines.slice(0, -1) : partLines
      for (const line of cleaned) {
        lines.push({
          type: part.added ? 'added' : part.removed ? 'removed' : 'unchanged',
          value: line,
        })
      }
    }
    const equal = leftRaw === rightRaw
    dispatch({ type: 'SET_XML_COMPARE_RESULT', lines, equal })
  }, [state.xmlCompareLeft, state.xmlCompareRight])

  const validateXml = useCallback(() => {
    const result = parseXml(state.xmlRaw)
    if (!result.valid || result.error) {
      dispatch({ type: 'SET_XML_ERROR', error: result.error ?? 'Invalid XML' })
      return
    }
    dispatch({ type: 'SET_XML_VALID' })
  }, [state.xmlRaw])

  const formatXmlAction = useCallback(() => {
    const result = parseXml(state.xmlRaw)
    if (!result.valid || result.error) {
      dispatch({ type: 'SET_XML_ERROR', error: result.error ?? 'Invalid XML' })
      return
    }
    const formatted = formatXml(state.xmlRaw)
    dispatch({ type: 'SET_XML_RAW', raw: formatted })
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
      value={{ state, dispatch, validateEditor, beautifyEditor, minifyEditor, runCompare, runXmlCompare, validateXml, formatXmlAction, runQuery }}
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
