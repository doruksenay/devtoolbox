import { useState, useEffect, useRef, type FormEvent, type ChangeEvent, type MouseEvent } from 'react'
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

  const newPasswordRef = useRef<HTMLInputElement>(null)

  // Move focus into the dialog on open. Done programmatically rather than with
  // the `autoFocus` prop so focus is only claimed while the modal is mounted.
  useEffect(() => {
    newPasswordRef.current?.focus()
  }, [])

  // Escape closes the dialog, matching the click-outside affordance.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Only a click on the backdrop itself closes; clicks inside the dialog bubble
  // up but keep `target` pointing at a descendant.
  function handleOverlayClick(e: MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

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
    <div className="auth-overlay" role="presentation" onClick={handleOverlayClick}>
      <div className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="cp-title">
        <button className="auth-modal__close btn btn-ghost" onClick={onClose} aria-label="Close">✕</button>

        <h2 className="auth-modal__title" id="cp-title">Change Password</h2>
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
            {/* The field wrapper is the <label> itself so the control is both
                nested and referenced by id; the caption span carries the id the
                input names, keeping the error/hint text out of its a11y name. */}
            <label className="auth-modal__field" htmlFor="cp-new">
              <span className="auth-modal__label" id="cp-new-label">New Password</span>
              <input
                id="cp-new"
                ref={newPasswordRef}
                aria-labelledby="cp-new-label"
                className={`auth-modal__input${newPasswordError ? ' auth-modal__input--invalid' : ''}`}
                type="password"
                value={newPassword}
                onChange={handleNewPasswordChange}
                onBlur={() => setNewPasswordError(validatePassword(newPassword))}
                placeholder="••••••••"
                autoComplete="new-password"
              />
              {newPasswordError
                ? <span className="auth-modal__field-error">{newPasswordError}</span>
                : <span className="auth-modal__field-hint">Minimum 8 characters</span>
              }
            </label>

            <label className="auth-modal__field" htmlFor="cp-confirm">
              <span className="auth-modal__label" id="cp-confirm-label">Confirm Password</span>
              <input
                id="cp-confirm"
                aria-labelledby="cp-confirm-label"
                className={`auth-modal__input${confirmError ? ' auth-modal__input--invalid' : ''}`}
                type="password"
                value={confirm}
                onChange={handleConfirmChange}
                onBlur={() => setConfirmError(confirm !== newPassword ? 'Passwords do not match' : null)}
                placeholder="••••••••"
                autoComplete="new-password"
              />
              {confirmError && <span className="auth-modal__field-error">{confirmError}</span>}
            </label>

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
