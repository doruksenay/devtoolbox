import { useEffect, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { useWorkerParse } from './useWorkerParse'

/**
 * Auto-validates editor JSON with 500ms debounce.
 * Only runs when editor tab is active and content exists.
 *
 * Parsing goes through the worker hook, which moves large documents off the
 * main thread — this runs on every typing pause, so a multi-megabyte document
 * would otherwise freeze the UI repeatedly while the user types.
 */
export function useLiveValidation() {
  const { state, dispatch } = useApp()
  const { parse } = useWorkerParse()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Parsing is async now, so a slow result must not overwrite a newer one.
  const runIdRef = useRef(0)

  useEffect(() => {
    if (state.activeTab !== 'editor') return
    if (!state.editorRaw.trim()) return

    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(() => {
      const runId = ++runIdRef.current
      void parse(state.editorRaw).then((result) => {
        if (runId !== runIdRef.current) return // superseded while parsing
        if (result.success) {
          dispatch({ type: 'SET_EDITOR_PARSED', parsed: result.data, error: null })
        } else {
          dispatch({ type: 'SET_EDITOR_ERROR', error: result.error ?? 'Invalid JSON' })
        }
      })
    }, 500)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [state.editorRaw, state.activeTab, dispatch, parse])
}
