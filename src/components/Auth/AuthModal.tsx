import { useState, useEffect, useRef, type FormEvent, type ChangeEvent, type MouseEvent } from 'react'
import { useAuth } from '../../context/AuthContext'
import './AuthModal.css'

interface Props {
  onClose: () => void
}

const REMEMBER_KEY = 'devtoolbox_remembered_email'

// Stricter email regex beyond browser built-in
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Email is required'
  if (!EMAIL_RE.test(email)) return 'Enter a valid email address'
  return null
}

function validatePassword(password: string, isRegister: boolean): string | null {
  if (!password) return 'Password is required'
  if (isRegister && password.length < 8) return 'Password must be at least 8 characters'
  return null
}

export function AuthModal({ onClose }: Props) {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)

  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const emailRef = useRef<HTMLInputElement>(null)

  // Load remembered email on mount
  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_KEY)
    if (saved) {
      setEmail(saved)
      setRememberMe(true)
    }
  }, [])

  // Move focus into the dialog on open. Done programmatically rather than with
  // the `autoFocus` prop so focus is only claimed while the modal is mounted.
  useEffect(() => {
    emailRef.current?.focus()
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

  function handleEmailChange(e: ChangeEvent<HTMLInputElement>) {
    setEmail(e.target.value)
    if (emailError) setEmailError(validateEmail(e.target.value))
  }

  function handlePasswordChange(e: ChangeEvent<HTMLInputElement>) {
    setPassword(e.target.value)
    if (passwordError) setPasswordError(validatePassword(e.target.value, mode === 'register'))
  }

  function switchMode(next: 'login' | 'register') {
    setMode(next)
    setEmailError(null)
    setPasswordError(null)
    setFormError(null)
    setSuccessMsg(null)
    // keep email when switching so user doesn't have to re-type it
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    setSuccessMsg(null)

    // Client-side validation
    const eErr = validateEmail(email)
    const pErr = validatePassword(password, mode === 'register')
    setEmailError(eErr)
    setPasswordError(pErr)
    if (eErr || pErr) return

    setBusy(true)

    if (mode === 'login') {
      if (rememberMe) {
        localStorage.setItem(REMEMBER_KEY, email)
      } else {
        localStorage.removeItem(REMEMBER_KEY)
      }

      const err = await signIn(email, password)
      if (err) {
        setFormError(err)
      } else {
        onClose()
      }
    } else {
      const { error, autoSignedIn } = await signUp(email, password)
      if (error) {
        setFormError(error)
      } else if (autoSignedIn) {
        // Email confirmation is disabled — user is immediately signed in
        onClose()
      } else {
        // Email confirmation is enabled — ask user to check inbox
        setSuccessMsg('Check your email to confirm your account, then sign in.')
        setMode('login')
      }
    }

    setBusy(false)
  }

  return (
    <div className="auth-overlay" role="presentation" onClick={handleOverlayClick}>
      <div className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
        <button className="auth-modal__close btn btn-ghost" onClick={onClose} aria-label="Close">✕</button>

        <h2 className="auth-modal__title" id="auth-modal-title">
          {mode === 'login' ? 'Sign in' : 'Create account'}
        </h2>
        <p className="auth-modal__subtitle">
          {mode === 'login'
            ? 'Your work is saved across sessions.'
            : 'Sign up to save your work across sessions.'}
        </p>

        <form className="auth-modal__form" onSubmit={handleSubmit} noValidate>
          {/* The field wrapper is the <label> itself so the control is both
              nested and referenced by id; the caption span carries the id the
              input names, keeping the error/hint text out of its a11y name. */}
          <label className="auth-modal__field" htmlFor="auth-email">
            <span className="auth-modal__label" id="auth-email-label">Email</span>
            <input
              id="auth-email"
              ref={emailRef}
              aria-labelledby="auth-email-label"
              className={`auth-modal__input${emailError ? ' auth-modal__input--invalid' : ''}`}
              type="email"
              value={email}
              onChange={handleEmailChange}
              onBlur={() => setEmailError(validateEmail(email))}
              placeholder="you@example.com"
              autoComplete="email"
            />
            {emailError && <span className="auth-modal__field-error">{emailError}</span>}
          </label>

          <label className="auth-modal__field" htmlFor="auth-password">
            <span className="auth-modal__label" id="auth-password-label">Password</span>
            <input
              id="auth-password"
              aria-labelledby="auth-password-label"
              className={`auth-modal__input${passwordError ? ' auth-modal__input--invalid' : ''}`}
              type="password"
              value={password}
              onChange={handlePasswordChange}
              onBlur={() => setPasswordError(validatePassword(password, mode === 'register'))}
              placeholder="••••••••"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            {passwordError
              ? <span className="auth-modal__field-error">{passwordError}</span>
              : mode === 'register' && <span className="auth-modal__field-hint">Minimum 8 characters</span>
            }
          </label>

          {mode === 'login' && (
            <label className="auth-modal__remember" htmlFor="auth-remember">
              <input
                id="auth-remember"
                aria-labelledby="auth-remember-label"
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
              />
              <span id="auth-remember-label">Remember me</span>
            </label>
          )}

          {formError && <p className="auth-modal__error">{formError}</p>}
          {successMsg && <p className="auth-modal__success">{successMsg}</p>}

          <button className="btn auth-modal__submit" type="submit" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="auth-modal__switch">
          {mode === 'login' ? (
            <>No account? <button className="auth-modal__link" onClick={() => switchMode('register')}>Create one</button></>
          ) : (
            <>Already have an account? <button className="auth-modal__link" onClick={() => switchMode('login')}>Sign in</button></>
          )}
        </p>
      </div>
    </div>
  )
}
