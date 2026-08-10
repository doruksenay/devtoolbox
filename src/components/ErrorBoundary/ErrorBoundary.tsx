import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

// Nothing used to catch render errors, so a single throw inside a tool pane
// blanked the entire app. Tool panes are also loaded with React.lazy — a chunk
// that fails to download (stale tab after a deploy, flaky connection) throws in
// exactly the same place — so the recovery screen covers both cases.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Tool crashed:', error, info.componentStack)
  }

  handleRetry = () => {
    this.setState({ error: null })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="empty-state">
        <div className="empty-state__icon">⚠</div>
        <div className="empty-state__title">This tool stopped working</div>
        <div>
          Nothing else is affected — pick another tool from the sidebar, or try this one again.
          If it keeps happening, reloading fetches a fresh copy of the app.
        </div>
        <div className="text-error text-xs mono" style={{ maxWidth: 520, wordBreak: 'break-word' }}>
          {error.message}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={this.handleRetry}>
            Try again
          </button>
          <button className="btn btn-secondary" onClick={this.handleReload}>
            Reload page
          </button>
        </div>
      </div>
    )
  }
}
