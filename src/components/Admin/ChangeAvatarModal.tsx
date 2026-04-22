import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import '../Auth/AuthModal.css'
import './ChangeAvatarModal.css'

const AVATARS = ['🦊', '🐼', '🦁', '🐨', '🐸', '🦄', '🐙', '🦋', '🐺', '🦝', '🐻', '🦩', '🐯', '🦅', '🦜']

interface Props {
  onClose: () => void
  currentAvatar: string
}

export function ChangeAvatarModal({ onClose, currentAvatar }: Props) {
  const { updateAvatar } = useAuth()
  const [selected, setSelected] = useState(currentAvatar)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setBusy(true)
    setError(null)
    try {
      const err = await updateAvatar(selected)
      if (err) {
        setError(err)
      } else {
        onClose()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unexpected error. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={e => e.stopPropagation()}>
        <button className="auth-modal__close btn btn-ghost" onClick={onClose} aria-label="Close">✕</button>

        <h2 className="auth-modal__title">Choose Avatar</h2>
        <p className="auth-modal__subtitle">Select an emoji to represent you.</p>

        <div className="avatar-grid">
          {AVATARS.map(emoji => (
            <button
              key={emoji}
              type="button"
              className={`avatar-grid__item${selected === emoji ? ' avatar-grid__item--selected' : ''}`}
              onClick={() => setSelected(emoji)}
              aria-label={`Select ${emoji}`}
              aria-pressed={selected === emoji}
            >
              {emoji}
            </button>
          ))}
        </div>

        {error && <p className="auth-modal__error">{error}</p>}

        <button
          className="btn auth-modal__submit"
          onClick={handleSave}
          disabled={busy || selected === currentAvatar}
          style={{ marginTop: '1rem' }}
        >
          {busy ? 'Saving…' : 'Save Avatar'}
        </button>
      </div>
    </div>
  )
}
