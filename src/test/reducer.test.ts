import { describe, it, expect } from 'vitest'
import { rootReducer } from '../context/reducers'
import type { AppState } from '../types'

const emptyState: AppState = {
  activeTab: 'editor',
  editorRaw: '',
  editorDocs: [{ id: 'doc-1', name: 'Tab 1', raw: '' }],
  editorActiveDocId: 'doc-1',
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
  editorSyntaxTheme: 'default',
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
  cronExpression: '',
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
  cleanInput: '',
  taxAmount: '',
  taxProvince: 'ON',
  taxIncludesTax: false,
  sidebarCollapsed: false,
  commandPaletteOpen: false,
}

describe('rootReducer', () => {
  describe('global actions', () => {
    it('SET_TAB changes active tab', () => {
      const result = rootReducer(emptyState, { type: 'SET_TAB', tab: 'compare' })
      expect(result.activeTab).toBe('compare')
    })

    it('TOGGLE_THEME switches dark to light', () => {
      const result = rootReducer(emptyState, { type: 'TOGGLE_THEME' })
      expect(result.theme).toBe('light')
    })

    it('TOGGLE_THEME switches light to dark', () => {
      const state = { ...emptyState, theme: 'light' as const }
      const result = rootReducer(state, { type: 'TOGGLE_THEME' })
      expect(result.theme).toBe('dark')
    })
  })

  describe('editor actions', () => {
    it('SET_EDITOR_RAW updates raw and resets validation', () => {
      const state = { ...emptyState, editorValid: true as const, editorError: null }
      const result = rootReducer(state, { type: 'SET_EDITOR_RAW', raw: '{"a":1}' })
      expect(result.editorRaw).toBe('{"a":1}')
      expect(result.editorValid).toBeNull()
    })

    it('SET_EDITOR_PARSED sets parsed data', () => {
      const result = rootReducer(emptyState, { type: 'SET_EDITOR_PARSED', parsed: { a: 1 }, error: null })
      expect(result.editorParsed).toEqual({ a: 1 })
      expect(result.editorValid).toBe(true)
    })

    it('SET_EDITOR_ERROR sets error state', () => {
      const result = rootReducer(emptyState, { type: 'SET_EDITOR_ERROR', error: 'bad json' })
      expect(result.editorError).toBe('bad json')
      expect(result.editorValid).toBe(false)
    })

    it('CLEAR_EDITOR resets all editor state', () => {
      const state = { ...emptyState, editorRaw: 'data', editorValid: true as const }
      const result = rootReducer(state, { type: 'CLEAR_EDITOR' })
      expect(result.editorRaw).toBe('')
      expect(result.editorValid).toBeNull()
    })
  })

  describe('editor documents (tabs)', () => {
    it('SET_EDITOR_RAW syncs the active document content', () => {
      const result = rootReducer(emptyState, { type: 'SET_EDITOR_RAW', raw: '{"a":1}' })
      expect(result.editorDocs[0].raw).toBe('{"a":1}')
    })

    it('ADD_EDITOR_DOC appends a new empty tab and activates it', () => {
      const result = rootReducer({ ...emptyState, editorRaw: '{"a":1}' }, { type: 'ADD_EDITOR_DOC' })
      expect(result.editorDocs).toHaveLength(2)
      expect(result.editorDocs[1].name).toBe('Tab 2')
      expect(result.editorActiveDocId).toBe(result.editorDocs[1].id)
      expect(result.editorRaw).toBe('')
    })

    it('ADD_EDITOR_DOC with raw opens the content in the next tab', () => {
      const state = {
        ...emptyState,
        editorRaw: '{"a":1}',
        editorDocs: [{ id: 'doc-1', name: 'Tab 1', raw: '{"a":1}' }],
      }
      const result = rootReducer(state, { type: 'ADD_EDITOR_DOC', raw: '{"b":2}' })
      expect(result.editorDocs).toHaveLength(2)
      expect(result.editorDocs[1].raw).toBe('{"b":2}')
      expect(result.editorActiveDocId).toBe(result.editorDocs[1].id)
      expect(result.editorRaw).toBe('{"b":2}')
    })

    it('ADD_EDITOR_DOC with raw reuses a lone empty tab', () => {
      const result = rootReducer(emptyState, { type: 'ADD_EDITOR_DOC', raw: '{"b":2}' })
      expect(result.editorDocs).toHaveLength(1)
      expect(result.editorDocs[0].id).toBe('doc-1')
      expect(result.editorDocs[0].raw).toBe('{"b":2}')
      expect(result.editorRaw).toBe('{"b":2}')
    })

    it('SELECT_EDITOR_DOC swaps the visible content', () => {
      const state = {
        ...emptyState,
        editorDocs: [
          { id: 'a', name: 'Tab 1', raw: '1' },
          { id: 'b', name: 'Tab 2', raw: '2' },
        ],
        editorActiveDocId: 'a',
        editorRaw: '1',
      }
      const result = rootReducer(state, { type: 'SELECT_EDITOR_DOC', id: 'b' })
      expect(result.editorActiveDocId).toBe('b')
      expect(result.editorRaw).toBe('2')
    })

    it('RENAME_EDITOR_DOC renames a tab and ignores blank names', () => {
      const renamed = rootReducer(emptyState, { type: 'RENAME_EDITOR_DOC', id: 'doc-1', name: ' Orders ' })
      expect(renamed.editorDocs[0].name).toBe('Orders')
      const blank = rootReducer(emptyState, { type: 'RENAME_EDITOR_DOC', id: 'doc-1', name: '  ' })
      expect(blank.editorDocs[0].name).toBe('Tab 1')
    })

    it('CLOSE_EDITOR_DOC activates a neighbour tab', () => {
      const state = {
        ...emptyState,
        editorDocs: [
          { id: 'a', name: 'Tab 1', raw: '1' },
          { id: 'b', name: 'Tab 2', raw: '2' },
        ],
        editorActiveDocId: 'b',
        editorRaw: '2',
      }
      const result = rootReducer(state, { type: 'CLOSE_EDITOR_DOC', id: 'b' })
      expect(result.editorDocs).toHaveLength(1)
      expect(result.editorActiveDocId).toBe('a')
      expect(result.editorRaw).toBe('1')
    })

    it('CLOSE_EDITOR_DOC on the last tab recreates a fresh empty tab', () => {
      const state = { ...emptyState, editorRaw: '{"a":1}' }
      const result = rootReducer(state, { type: 'CLOSE_EDITOR_DOC', id: 'doc-1' })
      expect(result.editorDocs).toHaveLength(1)
      expect(result.editorDocs[0].name).toBe('Tab 1')
      expect(result.editorRaw).toBe('')
    })
  })

  describe('compare actions', () => {
    it('SET_COMPARE_LEFT updates left and resets results', () => {
      const state = { ...emptyState, compareEqual: true as const }
      const result = rootReducer(state, { type: 'SET_COMPARE_LEFT', raw: '{"a":1}' })
      expect(result.compareLeft).toBe('{"a":1}')
      expect(result.compareEqual).toBeNull()
    })

    it('CLEAR_COMPARE resets all compare state', () => {
      const state = { ...emptyState, compareLeft: 'x', compareRight: 'y' }
      const result = rootReducer(state, { type: 'CLEAR_COMPARE' })
      expect(result.compareLeft).toBe('')
      expect(result.compareRight).toBe('')
    })
  })

  describe('xml actions', () => {
    it('SET_XML_RAW updates raw and resets validation', () => {
      const result = rootReducer(emptyState, { type: 'SET_XML_RAW', raw: '<root/>' })
      expect(result.xmlRaw).toBe('<root/>')
      expect(result.xmlValid).toBeNull()
    })

    it('SET_XML_VALID marks xml as valid', () => {
      const result = rootReducer(emptyState, { type: 'SET_XML_VALID' })
      expect(result.xmlValid).toBe(true)
      expect(result.xmlError).toBeNull()
    })

    it('SET_XML_ERROR marks xml as invalid', () => {
      const result = rootReducer(emptyState, { type: 'SET_XML_ERROR', error: 'parse error' })
      expect(result.xmlValid).toBe(false)
      expect(result.xmlError).toBe('parse error')
    })
  })

  describe('query actions', () => {
    it('SET_QUERY_RESULTS stores results', () => {
      const result = rootReducer(emptyState, {
        type: 'SET_QUERY_RESULTS',
        results: [1, 2, 3],
        paths: ['$[0]', '$[1]', '$[2]'],
      })
      expect(result.queryResults).toEqual([1, 2, 3])
      expect(result.queryPaths).toEqual(['$[0]', '$[1]', '$[2]'])
    })

    it('SET_QUERY_RUN_ERROR clears results', () => {
      const state = { ...emptyState, queryResults: [1] as unknown[], queryPaths: ['$[0]'] }
      const result = rootReducer(state, { type: 'SET_QUERY_RUN_ERROR', error: 'fail' })
      expect(result.queryResults).toBeNull()
      expect(result.queryRunError).toBe('fail')
    })
  })

  describe('convert actions', () => {
    it('SET_CONVERT_INPUT updates input', () => {
      const result = rootReducer(emptyState, { type: 'SET_CONVERT_INPUT', raw: '<root/>' })
      expect(result.convertInput).toBe('<root/>')
      expect(result.convertError).toBeNull()
    })

    it('SET_CONVERT_MODE changes mode and clears output', () => {
      const state = { ...emptyState, convertOutput: 'something' }
      const result = rootReducer(state, { type: 'SET_CONVERT_MODE', mode: 'json-to-xml' })
      expect(result.convertMode).toBe('json-to-xml')
      expect(result.convertOutput).toBe('')
    })

    it('SET_CONVERT_OUTPUT stores output', () => {
      const result = rootReducer(emptyState, { type: 'SET_CONVERT_OUTPUT', output: '{"a":1}', error: null })
      expect(result.convertOutput).toBe('{"a":1}')
    })

    it('SET_CONVERT_ERROR stores error', () => {
      const result = rootReducer(emptyState, { type: 'SET_CONVERT_ERROR', error: 'invalid XML' })
      expect(result.convertError).toBe('invalid XML')
      expect(result.convertOutput).toBe('')
    })

    it('CLEAR_CONVERT resets convert state', () => {
      const state = { ...emptyState, convertInput: 'xml', convertOutput: 'json' }
      const result = rootReducer(state, { type: 'CLEAR_CONVERT' })
      expect(result.convertInput).toBe('')
      expect(result.convertOutput).toBe('')
    })
  })

  describe('schema actions', () => {
    it('SET_SCHEMA_INPUT updates schema input', () => {
      const result = rootReducer(emptyState, { type: 'SET_SCHEMA_INPUT', raw: '{"type":"object"}' })
      expect(result.schemaInput).toBe('{"type":"object"}')
    })

    it('SET_SCHEMA_RESULT stores validation result', () => {
      const result = rootReducer(emptyState, { type: 'SET_SCHEMA_RESULT', valid: true, error: null })
      expect(result.schemaValid).toBe(true)
      expect(result.schemaError).toBeNull()
    })
  })

  describe('fetch actions', () => {
    it('SET_FETCH_URL updates URL', () => {
      const result = rootReducer(emptyState, { type: 'SET_FETCH_URL', url: 'http://example.com' })
      expect(result.fetchUrl).toBe('http://example.com')
    })

    it('SET_FETCH_LOADING updates loading state', () => {
      const result = rootReducer(emptyState, { type: 'SET_FETCH_LOADING', loading: true })
      expect(result.fetchLoading).toBe(true)
    })

    it('SET_FETCH_ERROR stores error and resets loading', () => {
      const state = { ...emptyState, fetchLoading: true }
      const result = rootReducer(state, { type: 'SET_FETCH_ERROR', error: 'Network error' })
      expect(result.fetchError).toBe('Network error')
      expect(result.fetchLoading).toBe(false)
    })
  })
})
