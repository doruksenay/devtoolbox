import { useEffect, useRef, useCallback } from 'react'
import { useApp } from '../context/AppContext'

const MAX_HISTORY = 100

/**
 * Undo/Redo for editor textarea (Ctrl+Z / Ctrl+Y).
 * Stores raw text snapshots in a history stack.
 */
export function useUndoRedo() {
  const { state, dispatch } = useApp()
  const historyRef = useRef<string[]>([state.editorRaw])
  const indexRef = useRef(0)
  const ignoreRef = useRef(false)

  // Track changes from editor
  useEffect(() => {
    if (ignoreRef.current) {
      ignoreRef.current = false
      return
    }
    const current = historyRef.current[indexRef.current]
    if (state.editorRaw === current) return

    // Remove any future states
    historyRef.current = historyRef.current.slice(0, indexRef.current + 1)
    historyRef.current.push(state.editorRaw)
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current.shift()
    } else {
      indexRef.current++
    }
  }, [state.editorRaw])

  const undo = useCallback(() => {
    if (indexRef.current > 0) {
      indexRef.current--
      ignoreRef.current = true
      dispatch({ type: 'SET_EDITOR_RAW', raw: historyRef.current[indexRef.current] })
    }
  }, [dispatch])

  const redo = useCallback(() => {
    if (indexRef.current < historyRef.current.length - 1) {
      indexRef.current++
      ignoreRef.current = true
      dispatch({ type: 'SET_EDITOR_RAW', raw: historyRef.current[indexRef.current] })
    }
  }, [dispatch])

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const ctrl = e.ctrlKey || e.metaKey
      if (state.activeTab !== 'editor') return

      if (ctrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      }
      if (ctrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [state.activeTab, undo, redo])
}
