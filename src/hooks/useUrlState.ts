import { useEffect } from 'react'
import { useApp } from '../context/AppContext'
import type { TabId } from '../types'

const VALID_TABS: TabId[] = ['editor', 'compare', 'xml', 'grid', 'query', 'convert']

/**
 * Syncs active tab to URL hash for permalink/shareability.
 * Format: #editor, #compare, etc.
 */
export function useUrlState() {
  const { state, dispatch } = useApp()

  // On mount, read hash
  useEffect(() => {
    const hash = window.location.hash.replace('#', '') as TabId
    if (VALID_TABS.includes(hash) && hash !== state.activeTab) {
      dispatch({ type: 'SET_TAB', tab: hash })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update hash on tab change
  useEffect(() => {
    if (window.location.hash !== `#${state.activeTab}`) {
      window.history.replaceState(null, '', `#${state.activeTab}`)
    }
  }, [state.activeTab])
}
