import { useState, type FormEvent } from 'react'
import { useAuth } from '../../context/AuthContext'
import './AuthModal.css'

interface Props {
  onClose: () => void
}

export function AuthModal({ onClose }: Props) {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)
    setBusy(true)

    if (mode === 'login') {
      const err = await signIn(email, password)
      if (err) {
        setError(err)
      } else {
        onClose()
      }
    } else {
      const err = await signUp(email, password)
      if (err) {
        setError(err)
      } else {
        setSuccessMsg('Check your email to confirm your account, then sign in.')
        setMode('login')
      }
    }

    setBusy(false)
  }

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={e => e.stopPropagation()}>
        <button className="auth-modal__close btn btn-ghost" onClick={onClose} aria-label="Close">✕</button>

        <h2 className="auth-modal__title">
          {mode === 'login' ? 'Sign in' : 'Create account'}
        </h2>
        <p className="auth-modal__subtitle">
          {mode === 'login'
            ? 'Your work is saved across sessions.'
            : 'Sign up to save your work across sessions.'}
        </p>

        <form className="auth-modal__form" onSubmit={handleSubmit}>
          <label className="auth-modal__label">
            Email
            <input
              className="auth-modal__input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
            />
          </label>

          <label className="auth-modal__label">
            Password
            <input
              className="auth-modal__input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
            />
          </label>

          {error && <p className="auth-modal__error">{error}</p>}
          {successMsg && <p className="auth-modal__success">{successMsg}</p>}

          <button className="btn auth-modal__submit" type="submit" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="auth-modal__switch">
          {mode === 'login' ? (
            <>No account? <button className="auth-modal__link" onClick={() => { setMode('register'); setError(null) }}>Create one</button></>
          ) : (
            <>Already have an account? <button className="auth-modal__link" onClick={() => { setMode('login'); setError(null) }}>Sign in</button></>
          )}
        </p>
      </div>
    </div>
  )
}
