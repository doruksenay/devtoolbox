import { lazy, Suspense, type ComponentType } from 'react'
import { useAppSelector } from './context/AppContext'
import { Sidebar } from './components/Sidebar/Sidebar'
import { Header } from './components/Layout/Header'
import { CommandPalette } from './components/CommandPalette/CommandPalette'
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useLiveValidation } from './hooks/useLiveValidation'
import { useUrlState } from './hooks/useUrlState'
import { useUndoRedo } from './hooks/useUndoRedo'
import type { TabId } from './types'

// Each tool is code-split so the initial download only contains the app shell
// plus the tool the user actually opens.
function lazyTab<K extends string>(loader: () => Promise<Record<K, ComponentType>>, name: K) {
  return lazy(() => loader().then((module) => ({ default: module[name] })))
}

const TAB_COMPONENTS: Record<TabId, ComponentType> = {
  editor: lazyTab(() => import('./components/Editor/EditorTab'), 'EditorTab'),
  compare: lazyTab(() => import('./components/Compare/CompareTab'), 'CompareTab'),
  xml: lazyTab(() => import('./components/Xml/XmlTab'), 'XmlTab'),
  grid: lazyTab(() => import('./components/Grid/GridTab'), 'GridTab'),
  query: lazyTab(() => import('./components/Query/QueryTab'), 'QueryTab'),
  har: lazyTab(() => import('./components/Har/HarTab'), 'HarTab'),
  cron: lazyTab(() => import('./components/Cron/CronTab'), 'CronTab'),
  jwt: lazyTab(() => import('./components/Jwt/JwtTab'), 'JwtTab'),
  draw: lazyTab(() => import('./components/Draw/DrawTab'), 'DrawTab'),
  clean: lazyTab(() => import('./components/Clean/CleanTab'), 'CleanTab'),
  tax: lazyTab(() => import('./components/Tax/TaxTab'), 'TaxTab'),
}

// These hooks subscribe to editor state, so they live in their own render-free
// component: keeping them out of App means a keystroke no longer re-renders the
// shell and everything under it.
function AppEffects() {
  useKeyboardShortcuts()
  useLiveValidation()
  useUrlState()
  useUndoRedo()
  return null
}

export default function App() {
  const activeTab = useAppSelector((state) => state.activeTab)

  const ActiveTab = TAB_COMPONENTS[activeTab]

  return (
    <div className="app-shell">
      <AppEffects />
      <Header />
      <div className="app-shell__main">
        <Sidebar />
        <div className="tab-content">
          {/* Keyed on the active tab so switching tools clears a previous
              crash: the shell stays outside the boundary, so navigation keeps
              working even while a pane is showing the recovery screen. */}
          <ErrorBoundary key={activeTab}>
            <Suspense fallback={<div className="tab-loading">Loading…</div>}>
              {ActiveTab ? <ActiveTab /> : null}
            </Suspense>
          </ErrorBoundary>
        </div>
      </div>
      <CommandPalette />
    </div>
  )
}
