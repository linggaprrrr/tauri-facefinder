import { Component } from 'react';

// Kiosk safety net: if any screen throws during render, show a calm recovery
// screen instead of a white screen, and auto-reload after a few seconds so an
// unattended kiosk heals itself. Reload (not redirect) preserves the URL —
// important for the mobile web flow where the outlet lives in ?outlet_id=.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
    this._timer = null;
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Kiosk render crash:', error, info);
  }

  componentDidUpdate(_prevProps, prevState) {
    if (this.state.hasError && !prevState.hasError) {
      this._timer = setTimeout(() => window.location.reload(), 8000);
    }
  }

  componentWillUnmount() {
    clearTimeout(this._timer);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div
        style={{
          position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center',
          background: 'var(--color-primary-50)',
        }}
      >
        <div style={{ fontSize: 48 }}>🙏</div>
        <h1 style={{ fontWeight: 800, fontSize: 22, color: 'var(--color-neutral-900)' }}>
          Mohon maaf, terjadi gangguan
        </h1>
        <p style={{ color: 'var(--color-neutral-600)', maxWidth: 360 }}>
          Aplikasi akan dimulai ulang otomatis. / The app will restart automatically.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: 8, padding: '12px 28px', borderRadius: 12, border: 'none', cursor: 'pointer',
            fontWeight: 700, fontSize: 16, color: '#fff', background: 'var(--color-primary)',
          }}
        >
          Mulai Ulang / Restart
        </button>
      </div>
    );
  }
}
