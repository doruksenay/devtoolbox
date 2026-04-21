import { useApp } from '../../context/AppContext'
import type { TabId } from '../../types'
import {
  IconEditor, IconCompare, IconXml, IconGrid, IconQuery,
  IconConvert, IconHar, IconCron, IconJwt, IconDraw,
  IconYaml, IconBase64, IconUrlEnc, IconChevronLeft, IconChevronRight,
} from '../icons/Icons'

interface TabDef {
  id: TabId
  label: string
  icon: React.ReactNode
}

const TABS: TabDef[] = [
  { id: 'editor',  label: 'JSON Editor',  icon: <IconEditor /> },
  { id: 'compare', label: 'Compare',      icon: <IconCompare /> },
  { id: 'xml',     label: 'XML',          icon: <IconXml /> },
  { id: 'grid',    label: 'Grid View',    icon: <IconGrid /> },
  { id: 'query',   label: 'JSONPath',     icon: <IconQuery /> },
  { id: 'convert', label: 'Convert',      icon: <IconConvert /> },
  { id: 'har',     label: 'HAR Viewer',   icon: <IconHar /> },
  { id: 'cron',    label: 'Cron',         icon: <IconCron /> },
  { id: 'jwt',     label: 'JWT Decoder',  icon: <IconJwt /> },
  { id: 'draw',    label: 'Diagram',      icon: <IconDraw /> },
  { id: 'yaml',    label: 'YAML ↔ JSON',  icon: <IconYaml /> },
  { id: 'base64',  label: 'Base64',       icon: <IconBase64 /> },
  { id: 'urlenc',  label: 'URL Encoder',  icon: <IconUrlEnc /> },
]

export function Sidebar() {
  const { state, dispatch } = useApp()
  const collapsed = state.sidebarCollapsed

  return (
    <aside className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}`} aria-label="Tool navigation">
      <nav className="sidebar__nav" role="navigation">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="button"
            aria-label={tab.label}
            aria-current={state.activeTab === tab.id ? 'page' : undefined}
            className={`sidebar__item${state.activeTab === tab.id ? ' sidebar__item--active' : ''}`}
            onClick={() => dispatch({ type: 'SET_TAB', tab: tab.id })}
            title={collapsed ? tab.label : undefined}
          >
            <span className="sidebar__item-icon">{tab.icon}</span>
            {!collapsed && <span className="sidebar__item-label">{tab.label}</span>}
          </button>
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
      </div>
    </aside>
  )
}
