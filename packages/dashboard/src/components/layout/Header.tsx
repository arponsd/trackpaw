import React from 'react';
import { DateRangePicker } from '../filters/DateRangePicker';
import type { DateRange } from '@trackpaw/types';

export interface HeaderProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  onRefresh?: () => void;
  extra?: React.ReactNode;
}

export function Header({ dateRange, onDateRangeChange, onRefresh, extra }: HeaderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '1px solid var(--tp-border, #e2e8f0)', background: 'var(--tp-surface, #fff)' }}>
      <DateRangePicker value={dateRange} onChange={onDateRangeChange} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {extra}
        {onRefresh && (
          <button onClick={onRefresh} style={{ padding: '6px 12px', border: '1px solid var(--tp-border, #e2e8f0)', borderRadius: 'var(--tp-radius, 8px)', background: 'var(--tp-surface, #fff)', cursor: 'pointer', fontSize: 13, color: 'var(--tp-text, #0f172a)' }}>
            Refresh
          </button>
        )}
      </div>
    </div>
  );
}
