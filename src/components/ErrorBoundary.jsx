import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', background: '#0e1118', color: '#e2e8f0',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '2rem', fontFamily: 'sans-serif',
          textAlign: 'center'
        }}>
          <div style={{
            background: '#1a202c', border: '1px solid #f87171',
            borderRadius: '16px', padding: '2.5rem 2rem', maxWidth: '500px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
          }}>
            <span style={{ fontSize: '3rem' }}>⚠️</span>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '1rem', color: '#f87171' }}>System Exception</h1>
            <p style={{ fontSize: '0.9rem', color: '#a0aec0', marginTop: '0.5rem' }}>
              The console operator dashboard encountered a rendering crash.
            </p>
            <div style={{
              background: '#0b0d12', border: '1px solid #2d3748',
              borderRadius: '8px', padding: '1rem', marginTop: '1.5rem',
              textAlign: 'left', overflowX: 'auto', fontFamily: 'monospace',
              fontSize: '0.8rem', color: '#f87171', whiteSpace: 'pre-wrap'
            }}>
              {this.state.error?.stack || this.state.error?.toString() || 'Unknown Error'}
            </div>
            <button onClick={() => { localStorage.clear(); window.location.href = '/' }} 
              style={{
                marginTop: '1.75rem', width: '100%', padding: '0.65rem 1.25rem',
                background: 'linear-gradient(180deg, #ef4444 0%, #dc2626 100%)',
                color: '#ffffff', border: 'none', borderRadius: '8px', cursor: 'pointer',
                fontWeight: 700, boxShadow: '0 4px 6px rgba(0,0,0,0.2)'
              }}>
              Reset Terminal Session & Retry
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
