import { useState, useEffect, useRef, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { IconSun, IconMoon, IconGithub, IconSearch } from '../icons/Icons'
import { AuthModal } from '../Auth/AuthModal'
import { AdminPanel } from '../Admin/AdminPanel'
import { ChangePasswordModal } from '../Admin/ChangePasswordModal'
import { ChangeAvatarModal } from '../Admin/ChangeAvatarModal'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const cmdLabel = isMac ? '⌘K' : 'Ctrl+K'

const AVATARS = ['🦊', '🐼', '🦁', '🐨', '🐸', '🦄', '🐙', '🦋', '🐺', '🦝', '🐻', '🦩', '🐯', '🦅', '🦜']

function pickAvatar(uid: string): string {
  let hash = 0
  for (let i = 0; i < uid.length; i++) hash = (hash * 31 + uid.charCodeAt(i)) >>> 0
  return AVATARS[hash % AVATARS.length]
}

export function Header() {
  const { state, dispatch } = useApp()
  const { user, signOut, loading, isAdmin } = useAuth()
  const [showAuth, setShowAuth] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [showChangeAvatar, setShowChangeAvatar] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const avatar = useMemo(() => {
    if (!user) return ''
    // localStorage takes priority – it reflects the most recent choice on this
    // device, even if the background Supabase sync hasn't completed yet.
    const local = localStorage.getItem(`dtb_avatar_${user.id}`)
    return local ?? (user.user_metadata?.avatar as string | undefined) ?? pickAvatar(user.id)
  }, [user])

  // Close menu when clicking outside
  useEffect(() => {
    if (!showMenu) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showMenu])

  async function handleSignOut() {
    setShowMenu(false)
    await signOut()
  }

  function openAdminPanel() {
    setShowMenu(false)
    setShowAdminPanel(true)
  }

  function openChangePassword() {
    setShowMenu(false)
    setShowChangePassword(true)
  }

  function openChangeAvatar() {
    setShowMenu(false)
    setShowChangeAvatar(true)
  }

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

        {loading ? null : user ? (
          <div className="app-header__user-wrap" ref={menuRef}>
            <button
              className="btn btn-ghost app-header__user-btn"
              title={`Signed in as ${user.email}`}
              onClick={() => setShowMenu(v => !v)}
              aria-expanded={showMenu}
            >
              <span className="app-header__user-avatar">{avatar}</span>
            </button>
            {showMenu && (
              <div className="app-header__user-menu">
                <p className="app-header__user-email">{user.email}</p>
                <hr className="app-header__user-divider" />
                {isAdmin && (
                  <button className="app-header__user-menu-item" onClick={openAdminPanel}>
                    🛡️ Admin Panel
                  </button>
                )}
                <button className="app-header__user-menu-item" onClick={openChangeAvatar}>
                  🎭 Change Avatar
                </button>
                <button className="app-header__user-menu-item" onClick={openChangePassword}>
                  🔑 Change Password
                </button>
                <hr className="app-header__user-divider" />
                <button className="app-header__user-signout" onClick={handleSignOut}>
                  Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            className="btn btn-ghost"
            title="Sign in to save your work"
            onClick={() => setShowAuth(true)}
          >
            Sign in
          </button>
        )}

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

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {showAdminPanel && <AdminPanel onClose={() => setShowAdminPanel(false)} />}
      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
      {showChangeAvatar && <ChangeAvatarModal onClose={() => setShowChangeAvatar(false)} currentAvatar={avatar} />}
    </header>
  )
}
