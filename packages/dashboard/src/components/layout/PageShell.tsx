import React from 'react';

export interface PageShellProps {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function PageShell({ title, actions, children }: PageShellProps) {
  return (
    <div style={{ padding: 24, flex: 1, overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--tp-text, #0f172a)' }}>{title}</h1>
        {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
      </div>
      {children}
    </div>
  );
}
