import { useEffect } from 'react'
import { useApp } from '../context/AppContext'

/**
 * Global keyboard shortcuts:
 * - Ctrl+B → Beautify (editor tab)
 * - Ctrl+M → Minify (editor tab)
 * - Ctrl+S → Copy to clipboard (active tab content)
 * - Ctrl+K → Open command palette
 */
export function useKeyboardShortcuts() {
  const { state, dispatch, beautifyEditor, minifyEditor } = useApp()

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const ctrl = e.ctrlKey || e.metaKey

      if (ctrl && e.key === 'k') {
        e.preventDefault()
        dispatch({ type: 'TOGGLE_COMMAND_PALETTE' })
        return
      }

      if (ctrl && e.key === 'b') {
        e.preventDefault()
        if (state.activeTab === 'editor') {
          beautifyEditor()
        }
      }

      if (ctrl && e.key === 'm') {
        e.preventDefault()
        if (state.activeTab === 'editor') {
          minifyEditor()
        }
      }

      if (ctrl && e.key === 's') {
        e.preventDefault()
        let text = ''
        switch (state.activeTab) {
          case 'editor':
            text = state.editorRaw
            break
          case 'xml':
            text = state.xmlRaw
            break
          case 'compare':
            text = state.compareLeft || state.compareRight
            break
          case 'grid':
            text = state.gridRaw
            break
          case 'query':
            text = state.queryRaw
            break
        }
        if (text) {
          navigator.clipboard.writeText(text)
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [state.activeTab, state.editorRaw, state.xmlRaw, state.compareLeft, state.compareRight, state.gridRaw, state.queryRaw, dispatch, beautifyEditor, minifyEditor])
}
