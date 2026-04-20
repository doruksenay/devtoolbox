// ─────────────────────────────────────────────
//  Shared type definitions across the app
// ─────────────────────────────────────────────

export type TabId = 'editor' | 'compare' | 'xml' | 'grid' | 'query' | 'convert'

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

  // ── XML tab ─────────────────────────────────
  xmlRaw: string
  xmlValid: boolean | null
  xmlError: string | null

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

  // ── Convert tab ─────────────────────────────
  convertInput: string
  convertOutput: string
  convertMode: 'xml-to-json' | 'json-to-xml'
  convertError: string | null

  // ── JSON Schema validation ──────────────────
  schemaInput: string
  schemaError: string | null
  schemaValid: boolean | null

  // ── URL fetch ───────────────────────────────
  fetchUrl: string
  fetchLoading: boolean
  fetchError: string | null
}

export type AppAction =
  | { type: 'SET_TAB'; tab: TabId }
  | { type: 'SET_EDITOR_RAW'; raw: string }
  | { type: 'SET_EDITOR_PARSED'; parsed: unknown; error: null }
  | { type: 'SET_EDITOR_ERROR'; error: string }
  | { type: 'CLEAR_EDITOR' }
  | { type: 'SET_COMPARE_LEFT'; raw: string }
  | { type: 'SET_COMPARE_RIGHT'; raw: string }
  | { type: 'SET_COMPARE_PARSED'; compareLeftParsed: unknown; compareRightParsed: unknown }
  | { type: 'SET_COMPARE_RESULT'; lines: DiffLine[]; equal: boolean }
  | { type: 'SET_COMPARE_ERROR'; error: string }
  | { type: 'CLEAR_COMPARE' }
  | { type: 'SET_XML_RAW'; raw: string }
  | { type: 'SET_XML_VALID' }
  | { type: 'SET_XML_ERROR'; error: string }
  | { type: 'CLEAR_XML' }
  | { type: 'SET_GRID_RAW'; raw: string }
  | { type: 'SET_GRID_PATH'; path: string }
  | { type: 'SET_QUERY_RAW'; raw: string }
  | { type: 'SET_QUERY_EXPRESSION'; expr: string }
  | { type: 'SET_QUERY_RESULTS'; results: unknown[]; paths: string[] }
  | { type: 'SET_QUERY_RUN_ERROR'; error: string }
  | { type: 'TOGGLE_THEME' }
  // Convert tab
  | { type: 'SET_CONVERT_INPUT'; raw: string }
  | { type: 'SET_CONVERT_OUTPUT'; output: string; error: null }
  | { type: 'SET_CONVERT_MODE'; mode: 'xml-to-json' | 'json-to-xml' }
  | { type: 'SET_CONVERT_ERROR'; error: string }
  | { type: 'CLEAR_CONVERT' }
  // JSON Schema
  | { type: 'SET_SCHEMA_INPUT'; raw: string }
  | { type: 'SET_SCHEMA_RESULT'; valid: boolean; error: string | null }
  // URL fetch
  | { type: 'SET_FETCH_URL'; url: string }
  | { type: 'SET_FETCH_LOADING'; loading: boolean }
  | { type: 'SET_FETCH_ERROR'; error: string }
