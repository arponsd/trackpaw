import React from 'react';

const INTERVALS = ['hour', 'day', 'week', 'month'] as const;
export type Interval = (typeof INTERVALS)[number];

export interface IntervalPickerProps {
  value: Interval;
  onChange: (interval: Interval) => void;
}

export function IntervalPicker({ value, onChange }: IntervalPickerProps) {
  return (
    <div style={{ display: 'flex', gap: 2, background: 'var(--tp-bg, #f8fafc)', borderRadius: 'var(--tp-radius, 8px)', padding: 2 }}>
      {INTERVALS.map((i) => (
        <button
          key={i}
          onClick={() => onChange(i)}
          style={{
            padding: '5px 12px', border: 'none', borderRadius: 'var(--tp-radius, 8px)',
            cursor: 'pointer', fontSize: 13, textTransform: 'capitalize',
            background: value === i ? 'var(--tp-surface, #fff)' : 'transparent',
            color: value === i ? 'var(--tp-accent, #6366f1)' : 'var(--tp-text-secondary, #64748b)',
            fontWeight: value === i ? 600 : 400,
            boxShadow: value === i ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
          }}
        >
          {i}
        </button>
      ))}
    </div>
  );
}
