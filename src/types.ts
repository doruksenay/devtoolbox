// ─────────────────────────────────────────────
//  Shared type definitions across the app
// ─────────────────────────────────────────────

export type TabId = 'editor' | 'compare' | 'grid' | 'query'

export interface ParseResult {
  valid: boolean
  parsed: unknown | null
  error: string | null
}

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged'
  value: string
}

export interface AppState {
  // ── Active tab ──────────────────────────────
  activeTab: TabId

  // ── Editor tab ──────────────────────────────
  editorRaw: string         // raw text in the textarea
  editorParsed: unknown | null
  editorValid: boolean | null  // null = never validated
  editorError: string | null

  // ── Compare tab ─────────────────────────────
  compareLeft: string
  compareLeftParsed: unknown | null
  compareLeftError: string | null

  compareRight: string
  compareRightParsed: unknown | null
  compareRightError: string | null

  compareLines: DiffLine[] | null
  compareEqual: boolean | null
  compareError: string | null  // general compare error

  // ── Grid tab ────────────────────────────────
  gridRaw: string
  gridParsed: unknown | null
  gridError: string | null
  gridPath: string            // JSONPath to select the array, default '$'

  // ── Query tab ───────────────────────────────
  queryRaw: string
  queryParsed: unknown | null
  queryError: string | null   // parse error for query JSON
  queryExpression: string
  queryResults: unknown[] | null
  queryPaths: string[] | null
  queryRunError: string | null  // JSONPath eval error

  // ── Global preferences ──────────────────────
  theme: 'dark' | 'light'
}

export type AppAction =
  | { type: 'SET_TAB'; tab: TabId }
  | { type: 'SET_EDITOR_RAW'; raw: string }
  | { type: 'SET_EDITOR_PARSED'; parsed: unknown; error: null }
  | { type: 'SET_EDITOR_ERROR'; error: string }
  | { type: 'CLEAR_EDITOR' }
  | { type: 'SET_COMPARE_LEFT'; raw: string }
  | { type: 'SET_COMPARE_RIGHT'; raw: string }
  | { type: 'SET_COMPARE_RESULT'; lines: DiffLine[]; equal: boolean }
  | { type: 'SET_COMPARE_ERROR'; error: string }
  | { type: 'CLEAR_COMPARE' }
  | { type: 'SET_GRID_RAW'; raw: string }
  | { type: 'SET_GRID_PATH'; path: string }
  | { type: 'SET_QUERY_RAW'; raw: string }
  | { type: 'SET_QUERY_EXPRESSION'; expr: string }
  | { type: 'SET_QUERY_RESULTS'; results: unknown[]; paths: string[] }
  | { type: 'SET_QUERY_RUN_ERROR'; error: string }
  | { type: 'TOGGLE_THEME' }
