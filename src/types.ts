// ─────────────────────────────────────────────
//  Shared type definitions across the app
// ─────────────────────────────────────────────

export type TabId = 'editor' | 'compare' | 'xml' | 'grid' | 'query' | 'har' | 'cron' | 'jwt' | 'draw' | 'clean' | 'tax'

/** Every tab id, for runtime validation of persisted state. */
export const TAB_IDS: readonly TabId[] = [
  'editor', 'compare', 'xml', 'grid', 'query', 'har',
  'cron', 'jwt', 'draw', 'clean', 'tax',
]

export function isTabId(value: unknown): value is TabId {
  return typeof value === 'string' && (TAB_IDS as readonly string[]).includes(value)
}

export type { EditorSyntaxTheme } from './utils/editorThemes'
import type { EditorSyntaxTheme } from './utils/editorThemes'

export interface ParseResult {
  valid: boolean
  parsed: unknown | null
  error: string | null
}

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged'
  value: string
}

export interface EditorDoc {
  id: string
  name: string
  raw: string
}

export interface AppState {
  // ── Active tab ──────────────────────────────
  activeTab: TabId

  // ── Editor tab ──────────────────────────────
  editorRaw: string         // raw text in the textarea (content of the active document)
  editorDocs: EditorDoc[]   // open editor documents ("browser tabs")
  editorActiveDocId: string // id of the currently open document
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
  editorSyntaxTheme: EditorSyntaxTheme

  // ── JSON Schema validation ──────────────────
  schemaInput: string
  schemaError: string | null
  schemaValid: boolean | null

  // ── URL fetch ───────────────────────────────
  fetchUrl: string
  fetchLoading: boolean
  fetchError: string | null

  // ── HAR Viewer ──────────────────────────────
  harRaw: string
  harError: string | null
  harSelectedEntry: number | null
  harFilter: string
  harMethodFilter: string

  // ── Cron ─────────────────────────────────────
  cronExpression: string
  cronError: string | null

  // ── JWT ──────────────────────────────────────
  jwtInput: string
  jwtError: string | null

  // ── Draw ─────────────────────────────────────
  drawShapes: DrawShape[]
  drawConnections: DrawConnection[]
  drawTool: DrawTool
  drawSelectedIds: string[]
  drawSelectedColor: string

  // ── Text Cleaner ──────────────────────────────
  cleanInput: string

  // ── Canada Sales Tax Calculator ───────────────
  taxAmount: string          // raw amount input (string to allow empty/partial entry)
  taxProvince: string        // province code, 'QC' or 'ON'
  taxIncludesTax: boolean    // true when the entered amount already includes tax

  // ── UI state ──────────────────────────────────
  sidebarCollapsed: boolean
  commandPaletteOpen: boolean
}

export type AppAction =
  | { type: 'SET_TAB'; tab: TabId }
  | { type: 'SET_EDITOR_RAW'; raw: string }
  | { type: 'SET_EDITOR_PARSED'; parsed: unknown; error: null }
  | { type: 'SET_EDITOR_ERROR'; error: string }
  | { type: 'CLEAR_EDITOR' }
  | { type: 'ADD_EDITOR_DOC'; raw?: string; name?: string }
  | { type: 'CLOSE_EDITOR_DOC'; id: string }
  | { type: 'SELECT_EDITOR_DOC'; id: string }
  | { type: 'RENAME_EDITOR_DOC'; id: string; name: string }
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
  | { type: 'SET_QUERY_RAW'; raw: string }
  | { type: 'SET_QUERY_EXPRESSION'; expr: string }
  | { type: 'SET_QUERY_RESULTS'; results: unknown[]; paths: string[] }
  | { type: 'SET_QUERY_RUN_ERROR'; error: string }
  | { type: 'TOGGLE_THEME' }
  | { type: 'SET_EDITOR_SYNTAX_THEME'; theme: EditorSyntaxTheme }
  // JSON Schema
  | { type: 'SET_SCHEMA_INPUT'; raw: string }
  | { type: 'SET_SCHEMA_RESULT'; valid: boolean; error: string | null }
  // URL fetch
  | { type: 'SET_FETCH_URL'; url: string }
  | { type: 'SET_FETCH_LOADING'; loading: boolean }
  | { type: 'SET_FETCH_ERROR'; error: string }
  // HAR Viewer
  | { type: 'SET_HAR_RAW'; raw: string }
  | { type: 'SET_HAR_ERROR'; error: string }
  | { type: 'SET_HAR_SELECTED_ENTRY'; index: number | null }
  | { type: 'SET_HAR_FILTER'; filter: string }
  | { type: 'SET_HAR_METHOD_FILTER'; method: string }
  | { type: 'CLEAR_HAR' }
  // Cron
  | { type: 'SET_CRON_EXPRESSION'; expression: string }
  // JWT
  | { type: 'SET_JWT_INPUT'; input: string }
  | { type: 'CLEAR_JWT' }
  // Draw
  | { type: 'SET_DRAW_SHAPES'; shapes: DrawShape[] }
  | { type: 'SET_DRAW_CONNECTIONS'; connections: DrawConnection[] }
  | { type: 'SET_DRAW_TOOL'; tool: DrawTool }
  | { type: 'SET_DRAW_SELECTED_IDS'; ids: string[] }
  | { type: 'SET_DRAW_SELECTED_COLOR'; color: string }
  | { type: 'CLEAR_DRAW' }
  // UI
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'TOGGLE_COMMAND_PALETTE' }
  | { type: 'SET_COMMAND_PALETTE_OPEN'; open: boolean }
  // Text Cleaner
  | { type: 'SET_CLEAN_INPUT'; input: string }
  | { type: 'CLEAR_CLEAN' }
  // Canada Sales Tax Calculator
  | { type: 'SET_TAX_AMOUNT'; amount: string }
  | { type: 'SET_TAX_PROVINCE'; province: string }
  | { type: 'SET_TAX_INCLUDES_TAX'; included: boolean }
  | { type: 'CLEAR_TAX' }
  // Internal
  | { type: 'LOAD_PERSISTED_STATE'; payload: Partial<AppState> }

// ── Draw types ───────────────────────────────────
export type DrawTool = 'select' | 'rect' | 'ellipse' | 'diamond' | 'cylinder' | 'hexagon' | 'parallelogram' | 'text' | 'connect'

export interface DrawShape {
  id: string
  type: 'rect' | 'ellipse' | 'diamond' | 'cylinder' | 'hexagon' | 'parallelogram' | 'text'
  x: number
  y: number
  w: number
  h: number
  label: string
  color: string
}

export interface DrawConnection {
  id: string
  from: string
  to: string
}
