import React from 'react';

export function EmptyState({ message = 'No data available', icon }: { message?: string; icon?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', color: 'var(--tp-text-secondary, #64748b)' }}>
      {icon || <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8"/></svg>}
      <p style={{ marginTop: 12, fontSize: 14 }}>{message}</p>
    </div>
  );
}
