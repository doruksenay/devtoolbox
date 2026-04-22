import { useState, type FormEvent } from 'react'
import { useAuth } from '../../context/AuthContext'
import '../Auth/AuthModal.css'

interface Props {
  onClose: () => void
}

export function ChangePasswordModal({ onClose }: Props) {
  const { changePassword } = useAuth()
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (newPassword !== confirm) {
      setError('Passwords do not match')
      return
    }

    setBusy(true)
    const err = await changePassword(newPassword)
    setBusy(false)

    if (err) {
      setError(err)
    } else {
      setSuccess(true)
    }
  }

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={e => e.stopPropagation()}>
        <button className="auth-modal__close btn btn-ghost" onClick={onClose} aria-label="Close">✕</button>

        <h2 className="auth-modal__title">Change Password</h2>
        <p className="auth-modal__subtitle">Enter a new password for your account.</p>

        {success ? (
          <>
            <p className="auth-modal__success">Password updated successfully.</p>
            <button className="btn auth-modal__submit" onClick={onClose} style={{ marginTop: '1rem' }}>
              Close
            </button>
          </>
        ) : (
          <form className="auth-modal__form" onSubmit={handleSubmit}>
            <label className="auth-modal__label">
              New Password
              <input
                className="auth-modal__input"
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                autoFocus
              />
            </label>

            <label className="auth-modal__label">
              Confirm Password
              <input
                className="auth-modal__input"
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
              />
            </label>

            {error && <p className="auth-modal__error">{error}</p>}

            <button className="btn auth-modal__submit" type="submit" disabled={busy}>
              {busy ? 'Updating…' : 'Change Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
