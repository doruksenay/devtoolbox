import { useRef, useState, useCallback } from 'react'
import { useApp } from '../../context/AppContext'
import { useToast } from '../Toast/ToastProvider'
import { checkFileSize, MAX_TEXT_FILE_BYTES } from '../../utils/limits'

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
  _resourceType?: string
}

type DetailTab = 'request' | 'response' | 'timing'
type TypeFilter = '' | 'fetch' | 'xhr' | 'script' | 'stylesheet' | 'image' | 'font' | 'document' | 'other'

function getResourceType(entry: HarEntry): string {
  const rt = entry._resourceType?.toLowerCase()
  if (rt) return rt
  const url = entry.request.url.toLowerCase().split('?')[0]
  const mime = (entry.response.content.mimeType ?? '').toLowerCase()
  if (mime.includes('javascript') || url.endsWith('.js') || url.endsWith('.mjs')) return 'script'
  if (mime.includes('css') || url.endsWith('.css')) return 'stylesheet'
  if (mime.includes('image') || /\.(png|jpe?g|gif|svg|webp|ico|avif)$/.test(url)) return 'image'
  if (mime.includes('font') || /\.(woff2?|ttf|otf|eot)$/.test(url)) return 'font'
  if (mime.includes('html')) return 'document'
  const method = entry.request.method.toUpperCase()
  if (method !== 'GET' || mime.includes('json') || mime.includes('xml')) return 'xhr'
  return 'other'
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

function getUrlPath(url: string): string {
  try {
    const u = new URL(url)
    return (u.pathname + u.search) || url
  } catch {
    return url
  }
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

const TYPE_FILTERS: { label: string; value: TypeFilter }[] = [
  { label: 'All', value: '' },
  { label: 'Fetch', value: 'fetch' },
  { label: 'XHR', value: 'xhr' },
  { label: 'JS', value: 'script' },
  { label: 'CSS', value: 'stylesheet' },
  { label: 'Img', value: 'image' },
  { label: 'Font', value: 'font' },
  { label: 'Doc', value: 'document' },
  { label: 'Other', value: 'other' },
]

export function HarTab() {
  const { state, dispatch } = useApp()
  const { addToast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  // Local UI state
  const [detailWidth, setDetailWidth] = useState(420)
  const [detailTab, setDetailTab] = useState<DetailTab>('response')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('')

  // Resizable detail panel
  const resizeDragging = useRef(false)
  const resizeStartX = useRef(0)
  const resizeStartWidth = useRef(0)

  // Keyboard equivalent for the drag handle, using the same clamps as the drag.
  const onResizeKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const delta = e.key === 'ArrowLeft' ? 20 : -20
    setDetailWidth(w => Math.max(280, Math.min(800, w + delta)))
  }, [])

  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    resizeDragging.current = true
    resizeStartX.current = e.clientX
    resizeStartWidth.current = detailWidth

    function onMove(ev: MouseEvent) {
      if (!resizeDragging.current) return
      const delta = resizeStartX.current - ev.clientX
      setDetailWidth(Math.max(280, Math.min(800, resizeStartWidth.current + delta)))
    }
    function onUp() {
      resizeDragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [detailWidth])

  function loadHar(text: string) {
    try {
      const parsed = JSON.parse(text)
      if (!parsed?.log?.entries) throw new Error('Not a valid HAR file (missing log.entries)')
      dispatch({ type: 'SET_HAR_RAW', raw: text })
    } catch (e) {
      dispatch({ type: 'SET_HAR_ERROR', error: (e as Error).message })
    }
  }

  // Shared by the picker and the drop target: HAR captures are the biggest
  // files this app sees, so the size check has to happen before FileReader.
  function readFile(file: File | undefined) {
    if (!file) return
    const sizeError = checkFileSize(file, MAX_TEXT_FILE_BYTES)
    if (sizeError) {
      addToast(sizeError, 'error')
      return
    }
    const reader = new FileReader()
    reader.onload = ev => loadHar(ev.target?.result as string)
    reader.readAsText(file)
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    readFile(e.target.files?.[0])
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    readFile(e.dataTransfer.files[0])
  }

  function openInEditor(text: string | undefined) {
    if (!text) return
    const pretty = tryPretty(text)
    dispatch({ type: 'ADD_EDITOR_DOC', raw: pretty })
    dispatch({ type: 'SET_TAB', tab: 'editor' })
  }

  function copyText(text: string | undefined) {
    if (!text) return
    navigator.clipboard.writeText(tryPretty(text)).then(() => addToast('Copied to clipboard'))
  }

  let entries: HarEntry[] = []
  const stats = { total: 0, size: 0, time: 0 }

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
    if (typeFilter && getResourceType(e) !== typeFilter) return false
    if (filter && !url.includes(filter) && !String(e.response.status).includes(filter)) return false
    return true
  })

  const selectedEntry = state.harSelectedEntry !== null ? filtered[state.harSelectedEntry] ?? null : null

  function toggleEntry(i: number) {
    dispatch({ type: 'SET_HAR_SELECTED_ENTRY', index: state.harSelectedEntry === i ? null : i })
  }

  // Rows stay rows (turning them into buttons would break table semantics),
  // so they get the grid keyboard contract instead: Enter/Space toggles the
  // detail panel, Up/Down walks the list with a roving tabindex.
  function onRowKeyDown(e: React.KeyboardEvent<HTMLTableRowElement>, i: number) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggleEntry(i)
      return
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const sibling = e.key === 'ArrowDown'
        ? e.currentTarget.nextElementSibling
        : e.currentTarget.previousElementSibling
      if (sibling instanceof HTMLElement) sibling.focus()
    }
  }

  if (!state.harRaw) {
    return (
      <div className="har-tab">
        {state.harError && <div className="har-error-banner">⚠ {state.harError}</div>}
        {/* Kept as a div: `.har-dropzone` styles a plain block (and its :hover
            background would be clobbered by the inline reset a native <button>
            needs here), so it gets full button semantics instead. */}
        <div
          className="har-dropzone"
          role="button"
          tabIndex={0}
          aria-label="Drop a .har file here or press Enter to browse"
          onDrop={onDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              fileRef.current?.click()
            }
          }}
        >
          <span className="har-dropzone__icon">📂</span>
          <span className="har-dropzone__title">Drop a .har file here or click to browse</span>
          <span className="har-dropzone__sub">
            Export from Chrome DevTools → Network → ⬇ (Save all as HAR with content)
          </span>
          <input
            ref={fileRef}
            type="file"
            accept=".har,application/json"
            style={{ display: 'none' }}
            onChange={onFile}
            aria-label="Choose a .har file"
          />
        </div>
        <p className="har-hint" id="har-paste-hint">You can also paste HAR JSON directly below:</p>
        <textarea
          className="har-paste-area"
          placeholder='{"log": {"entries": [...]}}'
          onBlur={e => { if (e.target.value.trim()) loadHar(e.target.value) }}
          aria-labelledby="har-paste-hint"
        />
      </div>
    )
  }

  return (
    <div className="har-tab har-tab--loaded">
      {/* Toolbar row 1: stats + method filter + search */}
      <div className="har-toolbar">
        <div className="har-toolbar__stats">
          <span className="har-stat">{filtered.length} / {stats.total} requests</span>
          <span className="har-stat har-stat--muted">{fmtBytes(stats.size)}</span>
          <span className="har-stat har-stat--muted">{fmtTime(stats.time)}</span>
        </div>
        <div className="har-filters">
          <select
            className="har-filters__pills"
            aria-label="Filter by HTTP method"
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
            aria-label="Filter by URL or status"
            placeholder="Filter by URL or status…"
            value={state.harFilter}
            onChange={e => dispatch({ type: 'SET_HAR_FILTER', filter: e.target.value })}
          />
          <button className="btn btn--sm" onClick={() => dispatch({ type: 'CLEAR_HAR' })}>Clear</button>
        </div>
      </div>

      {/* Toolbar row 2: type filter chips */}
      <div className="har-type-filters">
        {TYPE_FILTERS.map(f => (
          <button
            key={f.value}
            className={`har-type-chip${typeFilter === f.value ? ' har-type-chip--active' : ''}`}
            onClick={() => setTypeFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="har-body">
        <div className="har-table-wrap">
          {/* role="grid" is what makes the rows' aria-selected meaningful. */}
          <table className="har-table" role="grid" aria-label="Captured requests">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Method</th>
                <th scope="col" className="har-table__url-col">URL</th>
                <th scope="col">Status</th>
                <th scope="col">Size</th>
                <th scope="col">Time</th>
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
                  aria-selected={state.harSelectedEntry === i}
                  tabIndex={state.harSelectedEntry === i || (state.harSelectedEntry === null && i === 0) ? 0 : -1}
                  onClick={() => toggleEntry(i)}
                  onKeyDown={e => onRowKeyDown(e, i)}
                >
                  <td className="har-table__num">{i + 1}</td>
                  <td>
                    <span className="har-method" style={{ color: methodColor(entry.request.method) }}>
                      {entry.request.method}
                    </span>
                  </td>
                  <td className="har-table__url" title={entry.request.url}>
                    <span className="har-table__mono">{getUrlPath(entry.request.url)}</span>
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
          <>
            {/* Resize handle */}
            <div
              className="har-resize-handle"
              onMouseDown={onResizeMouseDown}
              onKeyDown={onResizeKeyDown}
              title="Drag to resize"
              role="slider"
              aria-orientation="vertical"
              aria-label="Resize the request detail panel"
              aria-valuenow={detailWidth}
              aria-valuemin={280}
              aria-valuemax={800}
              tabIndex={0}
            />

            {/* Detail panel */}
            <div className="har-detail" style={{ width: detailWidth, minWidth: detailWidth, maxWidth: detailWidth }}>
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

              {/* Tabs */}
              <div className="har-detail__tabs">
                {(['request', 'response', 'timing'] as DetailTab[]).map(tab => (
                  <button
                    key={tab}
                    className={`har-detail__tab${detailTab === tab ? ' har-detail__tab--active' : ''}`}
                    onClick={() => setDetailTab(tab)}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              <div className="har-detail__pane">
                {detailTab === 'request' && (
                  <>
                    <div className="har-detail__section">
                      <div className="har-detail__section-title">Headers</div>
                      <HeadersTable headers={selectedEntry.request.headers} />
                    </div>
                    {selectedEntry.request.postData && (
                      <div className="har-detail__section">
                        <div className="har-detail__section-title">
                          Body
                          <span className="har-detail__section-mime">{selectedEntry.request.postData.mimeType}</span>
                          <div className="har-detail__section-actions">
                            <button className="har-action-btn" onClick={() => openInEditor(selectedEntry.request.postData?.text)} title="Open in JSON Editor">↗ Editor</button>
                            <button className="har-action-btn" onClick={() => copyText(selectedEntry.request.postData?.text)} title="Copy body">⎘ Copy</button>
                          </div>
                        </div>
                        <pre className="har-detail__body-pane">{tryPretty(selectedEntry.request.postData.text)}</pre>
                      </div>
                    )}
                  </>
                )}

                {detailTab === 'response' && (
                  <>
                    <div className="har-detail__section">
                      <div className="har-detail__section-title">Headers</div>
                      <HeadersTable headers={selectedEntry.response.headers} />
                    </div>
                    {selectedEntry.response.content.text && (
                      <div className="har-detail__section">
                        <div className="har-detail__section-title">
                          Body
                          <span className="har-detail__section-mime">{selectedEntry.response.content.mimeType}</span>
                          <div className="har-detail__section-actions">
                            <button className="har-action-btn" onClick={() => openInEditor(selectedEntry.response.content.text)} title="Open in JSON Editor">↗ Editor</button>
                            <button className="har-action-btn" onClick={() => copyText(selectedEntry.response.content.text)} title="Copy body">⎘ Copy</button>
                          </div>
                        </div>
                        <pre className="har-detail__body-pane">{tryPretty(selectedEntry.response.content.text)}</pre>
                      </div>
                    )}
                  </>
                )}

                {detailTab === 'timing' && (
                  <div className="har-detail__section">
                    <div className="har-detail__section-title">Timing</div>
                    <TimingBar timings={selectedEntry.timings} total={selectedEntry.time} />
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
