import { useApp } from '../../context/AppContext'

export function Header() {
  const { state, dispatch } = useApp()

  return (
    <header className="app-header">
      <div className="app-header__brand">
        <div className="app-header__brand-icon">{ '{' }</div>
        JSON Workbench
      </div>

      <div className="app-header__actions">
        <button
          className="btn btn-ghost"
          title="Toggle theme"
          onClick={() => dispatch({ type: 'TOGGLE_THEME' })}
        >
          {state.theme === 'dark' ? '☀' : '☾'} {state.theme === 'dark' ? 'Light' : 'Dark'}
        </button>

        <a
          href="https://github.com/doruksenay/devtoolbox"
          target="_blank"
          rel="noreferrer"
          className="btn btn-ghost"
        >
          GitHub
        </a>
      </div>
    </header>
  )
}
