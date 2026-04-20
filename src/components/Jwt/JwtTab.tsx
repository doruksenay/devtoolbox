import { useMemo } from 'react'
import { useApp } from '../../context/AppContext'

// ── JWT decoding helpers ─────────────────────────────────────────────────────

function b64urlDecode(s: string): string {
  // Pad
  const padded = s + '==='.slice((s.length + 3) % 4)
  // Replace url-safe chars
  const b64 = padded.replace(/-/g, '+').replace(/_/g, '/')
  try {
    return decodeURIComponent(
      atob(b64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
  } catch {
    return atob(b64)
  }
}

interface DecodedJwt {
  header: Record<string, unknown>
  payload: Record<string, unknown>
  signature: string
}

function decodeJwt(token: string): { decoded: DecodedJwt; error: null } | { decoded: null; error: string } {
  const parts = token.trim().split('.')
  if (parts.length !== 3) {
    return { decoded: null, error: 'A JWT must have exactly 3 dot-separated parts (header.payload.signature)' }
  }
  try {
    const header  = JSON.parse(b64urlDecode(parts[0])) as Record<string, unknown>
    const payload = JSON.parse(b64urlDecode(parts[1])) as Record<string, unknown>
    return { decoded: { header, payload, signature: parts[2] }, error: null }
  } catch (e) {
    return { decoded: null, error: `Decode failed: ${(e as Error).message}` }
  }
}

// ── Claim rendering helpers ──────────────────────────────────────────────────

const TIMESTAMP_CLAIMS = new Set(['exp', 'iat', 'nbf', 'auth_time', 'updated_at'])

const CLAIM_DESCRIPTIONS: Record<string, string> = {
  iss: 'Issuer',
  sub: 'Subject',
  aud: 'Audience',
  exp: 'Expires At',
  iat: 'Issued At',
  nbf: 'Not Before',
  jti: 'JWT ID',
  name: 'Name',
  email: 'Email',
  given_name: 'Given Name',
  family_name: 'Family Name',
  scope: 'Scope',
  roles: 'Roles',
  azp: 'Authorized Party',
}

function fmtTimestamp(v: unknown): string | null {
  if (typeof v !== 'number') return null
  const d = new Date(v * 1000)
  if (isNaN(d.getTime())) return null
  return d.toLocaleString()
}

function renderClaimValue(key: string, val: unknown): React.ReactNode {
  if (TIMESTAMP_CLAIMS.has(key) && typeof val === 'number') {
    const ts = fmtTimestamp(val)
    return ts ? (
      <span>
        <span className="jwt-tab__claim-val">{val}</span>
        <span className="jwt-tab__claim-sub">{ts}</span>
      </span>
    ) : String(val)
  }
  if (typeof val === 'object') return <code className="jwt-tab__claim-val">{JSON.stringify(val)}</code>
  return <span className="jwt-tab__claim-val">{String(val)}</span>
}

// ── Expiry status ────────────────────────────────────────────────────────────

type ExpiryStatus = 'valid' | 'expired' | 'no-expiry'

function getExpiryStatus(payload: Record<string, unknown>): ExpiryStatus {
  if (!('exp' in payload)) return 'no-expiry'
  const exp = payload['exp']
  if (typeof exp !== 'number') return 'no-expiry'
  return Date.now() / 1000 < exp ? 'valid' : 'expired'
}

function expiryLabel(status: ExpiryStatus): string {
  return { valid: '✓ Valid (not expired)', expired: '✕ Expired', 'no-expiry': '— No expiry claim' }[status]
}

// ── Component ────────────────────────────────────────────────────────────────

export function JwtTab() {
  const { state, dispatch } = useApp()
  const token = state.jwtInput.trim()

  const result = useMemo(() => (token ? decodeJwt(token) : null), [token])

  const expiryStatus: ExpiryStatus | null = useMemo(
    () => (result?.decoded ? getExpiryStatus(result.decoded.payload) : null),
    [result]
  )

  return (
    <div className="jwt-tab">
      <div className="jwt-tab__input-section">
        <div className="jwt-tab__label">Paste your JWT token</div>
        <textarea
          className="jwt-tab__textarea"
          placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature"
          value={state.jwtInput}
          onChange={e => dispatch({ type: 'SET_JWT_INPUT', input: e.target.value })}
          spellCheck={false}
          rows={4}
        />
        {state.jwtInput && (
          <button className="btn btn--sm jwt-tab__clear" onClick={() => dispatch({ type: 'CLEAR_JWT' })}>
            Clear
          </button>
        )}
      </div>

      {result?.error && (
        <div className="jwt-tab__error">⚠ {result.error}</div>
      )}

      {result?.decoded && expiryStatus && (
        <div className="jwt-tab__results">
          {/* Status banner */}
          <div className={`jwt-tab__status jwt-tab__status--${expiryStatus}`}>
            {expiryLabel(expiryStatus)}
          </div>

          <div className="jwt-tab__panels">
            {/* Header */}
            <div className="jwt-tab__panel">
              <div className="jwt-tab__panel-title">Header</div>
              <div className="jwt-tab__claims">
                {Object.entries(result.decoded.header).map(([k, v]) => (
                  <div key={k} className="jwt-tab__claim">
                    <span className="jwt-tab__claim-key" title={CLAIM_DESCRIPTIONS[k]}>
                      {k}
                      {CLAIM_DESCRIPTIONS[k] && (
                        <span className="jwt-tab__claim-desc"> · {CLAIM_DESCRIPTIONS[k]}</span>
                      )}
                    </span>
                    {renderClaimValue(k, v)}
                  </div>
                ))}
              </div>
              <pre className="jwt-tab__json">{JSON.stringify(result.decoded.header, null, 2)}</pre>
            </div>

            {/* Payload */}
            <div className="jwt-tab__panel">
              <div className="jwt-tab__panel-title">Payload</div>
              <div className="jwt-tab__claims">
                {Object.entries(result.decoded.payload).map(([k, v]) => (
                  <div key={k} className="jwt-tab__claim">
                    <span className="jwt-tab__claim-key" title={CLAIM_DESCRIPTIONS[k]}>
                      {k}
                      {CLAIM_DESCRIPTIONS[k] && (
                        <span className="jwt-tab__claim-desc"> · {CLAIM_DESCRIPTIONS[k]}</span>
                      )}
                    </span>
                    {renderClaimValue(k, v)}
                  </div>
                ))}
              </div>
              <pre className="jwt-tab__json">{JSON.stringify(result.decoded.payload, null, 2)}</pre>
            </div>

            {/* Signature */}
            <div className="jwt-tab__panel">
              <div className="jwt-tab__panel-title">Signature</div>
              <div className="jwt-tab__sig-note">
                ℹ Cryptographic signature verification requires the secret key and runs server-side.
                This tool only decodes the token — it does not verify the signature.
              </div>
              <code className="jwt-tab__sig-raw">{result.decoded.signature}</code>
            </div>
          </div>
        </div>
      )}

      {!token && (
        <div className="jwt-tab__empty">
          <p>Paste a JWT above to decode its header and payload claims.</p>
          <p className="jwt-tab__note">Everything runs in your browser — your token is never sent anywhere.</p>
          <details className="jwt-tab__sample-wrap">
            <summary>Load a sample token</summary>
            <button
              className="btn btn--sm"
              style={{ marginTop: 8 }}
              onClick={() => dispatch({
                type: 'SET_JWT_INPUT',
                input: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjk5OTk5OTk5OTl9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
              })}
            >
              Insert sample JWT
            </button>
          </details>
        </div>
      )}
    </div>
  )
}
