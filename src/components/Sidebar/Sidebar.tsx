import { useAppDispatch, useAppSelector } from '../../context/AppContext'
import type { TabId } from '../../types'
import {
  IconEditor, IconCompare, IconXml, IconGrid, IconQuery,
  IconHar, IconCron, IconJwt, IconDraw,
  IconClean, IconTax, IconChevronLeft, IconChevronRight,
} from '../icons/Icons'

interface TabDef {
  id: TabId
  label: string
  icon: React.ReactNode
}

interface TabGroup {
  label: string
  tabs: TabDef[]
}

const GROUPS: TabGroup[] = [
  {
    label: 'Edit & View',
    tabs: [
      { id: 'editor',  label: 'JSON Editor',  icon: <IconEditor /> },
      { id: 'compare', label: 'JSON Compare', icon: <IconCompare /> },
      { id: 'xml',     label: 'XML Editor',   icon: <IconXml /> },
      { id: 'grid',    label: 'Grid View',    icon: <IconGrid /> },
      { id: 'draw',    label: 'Diagram',      icon: <IconDraw /> },
    ],
  },
  {
    label: 'Analyze',
    tabs: [
      { id: 'query', label: 'JSONPath',    icon: <IconQuery /> },
      { id: 'har',   label: 'HAR Viewer',  icon: <IconHar /> },
    ],
  },
  {
    label: 'Utilities',
    tabs: [
      { id: 'cron',   label: 'Cron',        icon: <IconCron /> },
      { id: 'jwt',    label: 'JWT Decoder', icon: <IconJwt /> },
      { id: 'clean',  label: 'Text Cleaner', icon: <IconClean /> },
      { id: 'tax',    label: 'Tax Calculator', icon: <IconTax /> },
    ],
  },
]

export function Sidebar() {
  const dispatch = useAppDispatch()
  const activeTab = useAppSelector((state) => state.activeTab)
  const collapsed = useAppSelector((state) => state.sidebarCollapsed)

  return (
    <aside className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}`} aria-label="Tool navigation">
      <nav className="sidebar__nav" role="navigation">
        {GROUPS.map((group) => (
          <div key={group.label} className="sidebar__group">
            <span className="sidebar__group-label">{group.label}</span>
            {group.tabs.map((tab) => (
              <button
                key={tab.id}
                role="button"
                aria-label={tab.label}
                aria-current={activeTab === tab.id ? 'page' : undefined}
                className={`sidebar__item${activeTab === tab.id ? ' sidebar__item--active' : ''}`}
                onClick={() => dispatch({ type: 'SET_TAB', tab: tab.id })}
                title={collapsed ? tab.label : undefined}
              >
                <span className="sidebar__item-icon">{tab.icon}</span>
                {!collapsed && <span className="sidebar__item-label">{tab.label}</span>}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar__footer">
        <button
          className="sidebar__collapse-btn"
          onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
          {!collapsed && <span className="sidebar__collapse-label">Collapse</span>}
        </button>
        {!collapsed && (
          <div className="sidebar__credit">by doruksenay</div>
        )}
      </div>
    </aside>
  )
}
