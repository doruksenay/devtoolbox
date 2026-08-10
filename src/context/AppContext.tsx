import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  type ReactNode,
  type Dispatch,
} from 'react'
import { JSONPath } from 'jsonpath-plus'
import * as Diff from 'diff'
import type { AppState, AppAction, DiffLine } from '../types'
import type { EditorSyntaxTheme } from '../utils/editorThemes'
import { rootReducer } from './reducers'
import { makeDoc } from './reducers/editorDocs'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { parseJson, parseXml, formatXml, beautifyJson } from '../utils/parsers'
import { DEFAULT_TAX_REGION } from '../utils/salesTaxCanada'

export { parseJson, parseXml, formatXml }

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

const STORAGE_KEY = 'devtoolbox_state_v1'

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
const firstDoc = makeDoc('Tab 1')

const initialState: AppState = {
  activeTab: 'editor',
  editorRaw: '',
  editorDocs: [firstDoc],
  editorActiveDocId: firstDoc.id,
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
  cleanInput: '',
  taxAmount: '',
  taxProvince: DEFAULT_TAX_REGION,
  taxIncludesTax: false,
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
    editorDocs: state.editorDocs,
    editorActiveDocId: state.editorActiveDocId,
    compareLeft: state.compareLeft,
    compareRight: state.compareRight,
    xmlRaw: state.xmlRaw,
    gridRaw: state.gridRaw,
    gridPath: state.gridPath,
    queryRaw: state.queryRaw,
    queryExpression: state.queryExpression,
    taxAmount: state.taxAmount,
    taxProvince: state.taxProvince,
    taxIncludesTax: state.taxIncludesTax,
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
  validateXml: () => void
  formatXmlAction: () => void
  runQuery: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

// Dispatch is exposed through its own context because it is referentially stable.
// Components that only dispatch actions can subscribe to it without re-rendering
// whenever unrelated parts of the state tree change.
const AppDispatchContext = createContext<Dispatch<AppAction> | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(rootReducer, initialState)
  // Track current Supabase user id so we know whether to persist to DB
  const userIdRef = useRef<string | null>(null)
  // Prevent writing back state that we just loaded from Supabase
  const suppressNextPersistRef = useRef(false)

  // ── Load state for logged-in user on mount / auth change ──────────────
  useEffect(() => {
    if (!isSupabaseConfigured) {
      // No backend configured — restore local preferences only.
      const saved = loadPersistedState()
      if (Object.keys(saved).length > 0) {
        suppressNextPersistRef.current = true
        dispatch({ type: 'LOAD_PERSISTED_STATE', payload: saved })
      }
      return
    }

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
    const pretty = beautifyJson(state.editorRaw)
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

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      dispatch,
      validateEditor,
      beautifyEditor,
      minifyEditor,
      runCompare,
      validateXml,
      formatXmlAction,
      runQuery,
    }),
    [
      state,
      validateEditor,
      beautifyEditor,
      minifyEditor,
      runCompare,
      validateXml,
      formatXmlAction,
      runQuery,
    ],
  )

  return (
    <AppDispatchContext.Provider value={dispatch}>
      <AppContext.Provider value={value}>{children}</AppContext.Provider>
    </AppDispatchContext.Provider>
  )
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}

/**
 * Subscribe to the dispatch function only. Prefer this over `useApp()` in
 * components that never read state, so they do not re-render on state changes.
 */
export function useAppDispatch(): Dispatch<AppAction> {
  const dispatch = useContext(AppDispatchContext)
  if (!dispatch) throw new Error('useAppDispatch must be used inside AppProvider')
  return dispatch
}
