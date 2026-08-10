import { useState, useEffect, useRef, useCallback } from 'react'
import { useAppDispatch, useAppSelector } from '../../context/AppContext'
import type { TabId } from '../../types'
import {
  IconEditor, IconCompare, IconXml, IconGrid, IconQuery,
  IconHar, IconCron, IconJwt, IconDraw,
  IconClean, IconTax,
} from '../icons/Icons'

interface ToolEntry {
  id: TabId
  label: string
  description: string
  icon: React.ReactNode
}

const TOOLS: ToolEntry[] = [
  { id: 'editor',  label: 'JSON Editor',   description: 'Edit, format and validate JSON', icon: <IconEditor /> },
  { id: 'compare', label: 'Compare',        description: 'Side-by-side JSON diff',          icon: <IconCompare /> },
  { id: 'xml',     label: 'XML',            description: 'Validate and format XML',          icon: <IconXml /> },
  { id: 'grid',    label: 'Grid View',      description: 'Tabular JSON grid viewer',         icon: <IconGrid /> },
  { id: 'query',   label: 'JSONPath Query', description: 'Query JSON with JSONPath',          icon: <IconQuery /> },
  { id: 'har',     label: 'HAR Viewer',     description: 'Inspect HTTP Archive files',       icon: <IconHar /> },
  { id: 'cron',    label: 'Cron',           description: 'Parse and explain cron expressions', icon: <IconCron /> },
  { id: 'jwt',     label: 'JWT Decoder',    description: 'Decode JWT tokens',                icon: <IconJwt /> },
  { id: 'draw',    label: 'Diagram',        description: 'Draw shapes and flow diagrams',    icon: <IconDraw /> },
  { id: 'clean',   label: 'Text Cleaner',   description: 'Decode HTML entities & strip invisible characters', icon: <IconClean /> },
  { id: 'tax',     label: 'Tax Calculator', description: 'Calculate Quebec (GST + QST) and Ontario (HST) sales tax', icon: <IconTax /> },
]

export function CommandPalette() {
  const dispatch = useAppDispatch()
  const activeTab = useAppSelector((state) => state.activeTab)
  const open = useAppSelector((state) => state.commandPaletteOpen)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const [activeIdx, setActiveIdx] = useState(0)

  const filtered = TOOLS.filter(t =>
    t.label.toLowerCase().includes(query.toLowerCase()) ||
    t.description.toLowerCase().includes(query.toLowerCase())
  )

  const close = useCallback(() => {
    dispatch({ type: 'SET_COMMAND_PALETTE_OPEN', open: false })
    setQuery('')
    setActiveIdx(0)
  }, [dispatch])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    setActiveIdx(0)
  }, [query])

  const select = useCallback((id: TabId) => {
    dispatch({ type: 'SET_TAB', tab: id })
    close()
  }, [dispatch, close])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return
      if (e.key === 'Escape') { close(); return }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx(i => Math.min(i + 1, filtered.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx(i => Math.max(i - 1, 0))
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        if (filtered[activeIdx]) select(filtered[activeIdx].id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, filtered, activeIdx, close, select])

  if (!open) return null

  return (
    <div className="cmd-overlay" onClick={close} role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="cmd-palette" onClick={e => e.stopPropagation()}>
        <div className="cmd-palette__search">
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className="cmd-palette__search-icon" aria-hidden="true">
            <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12 12l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            className="cmd-palette__input"
            placeholder="Search tools…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="cmd-palette__esc">Esc</kbd>
        </div>

        <div className="cmd-palette__list" role="listbox">
          {filtered.length === 0 && (
            <div className="cmd-palette__empty">No tools match "{query}"</div>
          )}
          {filtered.map((tool, i) => (
            <button
              key={tool.id}
              role="option"
              aria-selected={i === activeIdx}
              className={`cmd-palette__item${i === activeIdx ? ' cmd-palette__item--active' : ''}`}
              onClick={() => select(tool.id)}
              onMouseEnter={() => setActiveIdx(i)}
            >
              <span className="cmd-palette__item-icon">{tool.icon}</span>
              <span className="cmd-palette__item-text">
                <span className="cmd-palette__item-label">{tool.label}</span>
                <span className="cmd-palette__item-desc">{tool.description}</span>
              </span>
              {activeTab === tool.id && (
                <span className="cmd-palette__item-current">current</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
