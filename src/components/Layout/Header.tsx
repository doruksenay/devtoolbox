import { useApp } from '../../context/AppContext'
import { IconSun, IconMoon, IconGithub, IconSearch } from '../icons/Icons'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const cmdLabel = isMac ? '⌘K' : 'Ctrl+K'

export function Header() {
  const { state, dispatch } = useApp()

  return (
    <header className="app-header">
      <div className="app-header__brand">
        <div className="app-header__brand-icon">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 4L2 8l2 4M12 4l2 4-2 4M9 2L7 14" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        DevToolbox
      </div>

      <div className="app-header__actions">
        <button
          className="btn btn-ghost app-header__cmd-btn"
          title={`Command Palette (${cmdLabel})`}
          onClick={() => dispatch({ type: 'SET_COMMAND_PALETTE_OPEN', open: true })}
        >
          <IconSearch size={14} />
          <span className="app-header__cmd-label">Search tools…</span>
          <kbd className="shortcut-hint">{cmdLabel}</kbd>
        </button>

        <button
          className="btn btn-ghost"
          title="Toggle theme"
          onClick={() => dispatch({ type: 'TOGGLE_THEME' })}
          aria-label="Toggle theme"
        >
          {state.theme === 'dark' ? <IconSun size={15} /> : <IconMoon size={15} />}
        </button>

        <a
          href="https://github.com/doruksenay/devtoolbox"
          target="_blank"
          rel="noreferrer"
          className="btn btn-ghost"
          aria-label="View on GitHub"
          title="GitHub"
        >
          <IconGithub size={15} />
        </a>
      </div>
    </header>
  )
}
