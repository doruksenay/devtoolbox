import { useRef, useCallback, useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { useToast } from '../Toast/ToastProvider'
import { checkFileSize, MAX_DIAGRAM_FILE_BYTES } from '../../utils/limits'
import type { DrawShape, DrawConnection, DrawTool } from '../../types'

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_W = 140
const DEFAULT_H = 60
const HANDLE_SIZE = 8
const GRID_SIZE = 20
const COLORS = ['#4f8ef7','#4caf50','#ff9800','#f44336','#9c27b0','#00bcd4','#607d8b','#795548','#e91e63','#fff176']

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

function snapToGrid(v: number, enabled: boolean): number {
  if (!enabled) return v
  return Math.round(v / GRID_SIZE) * GRID_SIZE
}

// ── Shape rendering helpers ──────────────────────────────────────────────────

function ShapeEl({
  shape, selected, onMouseDown,
}: {
  shape: DrawShape
  selected: boolean
  onMouseDown: (e: React.MouseEvent, id: string) => void
}) {
  const { x, y, w, h, label, color, type } = shape
  const cx = x + w / 2
  const cy = y + h / 2

  let body: React.ReactNode
  if (type === 'rect') {
    body = <rect x={x} y={y} width={w} height={h} rx={6} fill={color} stroke={selected ? '#fff' : 'none'} strokeWidth={2} />
  } else if (type === 'ellipse') {
    body = <ellipse cx={cx} cy={cy} rx={w / 2} ry={h / 2} fill={color} stroke={selected ? '#fff' : 'none'} strokeWidth={2} />
  } else if (type === 'diamond') {
    const pts = `${cx},${y} ${x + w},${cy} ${cx},${y + h} ${x},${cy}`
    body = <polygon points={pts} fill={color} stroke={selected ? '#fff' : 'none'} strokeWidth={2} />
  } else if (type === 'cylinder') {
    const ry = h * 0.15
    body = (
      <g>
        <rect x={x} y={y + ry} width={w} height={h - ry * 2} fill={color} stroke={selected ? '#fff' : 'none'} strokeWidth={2} />
        <ellipse cx={cx} cy={y + ry} rx={w / 2} ry={ry} fill={color} stroke={selected ? '#fff' : 'none'} strokeWidth={2} />
        <ellipse cx={cx} cy={y + h - ry} rx={w / 2} ry={ry} fill={color} stroke={selected ? '#fff' : 'none'} strokeWidth={2} />
        {/* top rim line */}
        <ellipse cx={cx} cy={y + ry} rx={w / 2} ry={ry} fill="none" stroke={isLight(color) ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.25)'} strokeWidth={1} />
      </g>
    )
  } else if (type === 'hexagon') {
    const q = w / 4
    const pts = `${x + q},${y} ${x + w - q},${y} ${x + w},${cy} ${x + w - q},${y + h} ${x + q},${y + h} ${x},${cy}`
    body = <polygon points={pts} fill={color} stroke={selected ? '#fff' : 'none'} strokeWidth={2} />
  } else if (type === 'parallelogram') {
    const offset = w * 0.15
    const pts = `${x + offset},${y} ${x + w},${y} ${x + w - offset},${y + h} ${x},${y + h}`
    body = <polygon points={pts} fill={color} stroke={selected ? '#fff' : 'none'} strokeWidth={2} />
  } else {
    // text node
    body = <rect x={x} y={y} width={w} height={h} rx={4} fill="none" stroke={color} strokeWidth={selected ? 2.5 : 1.5} strokeDasharray="6 3" />
  }

  return (
    <g
      className="draw-shape"
      style={{ cursor: 'move' }}
      onMouseDown={e => onMouseDown(e, shape.id)}
    >
      {body}
      {label && (
        <text
          x={cx} y={cy}
          textAnchor="middle" dominantBaseline="central"
          fill={type === 'text' ? color : (isLight(color) ? '#222' : '#fff')}
          fontSize={13}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {label}
        </text>
      )}
      {/* Resize handle */}
      {selected && (
        <rect
          className="draw-resize-handle"
          x={x + w - HANDLE_SIZE} y={y + h - HANDLE_SIZE}
          width={HANDLE_SIZE} height={HANDLE_SIZE}
          fill="#fff" stroke="#333" strokeWidth={1}
          style={{ cursor: 'se-resize' }}
          onMouseDown={e => { e.stopPropagation(); /* handled in canvas mouse logic */ }}
        />
      )}
    </g>
  )
}

function isLight(hex: string): boolean {
  const c = hex.replace('#', '')
  if (c.length < 6) return false
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 160
}

function getCenter(s: DrawShape) {
  return { x: s.x + s.w / 2, y: s.y + s.h / 2 }
}

function arrowPath(from: DrawShape, to: DrawShape): string {
  const a = getCenter(from)
  const b = getCenter(to)
  return `M${a.x},${a.y} L${b.x},${b.y}`
}

// ── Draw Tab ─────────────────────────────────────────────────────────────────

type DragMode = 'none' | 'move' | 'resize' | 'connect-pending' | 'drawing'

interface UndoFrame {
  shapes: DrawShape[]
  connections: DrawConnection[]
}

export function DrawTab() {
  const { state, dispatch } = useApp()
  const { addToast } = useToast()
  const shapes = state.drawShapes
  const connections = state.drawConnections
  const tool = state.drawTool
  const selectedIds = state.drawSelectedIds
  const selectedColor = state.drawSelectedColor

  const svgRef = useRef<SVGSVGElement>(null)
  const undoStack = useRef<UndoFrame[]>([])

  // Grid & snap
  const [showGrid, setShowGrid] = useState(true)
  const [snapEnabled, setSnapEnabled] = useState(true)

  const snap = useCallback((v: number) => snapToGrid(v, snapEnabled), [snapEnabled])

  // Local drag state (not in global store to avoid unnecessary re-renders)
  const drag = useRef<{
    mode: DragMode
    startX: number
    startY: number
    shapeId?: string
    connectFrom?: string
    newShapeId?: string
    origShapes?: DrawShape[]
  }>({ mode: 'none', startX: 0, startY: 0 })

  // Label editing
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState('')
  const labelInputRef = useRef<HTMLInputElement>(null)

  // The inline label editor only exists while a shape is being renamed, so the
  // focus is moved programmatically instead of with `autoFocus`.
  useEffect(() => {
    if (editingId) labelInputRef.current?.focus()
  }, [editingId])

  // Both are memoised so the effects below can list them as dependencies: as
  // plain function declarations they were recreated every render and the
  // listeners kept calling the very first version, snapshotting stale shapes.
  const pushUndo = useCallback(() => {
    undoStack.current.push({ shapes: [...shapes], connections: [...connections] })
    if (undoStack.current.length > 50) undoStack.current.shift()
  }, [shapes, connections])

  const undo = useCallback(() => {
    const frame = undoStack.current.pop()
    if (!frame) return
    dispatch({ type: 'SET_DRAW_SHAPES', shapes: frame.shapes })
    dispatch({ type: 'SET_DRAW_CONNECTIONS', connections: frame.connections })
    dispatch({ type: 'SET_DRAW_SELECTED_IDS', ids: [] })
  }, [dispatch])

  function svgPoint(e: React.MouseEvent | MouseEvent): { x: number; y: number } {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const rect = svg.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  // ── Mouse down on canvas ─────────────────────────────────────────────────

  function onCanvasMouseDown(e: React.MouseEvent) {
    if (e.target === svgRef.current || (e.target as Element).classList.contains('draw-canvas-bg') || (e.target as Element).tagName === 'pattern' || (e.target as Element).classList.contains('draw-grid')) {
      // Click on empty canvas
      if (tool === 'select') {
        dispatch({ type: 'SET_DRAW_SELECTED_IDS', ids: [] })
        return
      }
      if (tool === 'connect') return

      const { x, y } = svgPoint(e)
      const w = DEFAULT_W
      const h = DEFAULT_H
      const id = uid()
      const shapeType = tool as DrawShape['type']
      const sx = snap(x - w / 2)
      const sy = snap(y - h / 2)
      const newShape: DrawShape = {
        id, type: shapeType, x: sx, y: sy,
        w, h, label: shapeType === 'text' ? 'Text' : shapeType.charAt(0).toUpperCase() + shapeType.slice(1),
        color: selectedColor,
      }
      pushUndo()
      dispatch({ type: 'SET_DRAW_SHAPES', shapes: [...shapes, newShape] })
      dispatch({ type: 'SET_DRAW_SELECTED_IDS', ids: [id] })
      // Start drag to resize as placing
      drag.current = { mode: 'drawing', startX: x, startY: y, newShapeId: id }
    }
  }

  // ── Mouse down on shape ──────────────────────────────────────────────────

  function onShapeMouseDown(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (editingId) { commitLabel(); return }

    if (tool === 'connect') {
      drag.current = { mode: 'connect-pending', startX: 0, startY: 0, connectFrom: id }
      return
    }

    const { x, y } = svgPoint(e)
    const shape = shapes.find(s => s.id === id)!

    // Check if click is on resize handle
    const nearRight  = Math.abs(e.clientX - (svgRef.current!.getBoundingClientRect().left + shape.x + shape.w)) < HANDLE_SIZE + 4
    const nearBottom = Math.abs(e.clientY - (svgRef.current!.getBoundingClientRect().top  + shape.y + shape.h)) < HANDLE_SIZE + 4

    if (selectedIds.includes(id) && nearRight && nearBottom) {
      drag.current = { mode: 'resize', startX: x, startY: y, shapeId: id, origShapes: shapes }
      return
    }

    const newSel = e.shiftKey
      ? selectedIds.includes(id) ? selectedIds.filter(s => s !== id) : [...selectedIds, id]
      : [id]
    dispatch({ type: 'SET_DRAW_SELECTED_IDS', ids: newSel })
    drag.current = { mode: 'move', startX: x, startY: y, origShapes: shapes }
  }

  // ── Mouse move / up (global) ─────────────────────────────────────────────

  const onMouseMove = useCallback((e: MouseEvent) => {
    const d = drag.current
    if (d.mode === 'none') return
    const { x, y } = svgPoint(e as unknown as React.MouseEvent)
    const dx = x - d.startX
    const dy = y - d.startY

    if (d.mode === 'move' && d.origShapes) {
      const updated = d.origShapes.map(s =>
        selectedIds.includes(s.id)
          ? { ...s, x: snap(s.x + dx), y: snap(s.y + dy) }
          : s
      )
      dispatch({ type: 'SET_DRAW_SHAPES', shapes: updated })
    }

    if (d.mode === 'resize' && d.shapeId && d.origShapes) {
      const orig = d.origShapes.find(s => s.id === d.shapeId)!
      const updated = d.origShapes.map(s =>
        s.id === d.shapeId
          ? { ...s, w: Math.max(60, snap(orig.w + dx)), h: Math.max(30, snap(orig.h + dy)) }
          : s
      )
      dispatch({ type: 'SET_DRAW_SHAPES', shapes: updated })
    }

    if (d.mode === 'drawing' && d.newShapeId && d.origShapes === undefined) {
      const orig = shapes.find(s => s.id === d.newShapeId)
      if (orig) {
        const updated = shapes.map(s =>
          s.id === d.newShapeId
            ? { ...s, w: Math.max(60, snap(DEFAULT_W + dx)), h: Math.max(30, snap(DEFAULT_H + dy)) }
            : s
        )
        dispatch({ type: 'SET_DRAW_SHAPES', shapes: updated })
      }
    }
  }, [selectedIds, shapes, dispatch, snap])

  const onMouseUp = useCallback((e: MouseEvent) => {
    const d = drag.current
    if (d.mode === 'move' || d.mode === 'resize' || d.mode === 'drawing') {
      if (d.origShapes) pushUndo()
    }
    if (d.mode === 'connect-pending') {
      // Find shape under pointer
      const { x, y } = svgPoint(e as unknown as React.MouseEvent)
      const target = shapes.find(s => x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h)
      if (target && target.id !== d.connectFrom && d.connectFrom) {
        const already = connections.some(c => c.from === d.connectFrom && c.to === target.id)
        if (!already) {
          pushUndo()
          dispatch({ type: 'SET_DRAW_CONNECTIONS', connections: [...connections, { id: uid(), from: d.connectFrom, to: target.id }] })
        }
      }
    }
    drag.current = { mode: 'none', startX: 0, startY: 0 }
  }, [shapes, connections, dispatch, pushUndo])

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [onMouseMove, onMouseUp])

  // ── Keyboard shortcuts ───────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (editingId) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (document.activeElement && document.activeElement !== document.body) return
        if (selectedIds.length === 0) return
        pushUndo()
        dispatch({ type: 'SET_DRAW_SHAPES', shapes: shapes.filter(s => !selectedIds.includes(s.id)) })
        dispatch({
          type: 'SET_DRAW_CONNECTIONS',
          connections: connections.filter(c => !selectedIds.includes(c.from) && !selectedIds.includes(c.to)),
        })
        dispatch({ type: 'SET_DRAW_SELECTED_IDS', ids: [] })
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedIds, shapes, connections, editingId, dispatch, pushUndo, undo])

  // ── Label editing ────────────────────────────────────────────────────────

  function onShapeDblClick(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    const shape = shapes.find(s => s.id === id)!
    setEditingId(id)
    setEditingLabel(shape.label)
  }

  function commitLabel() {
    if (!editingId) return
    dispatch({
      type: 'SET_DRAW_SHAPES',
      shapes: shapes.map(s => s.id === editingId ? { ...s, label: editingLabel } : s),
    })
    setEditingId(null)
  }

  // ── Connection click (delete) ────────────────────────────────────────────

  function onConnClick(id: string) {
    pushUndo()
    dispatch({ type: 'SET_DRAW_CONNECTIONS', connections: connections.filter(c => c.id !== id) })
  }

  // ── Color change ─────────────────────────────────────────────────────────

  function applyColor(color: string) {
    dispatch({ type: 'SET_DRAW_SELECTED_COLOR', color })
    if (selectedIds.length) {
      dispatch({
        type: 'SET_DRAW_SHAPES',
        shapes: shapes.map(s => selectedIds.includes(s.id) ? { ...s, color } : s),
      })
    }
  }

  // ── Export / Import ──────────────────────────────────────────────────────

  function exportDiagram() {
    const data = JSON.stringify({ shapes, connections }, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'diagram.json'
    a.click()
  }

  function importDiagram(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // reset so the same file can be re-imported
    if (!file) return
    const sizeError = checkFileSize(file, MAX_DIAGRAM_FILE_BYTES)
    if (sizeError) {
      addToast(sizeError, 'error')
      return
    }
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target?.result as string)
        if (Array.isArray(data.shapes) && Array.isArray(data.connections)) {
          pushUndo()
          dispatch({ type: 'SET_DRAW_SHAPES', shapes: data.shapes })
          dispatch({ type: 'SET_DRAW_CONNECTIONS', connections: data.connections })
        }
      } catch { /* ignore */ }
    }
    reader.readAsText(file)
  }

  const importRef = useRef<HTMLInputElement>(null)

  // ── Toolbar tools ────────────────────────────────────────────────────────

  const TOOLS: { id: DrawTool; label: string; key: string }[] = [
    { id: 'select',       label: '↖ Select',       key: 'S' },
    { id: 'rect',         label: '▭ Rect',          key: 'R' },
    { id: 'ellipse',      label: '⬭ Ellipse',       key: 'E' },
    { id: 'diamond',      label: '◇ Diamond',       key: 'D' },
    { id: 'cylinder',     label: '⬤ Cylinder',      key: 'Y' },
    { id: 'hexagon',      label: '⬡ Hexagon',       key: 'H' },
    { id: 'parallelogram',label: '▱ Process',       key: 'P' },
    { id: 'text',         label: 'T Text',          key: 'T' },
    { id: 'connect',      label: '→ Connect',       key: 'C' },
  ]

  return (
    <div className="draw-tab">
      <div className="draw-toolbar">
        <div className="draw-toolbar__group">
          {TOOLS.map(t => (
            <button
              key={t.id}
              title={`${t.label} (${t.key})`}
              className={`draw-tool-btn${tool === t.id ? ' draw-tool-btn--active' : ''}`}
              onClick={() => dispatch({ type: 'SET_DRAW_TOOL', tool: t.id })}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="draw-toolbar__sep" />
        <div className="draw-toolbar__group draw-toolbar__colors">
          {COLORS.map(c => (
            <button
              key={c}
              className={`draw-color-btn${selectedColor === c ? ' draw-color-btn--active' : ''}`}
              style={{ background: c }}
              title={c}
              aria-label={`Color ${c}`}
              aria-pressed={selectedColor === c}
              onClick={() => applyColor(c)}
            />
          ))}
        </div>
        <div className="draw-toolbar__sep" />
        <div className="draw-toolbar__group">
          <button
            className={`draw-action-btn${showGrid ? ' draw-action-btn--active' : ''}`}
            onClick={() => setShowGrid(g => !g)}
            title="Toggle grid"
          >
            ⊞ Grid
          </button>
          <button
            className={`draw-action-btn${snapEnabled ? ' draw-action-btn--active' : ''}`}
            onClick={() => setSnapEnabled(s => !s)}
            title="Toggle snap to grid"
          >
            ⊹ Snap
          </button>
        </div>
        <div className="draw-toolbar__sep" />
        <div className="draw-toolbar__group">
          <button className="draw-action-btn" onClick={undo} title="Undo (Ctrl+Z)">↩ Undo</button>
          <button className="draw-action-btn" onClick={exportDiagram} title="Export as JSON">⬇ Export</button>
          <button className="draw-action-btn draw-action-btn--import" onClick={() => importRef.current?.click()} title="Import JSON">⬆ Import</button>
          <button className="draw-action-btn" onClick={() => { pushUndo(); dispatch({ type: 'CLEAR_DRAW' }) }} title="Clear canvas">✕ Clear</button>
          <input ref={importRef} type="file" accept=".json" aria-label="Import diagram JSON" style={{ display: 'none' }} onChange={importDiagram} />
        </div>
      </div>

      <div className="draw-status">
        Tool: <strong>{tool}</strong>
        {selectedIds.length > 0 && ` · ${selectedIds.length} selected`}
        {tool === 'connect' && ' · Click source shape, then target shape'}
        {snapEnabled && <span style={{ color: 'var(--accent)', marginLeft: 8 }}>Snap ON</span>}
      </div>

      <div className="draw-canvas-wrap">
        <svg
          ref={svgRef}
          className="draw-canvas"
          onMouseDown={onCanvasMouseDown}
          onDoubleClick={e => {
            const id = (e.target as Element).closest('[data-id]')?.getAttribute('data-id')
            if (id) onShapeDblClick(e, id)
          }}
        >
          <defs>
            <pattern id="draw-grid-pattern" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
              <path d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`} fill="none" stroke="var(--border)" strokeWidth="0.5" />
            </pattern>
            <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="var(--text-secondary)" />
            </marker>
          </defs>

          {/* Grid background */}
          {showGrid && (
            <rect className="draw-grid" width="100%" height="100%" fill="url(#draw-grid-pattern)" />
          )}
          <rect className="draw-canvas-bg" x={0} y={0} width="100%" height="100%" fill="transparent" />

          {/* Connections */}
          {connections.map(conn => {
            const from = shapes.find(s => s.id === conn.from)
            const to   = shapes.find(s => s.id === conn.to)
            if (!from || !to) return null
            return (
              <path
                key={conn.id}
                d={arrowPath(from, to)}
                stroke="var(--text-secondary)"
                strokeWidth={2}
                fill="none"
                markerEnd="url(#arrow)"
                style={{ cursor: 'pointer' }}
                onClick={() => onConnClick(conn.id)}
              >
                <title>Click to delete this connection</title>
              </path>
            )
          })}

          {/* Shapes */}
          {shapes.map(shape => (
            <g key={shape.id} data-id={shape.id}>
              <ShapeEl
                shape={shape}
                selected={selectedIds.includes(shape.id)}
                onMouseDown={onShapeMouseDown}
              />
            </g>
          ))}
        </svg>

        {/* Inline label editor */}
        {editingId && (() => {
          const shape = shapes.find(s => s.id === editingId)
          if (!shape) return null
          const svg = svgRef.current
          if (!svg) return null
          const svgRect = svgRef.current!.getBoundingClientRect()
          const containerRect = svgRef.current!.closest('.draw-canvas-wrap')!.getBoundingClientRect()
          return (
            <input
              ref={labelInputRef}
              className="draw-label-input"
              aria-label="Shape label"
              style={{
                position: 'absolute',
                left: shape.x + shape.w / 2 - 60 + (svgRect.left - containerRect.left),
                top:  shape.y + shape.h / 2 - 14 + (svgRect.top  - containerRect.top),
                width: 120,
              }}
              value={editingLabel}
              onChange={e => setEditingLabel(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={e => { if (e.key === 'Enter') commitLabel(); if (e.key === 'Escape') setEditingId(null) }}
            />
          )
        })()}
      </div>

      {shapes.length === 0 && (
        <div className="draw-hint">
          Pick a shape tool and click on the canvas to place it. Double-click to edit the label.
          Use Connect to draw arrows between shapes. Delete key removes selected shapes.
        </div>
      )}
    </div>
  )
}
