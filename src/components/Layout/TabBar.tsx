import { useApp } from '../../context/AppContext'
import type { TabId } from '../../types'

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'editor',  label: 'Editor',  icon: '✎' },
  { id: 'compare', label: 'Compare', icon: '⇄' },
  { id: 'xml',     label: 'XML',     icon: '⟠' },
  { id: 'grid',    label: 'Grid',    icon: '▦' },
  { id: 'query',   label: 'Query',   icon: '⌕' },
  { id: 'convert', label: 'Convert', icon: '↹' },
]

export function TabBar() {
  const { state, dispatch } = useApp()

  return (
    <nav className="tab-bar" role="tablist">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={state.activeTab === tab.id}
          className={`tab-bar__item${state.activeTab === tab.id ? ' tab-bar__item--active' : ''}`}
          onClick={() => dispatch({ type: 'SET_TAB', tab: tab.id })}
        >
          <span className="tab-bar__item-icon">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </nav>
  )
}
