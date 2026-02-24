import { useState, useMemo } from 'react'
import { JSONPath } from 'jsonpath-plus'
import { useApp } from '../../context/AppContext'
import { JsonTextarea } from '../shared/JsonTextarea'
import { parseJson } from '../../context/AppContext'

type RowData = Record<string, unknown>
type SortDir = 'asc' | 'desc' | null

export function GridTab() {
  const { state, dispatch } = useApp()
  const [filterText, setFilterText] = useState('')
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)
  const [copiedCsv, setCopiedCsv] = useState(false)

  // ── Parse & extract array via JSONPath ───────
  const { rows, columns, parseError } = useMemo((): {
    rows: RowData[]
    columns: string[]
    parseError: string | null
  } => {
    const raw = state.gridRaw
    if (!raw.trim()) return { rows: [], columns: [], parseError: null }

    const result = parseJson(raw)
    if (!result.valid) return { rows: [], columns: [], parseError: result.error }

    let extracted: unknown = result.parsed
    const path = state.gridPath.trim() || '$'

    if (path !== '$') {
      try {
        const found = JSONPath({ path, json: result.parsed as object, resultType: 'value' }) as unknown[]
        if (found.length === 0) return { rows: [], columns: [], parseError: `No match for path: ${path}` }
        extracted = found[0]
      } catch (e) {
        return { rows: [], columns: [], parseError: (e as Error).message }
      }
    }

    if (!Array.isArray(extracted)) {
      // Wrap a plain object as a single-row array
      if (extracted && typeof extracted === 'object') {
        extracted = [extracted]
      } else {
        return { rows: [], columns: [], parseError: 'Selected value is not an object or array.' }
      }
    }

    const arr = extracted as unknown[]

    if (arr.length === 0) {
      return { rows: [], columns: [], parseError: 'Array is empty.' }
    }

    // Collect all column keys from all objects
    const colSet = new Set<string>()
    for (const item of arr) {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        for (const k of Object.keys(item as Record<string, unknown>)) colSet.add(k)
      }
    }

    if (colSet.size === 0) {
      return { rows: [], columns: [], parseError: 'Array items are not objects (no columns to show).' }
    }

    return {
      rows: arr as RowData[],
      columns: Array.from(colSet),
      parseError: null,
    }
  }, [state.gridRaw, state.gridPath])

  // ── Filter ────────────────────────────────────
  const filteredRows = useMemo(() => {
    if (!filterText.trim()) return rows
    const q = filterText.toLowerCase()
    return rows.filter((row) =>
      columns.some((col) => {
        const v = row[col]
        return v !== null && v !== undefined && String(v).toLowerCase().includes(q)
      })
    )
  }, [rows, columns, filterText])

  // ── Sort ──────────────────────────────────────
  const sortedRows = useMemo(() => {
    if (!sortCol || !sortDir) return filteredRows
    return [...filteredRows].sort((a, b) => {
      const av = a[sortCol]
      const bv = b[sortCol]
      const as = av === null || av === undefined ? '' : String(av)
      const bs = bv === null || bv === undefined ? '' : String(bv)
      const cmp = as.localeCompare(bs, undefined, { numeric: true, sensitivity: 'base' })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filteredRows, sortCol, sortDir])

  function toggleSort(col: string) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc'))
      if (sortDir === 'desc') setSortCol(null)
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  function sortIcon(col: string) {
    if (sortCol !== col) return ' ↕'
    return sortDir === 'asc' ? ' ↑' : ' ↓'
  }

  // ── CSV Export ────────────────────────────────
  function exportCsv() {
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v)
      return `"${s.replace(/"/g, '""')}"`
    }
    const header = columns.map(esc).join(',')
    const body = sortedRows.map((r) => columns.map((c) => esc(r[c])).join(',')).join('\n')
    const csv = `${header}\n${body}`
    navigator.clipboard.writeText(csv).then(() => {
      setCopiedCsv(true)
      setTimeout(() => setCopiedCsv(false), 1500)
    })
  }

  function renderCell(val: unknown) {
    if (val === null || val === undefined) return <span className="json-table--null">null</span>
    if (typeof val === 'boolean') return <span className="json-table--bool">{String(val)}</span>
    if (typeof val === 'object') return JSON.stringify(val)
    return String(val)
  }

  const hasData = sortedRows.length > 0

  return (
    <div className="grid-tab">
      {/* Top: JSON input + controls */}
      <div className="grid-tab__top">
        <div className="grid-tab__json-input">
          <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="panel__header">
              <span className="panel__label">JSON Input</span>
              <div className="flex-row">
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 11 }}
                  onClick={() => {
                    if (state.editorRaw.trim()) {
                      dispatch({ type: 'SET_GRID_RAW', raw: state.editorRaw })
                    }
                  }}
                  title="Copy JSON from Editor tab"
                >
                  From Editor
                </button>
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 11 }}
                  onClick={() => dispatch({ type: 'SET_GRID_RAW', raw: '' })}
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="panel__body">
              <JsonTextarea
                value={state.gridRaw}
                onChange={(val) => dispatch({ type: 'SET_GRID_RAW', raw: val })}
                placeholder={'[\n  { "id": 1, "name": "Alice" },\n  { "id": 2, "name": "Bob" }\n]'}
              />
            </div>
          </div>
        </div>

        <div className="grid-tab__controls">
          <div className="panel__label" style={{ marginTop: 2 }}>Array path</div>
          <input
            className="filter-input"
            value={state.gridPath}
            onChange={(e) => dispatch({ type: 'SET_GRID_PATH', path: e.target.value })}
            placeholder="$ (root) or $.items"
            spellCheck={false}
          />
          <div className="text-xs text-muted">JSONPath to select array source. Use <code>$</code> for root.</div>

          <div style={{ marginTop: 8 }}>
            <div className="panel__label">Filter rows</div>
            <input
              className="filter-input"
              style={{ marginTop: 4 }}
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Search any value..."
            />
          </div>

          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button
              className="btn btn-ghost"
              style={{ fontSize: 11, flex: 1 }}
              onClick={exportCsv}
              disabled={!hasData}
            >
              {copiedCsv ? 'Copied!' : 'Copy CSV'}
            </button>
          </div>

          {hasData && (
            <div className="text-xs text-muted">
              Showing {sortedRows.length}/{rows.length} rows · {columns.length} cols
            </div>
          )}
        </div>
      </div>

      {/* Table area */}
      <div className="grid-tab__table-area panel">
        <div className="panel__header">
          <span className="panel__label">Grid</span>
        </div>
        <div className="panel__body">
          {parseError ? (
            <div className="empty-state">
              <div className="empty-state__icon text-error">✗</div>
              <div className="empty-state__title text-error">Cannot render grid</div>
              <div className="text-error mono" style={{ fontSize: 12 }}>{parseError}</div>
            </div>
          ) : !hasData && !state.gridRaw.trim() ? (
            <div className="empty-state">
              <div className="empty-state__icon">▦</div>
              <div className="empty-state__title">Paste JSON to view as a grid</div>
              <div>An array of objects or a single object. Keys become columns.</div>
            </div>
          ) : !hasData ? (
            <div className="empty-state">
              <div className="empty-state__title">No rows to display</div>
              <div>Check filter, or ensure your path points to an array of objects.</div>
            </div>
          ) : (
            <table className="json-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  {columns.map((col) => (
                    <th key={col} onClick={() => toggleSort(col)} title="Click to sort">
                      {col}{sortIcon(col)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row, i) => (
                  <tr key={i}>
                    <td style={{ color: 'var(--text-muted)', textAlign: 'right' }}>{i + 1}</td>
                    {columns.map((col) => (
                      <td key={col}>{renderCell(row[col])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
