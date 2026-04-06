import React from 'react';
import { formatNumber } from '../../utils/formatters';

export interface MetricCardProps {
  label: string;
  value: number;
  change?: number;
}

export function MetricCard({ label, value, change }: MetricCardProps) {
  return (
    <div style={{ padding: 20, background: 'var(--tp-surface, #fff)', borderRadius: 'var(--tp-radius, 8px)', border: '1px solid var(--tp-border, #e2e8f0)' }}>
      <div style={{ fontSize: 13, color: 'var(--tp-text-secondary, #64748b)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--tp-text, #0f172a)' }}>{formatNumber(value)}</div>
      {change !== undefined && (
        <div style={{ fontSize: 13, marginTop: 4, color: change >= 0 ? 'var(--tp-success, #22c55e)' : 'var(--tp-danger, #ef4444)' }}>
          {change >= 0 ? '+' : ''}{change.toFixed(1)}%
        </div>
      )}
    </div>
  );
}
