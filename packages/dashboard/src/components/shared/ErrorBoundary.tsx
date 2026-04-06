import React, { Component } from 'react';

interface Props { children: React.ReactNode; fallback?: React.ReactNode; }
interface State { hasError: boolean; error?: Error; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div style={{ padding: 24, color: 'var(--tp-danger, #ef4444)', background: 'var(--tp-surface, #fff)', borderRadius: 'var(--tp-radius, 8px)', border: '1px solid var(--tp-border, #e2e8f0)' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Something went wrong</h3>
          <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>{this.state.error?.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
