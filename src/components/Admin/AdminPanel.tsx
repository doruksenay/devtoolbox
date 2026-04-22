import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import './AdminPanel.css'

interface LoginStats {
  daily: number
  monthly: number
}

interface Props {
  onClose: () => void
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function AdminPanel({ onClose }: Props) {
  const [stats, setStats] = useState<LoginStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError] = useState<string | null>(null)

  const buildTime = new Date(__BUILD_TIME__)

  useEffect(() => {
    supabase
      .rpc('get_login_stats')
      .then(({ data, error }) => {
        if (error) setStatsError(error.message)
        else setStats(data as LoginStats)
        setStatsLoading(false)
      })
  }, [])

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="admin-panel" onClick={e => e.stopPropagation()}>
        <button className="auth-modal__close btn btn-ghost" onClick={onClose} aria-label="Close">✕</button>

        <h2 className="auth-modal__title">Admin Panel</h2>
        <p className="auth-modal__subtitle">Usage stats and deployment info</p>

        <div className="admin-panel__grid">
          <div className="admin-panel__card">
            <div className="admin-panel__card-value">
              {statsLoading ? '…' : (stats?.daily ?? '—')}
            </div>
            <div className="admin-panel__card-label">Logins Today</div>
          </div>

          <div className="admin-panel__card">
            <div className="admin-panel__card-value">
              {statsLoading ? '…' : (stats?.monthly ?? '—')}
            </div>
            <div className="admin-panel__card-label">Logins This Month</div>
          </div>

          <div className="admin-panel__card admin-panel__card--wide">
            <div className="admin-panel__card-icon">🚀</div>
            <div className="admin-panel__card-value admin-panel__card-value--deploy">
              {formatTimeAgo(buildTime)}
            </div>
            <div className="admin-panel__card-label">
              Last deploy · {buildTime.toLocaleString()}
            </div>
          </div>
        </div>

        {statsError && <p className="auth-modal__error">{statsError}</p>}
      </div>
    </div>
  )
}
