import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '2rem',
          textAlign: 'center',
          color: 'var(--text)'
        }}>
          <div style={{ fontSize: '3rem' }}>💥</div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Something went wrong</h2>
          <p style={{ color: 'var(--text-muted)', maxWidth: 400, fontSize: '0.9rem' }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '0.6rem 1.5rem',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
