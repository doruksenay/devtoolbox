import { useRef } from 'react'
import { useApp } from '../../context/AppContext'

interface HarEntry {
  request: {
    method: string
    url: string
    headers: { name: string; value: string }[]
    postData?: { mimeType: string; text: string }
  }
  response: {
    status: number
    statusText: string
    headers: { name: string; value: string }[]
    content: { mimeType: string; text?: string; size: number }
  }
  time: number
  timings: {
    send: number
    wait: number
    receive: number
    blocked?: number
    dns?: number
    connect?: number
    ssl?: number
  }
}

function methodColor(m: string) {
  const map: Record<string, string> = {
    GET: '#4caf50', POST: '#2196f3', PUT: '#ff9800',
    PATCH: '#9c27b0', DELETE: '#f44336', HEAD: '#607d8b', OPTIONS: '#795548',
  }
  return map[m.toUpperCase()] ?? 'var(--text-secondary)'
}

function statusColor(s: number) {
  if (s < 300) return '#4caf50'
  if (s < 400) return '#ff9800'
  return '#f44336'
}

function fmtBytes(n: number) {
  if (n < 0) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function fmtTime(ms: number) {
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

function tryPretty(text: string | undefined) {
  if (!text) return ''
  try { return JSON.stringify(JSON.parse(text), null, 2) } catch { return text }
}

function HeadersTable({ headers }: { headers: { name: string; value: string }[] }) {
  if (!headers.length) return <p className="har-empty-inline">No headers</p>
  return (
    <table className="har-headers-table">
      <tbody>
        {headers.map((h, i) => (
          <tr key={i}>
            <td className="har-headers-table__name">{h.name}</td>
            <td className="har-headers-table__value">{h.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function TimingBar({ timings, total }: { timings: HarEntry['timings']; total: number }) {
  const fields: { label: string; key: keyof HarEntry['timings']; color: string }[] = [
    { label: 'Blocked', key: 'blocked', color: '#607d8b' },
    { label: 'DNS',     key: 'dns',     color: '#9c27b0' },
    { label: 'Connect', key: 'connect', color: '#ff9800' },
    { label: 'SSL',     key: 'ssl',     color: '#f44336' },
    { label: 'Send',    key: 'send',    color: '#2196f3' },
    { label: 'Wait',    key: 'wait',    color: '#4caf50' },
    { label: 'Receive', key: 'receive', color: '#00bcd4' },
  ]
  return (
    <div className="har-timing">
      <div className="har-timing__rows">
        {fields.map(f => {
          const val = timings[f.key] ?? -1
          if (val <= 0) return null
          const pct = Math.max(2, (val / total) * 100)
          return (
            <div className="har-timing__row" key={f.key}>
              <span className="har-timing__label">{f.label}</span>
              <div className="har-timing__bar">
                <div className="har-timing__seg" style={{ width: `${pct}%`, background: f.color }} />
              </div>
              <span className="har-timing__val">{fmtTime(val)}</span>
            </div>
          )
        })}
        <div className="har-timing__row har-timing__row--total">
          <span className="har-timing__label">Total</span>
          <div className="har-timing__bar" />
          <span className="har-timing__val">{fmtTime(total)}</span>
        </div>
      </div>
    </div>
  )
}

export function HarTab() {
  const { state, dispatch } = useApp()
  const fileRef = useRef<HTMLInputElement>(null)

  function loadHar(text: string) {
    try {
      const parsed = JSON.parse(text)
      if (!parsed?.log?.entries) throw new Error('Not a valid HAR file (missing log.entries)')
      dispatch({ type: 'SET_HAR_RAW', raw: text })
    } catch (e) {
      dispatch({ type: 'SET_HAR_ERROR', error: (e as Error).message })
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => loadHar(ev.target?.result as string)
    reader.readAsText(file)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => loadHar(ev.target?.result as string)
    reader.readAsText(file)
  }

  let entries: HarEntry[] = []
  let stats = { total: 0, size: 0, time: 0 }

  if (state.harRaw) {
    try {
      const parsed = JSON.parse(state.harRaw)
      entries = parsed.log.entries as HarEntry[]
      stats.total = entries.length
      stats.size = entries.reduce((acc, e) => acc + (e.response.content.size ?? 0), 0)
      stats.time = entries.reduce((acc, e) => acc + e.time, 0)
    } catch {
      // handled by harError
    }
  }

  const filtered = entries.filter(e => {
    const url = e.request.url.toLowerCase()
    const method = e.request.method.toUpperCase()
    const filter = state.harFilter.toLowerCase()
    const mf = state.harMethodFilter.toUpperCase()
    if (mf && method !== mf) return false
    if (filter && !url.includes(filter) && !String(e.response.status).includes(filter)) return false
    return true
  })

  const selectedEntry = state.harSelectedEntry !== null ? filtered[state.harSelectedEntry] ?? null : null

  if (!state.harRaw) {
    return (
      <div className="har-tab">
        {state.harError && <div className="har-error-banner">⚠ {state.harError}</div>}
        <div
          className="har-dropzone"
          onDrop={onDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
        >
          <span className="har-dropzone__icon">📂</span>
          <span className="har-dropzone__title">Drop a .har file here or click to browse</span>
          <span className="har-dropzone__sub">
            Export from Chrome DevTools → Network → ⬇ (Save all as HAR with content)
          </span>
          <input ref={fileRef} type="file" accept=".har,application/json" style={{ display: 'none' }} onChange={onFile} />
        </div>
        <p className="har-hint">You can also paste HAR JSON directly below:</p>
        <textarea
          className="har-paste-area"
          placeholder='{"log": {"entries": [...]}}'
          onBlur={e => { if (e.target.value.trim()) loadHar(e.target.value) }}
        />
      </div>
    )
  }

  return (
    <div className="har-tab har-tab--loaded">
      <div className="har-toolbar">
        <div className="har-toolbar__stats">
          <span className="har-stat">{filtered.length} / {stats.total} requests</span>
          <span className="har-stat har-stat--muted">{fmtBytes(stats.size)}</span>
          <span className="har-stat har-stat--muted">{fmtTime(stats.time)}</span>
        </div>
        <div className="har-filters">
          <select
            className="har-filters__pills"
            value={state.harMethodFilter}
            onChange={e => dispatch({ type: 'SET_HAR_METHOD_FILTER', method: e.target.value })}
          >
            <option value="">All methods</option>
            {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <input
            className="har-filters__search"
            placeholder="Filter by URL or status…"
            value={state.harFilter}
            onChange={e => dispatch({ type: 'SET_HAR_FILTER', filter: e.target.value })}
          />
          <button className="btn btn--sm" onClick={() => dispatch({ type: 'CLEAR_HAR' })}>Clear</button>
        </div>
      </div>

      <div className="har-body">
        <div className="har-table-wrap">
          <table className="har-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Method</th>
                <th className="har-table__url-col">URL</th>
                <th>Status</th>
                <th>Size</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="har-table__empty">No matching entries</td></tr>
              )}
              {filtered.map((entry, i) => (
                <tr
                  key={i}
                  className={`har-table__row${state.harSelectedEntry === i ? ' har-table__row--active' : ''}`}
                  onClick={() => dispatch({ type: 'SET_HAR_SELECTED_ENTRY', index: state.harSelectedEntry === i ? null : i })}
                >
                  <td className="har-table__num">{i + 1}</td>
                  <td>
                    <span className="har-method" style={{ color: methodColor(entry.request.method) }}>
                      {entry.request.method}
                    </span>
                  </td>
                  <td className="har-table__url">
                    <span className="har-table__mono">{entry.request.url}</span>
                  </td>
                  <td>
                    <span className="har-status" style={{ color: statusColor(entry.response.status) }}>
                      {entry.response.status} {entry.response.statusText}
                    </span>
                  </td>
                  <td className="har-table__mono">{fmtBytes(entry.response.content.size)}</td>
                  <td className="har-table__mono">{fmtTime(entry.time)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selectedEntry && (
          <div className="har-detail">
            <div className="har-detail__header">
              <span className="har-method" style={{ color: methodColor(selectedEntry.request.method) }}>
                {selectedEntry.request.method}
              </span>
              <span className="har-detail__url">{selectedEntry.request.url}</span>
            </div>
            <div className="har-detail__meta">
              <span className="har-stat" style={{ color: statusColor(selectedEntry.response.status) }}>
                {selectedEntry.response.status} {selectedEntry.response.statusText}
              </span>
              <span className="har-stat har-stat--muted">{fmtTime(selectedEntry.time)}</span>
              <span className="har-stat har-stat--muted">{fmtBytes(selectedEntry.response.content.size)}</span>
            </div>
            <div className="har-detail__pane">
              <div className="har-detail__section">
                <div className="har-detail__section-title">Request Headers</div>
                <HeadersTable headers={selectedEntry.request.headers} />
              </div>
              {selectedEntry.request.postData && (
                <div className="har-detail__section">
                  <div className="har-detail__section-title">
                    Request Body
                    <span className="har-detail__section-mime">{selectedEntry.request.postData.mimeType}</span>
                  </div>
                  <pre className="har-detail__body-pane">{tryPretty(selectedEntry.request.postData.text)}</pre>
                </div>
              )}
              <div className="har-detail__section">
                <div className="har-detail__section-title">Response Headers</div>
                <HeadersTable headers={selectedEntry.response.headers} />
              </div>
              {selectedEntry.response.content.text && (
                <div className="har-detail__section">
                  <div className="har-detail__section-title">
                    Response Body
                    <span className="har-detail__section-mime">{selectedEntry.response.content.mimeType}</span>
                  </div>
                  <pre className="har-detail__body-pane">{tryPretty(selectedEntry.response.content.text)}</pre>
                </div>
              )}
              <div className="har-detail__section">
                <div className="har-detail__section-title">Timing</div>
                <TimingBar timings={selectedEntry.timings} total={selectedEntry.time} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
