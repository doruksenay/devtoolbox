import { useEffect, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { parseJson } from '../context/AppContext'

/**
 * Auto-validates editor JSON with 500ms debounce.
 * Only runs when editor tab is active and content exists.
 */
export function useLiveValidation() {
  const { state, dispatch } = useApp()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (state.activeTab !== 'editor') return
    if (!state.editorRaw.trim()) return

    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(() => {
      const result = parseJson(state.editorRaw)
      if (result.valid) {
        dispatch({ type: 'SET_EDITOR_PARSED', parsed: result.parsed, error: null })
      } else {
        dispatch({ type: 'SET_EDITOR_ERROR', error: result.error ?? 'Invalid JSON' })
      }
    }, 500)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [state.editorRaw, state.activeTab, dispatch])
}
