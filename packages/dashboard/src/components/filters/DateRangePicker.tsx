import React from 'react';
import type { DateRange } from '@trackpaw/types';

const PRESETS = [
  { label: '24h', value: '24h' },
  { label: '7d', value: '7d' },
  { label: '14d', value: '14d' },
  { label: '30d', value: '30d' },
  { label: '90d', value: '90d' },
] as const;

export interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {PRESETS.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange({ preset: p.value })}
          style={{
            padding: '6px 12px', border: '1px solid var(--tp-border, #e2e8f0)',
            borderRadius: 'var(--tp-radius, 8px)', cursor: 'pointer', fontSize: 13,
            background: value.preset === p.value ? 'var(--tp-accent, #6366f1)' : 'var(--tp-surface, #fff)',
            color: value.preset === p.value ? '#fff' : 'var(--tp-text, #0f172a)',
            fontWeight: value.preset === p.value ? 600 : 400,
          }}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
