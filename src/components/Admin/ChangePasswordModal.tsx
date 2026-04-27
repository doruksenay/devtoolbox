import { useState, type FormEvent, type ChangeEvent } from 'react'
import { useAuth } from '../../context/AuthContext'
import '../Auth/AuthModal.css'

interface Props {
  onClose: () => void
}

function validatePassword(password: string): string | null {
  if (!password) return 'Password is required'
  if (password.length < 8) return 'Password must be at least 8 characters'
  return null
}

export function ChangePasswordModal({ onClose }: Props) {
  const { changePassword } = useAuth()
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [newPasswordError, setNewPasswordError] = useState<string | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [busy, setBusy] = useState(false)

  function handleNewPasswordChange(e: ChangeEvent<HTMLInputElement>) {
    setNewPassword(e.target.value)
    if (newPasswordError) setNewPasswordError(validatePassword(e.target.value))
  }

  function handleConfirmChange(e: ChangeEvent<HTMLInputElement>) {
    setConfirm(e.target.value)
    if (confirmError && e.target.value === newPassword) setConfirmError(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    const pErr = validatePassword(newPassword)
    setNewPasswordError(pErr)
    const cErr = confirm !== newPassword ? 'Passwords do not match' : null
    setConfirmError(cErr)
    if (pErr || cErr) return

    setBusy(true)
    const err = await changePassword(newPassword)
    setBusy(false)

    if (err) {
      setFormError(err)
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
          <form className="auth-modal__form" onSubmit={handleSubmit} noValidate>
            <div className="auth-modal__field">
              <label className="auth-modal__label" htmlFor="cp-new">New Password</label>
              <input
                id="cp-new"
                className={`auth-modal__input${newPasswordError ? ' auth-modal__input--invalid' : ''}`}
                type="password"
                value={newPassword}
                onChange={handleNewPasswordChange}
                onBlur={() => setNewPasswordError(validatePassword(newPassword))}
                placeholder="••••••••"
                autoComplete="new-password"
                autoFocus
              />
              {newPasswordError
                ? <span className="auth-modal__field-error">{newPasswordError}</span>
                : <span className="auth-modal__field-hint">Minimum 8 characters</span>
              }
            </div>

            <div className="auth-modal__field">
              <label className="auth-modal__label" htmlFor="cp-confirm">Confirm Password</label>
              <input
                id="cp-confirm"
                className={`auth-modal__input${confirmError ? ' auth-modal__input--invalid' : ''}`}
                type="password"
                value={confirm}
                onChange={handleConfirmChange}
                onBlur={() => setConfirmError(confirm !== newPassword ? 'Passwords do not match' : null)}
                placeholder="••••••••"
                autoComplete="new-password"
              />
              {confirmError && <span className="auth-modal__field-error">{confirmError}</span>}
            </div>

            {formError && <p className="auth-modal__error">{formError}</p>}

            <button className="btn auth-modal__submit" type="submit" disabled={busy}>
              {busy ? 'Updating…' : 'Change Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
