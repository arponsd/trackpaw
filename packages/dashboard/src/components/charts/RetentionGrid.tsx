import React from 'react';
import { formatPercent, formatDate, formatNumber } from '../../utils/formatters';
import { retentionColor } from '../../utils/colors';
import type { RetentionCohort } from '@trackpaw/types';

export interface RetentionGridProps {
  cohorts: RetentionCohort[];
  mode?: 'light' | 'dark';
}

export function RetentionGrid({ cohorts, mode = 'light' }: RetentionGridProps) {
  if (!cohorts.length) return null;

  const maxPeriods = Math.max(...cohorts.map((c) => c.retention.length));

  return (
    <div style={{ overflow: 'auto', border: '1px solid var(--tp-border, #e2e8f0)', borderRadius: 'var(--tp-radius, 8px)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'var(--tp-bg, #f8fafc)' }}>
            <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--tp-text-secondary)' }}>Cohort</th>
            <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: 'var(--tp-text-secondary)' }}>Users</th>
            {Array.from({ length: maxPeriods }, (_, i) => (
              <th key={i} style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600, color: 'var(--tp-text-secondary)' }}>
                {i === 0 ? 'Day 0' : `+${i}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((cohort) => (
            <tr key={cohort.date} style={{ borderBottom: '1px solid var(--tp-border, #e2e8f0)' }}>
              <td style={{ padding: '8px 10px', fontWeight: 500, color: 'var(--tp-text)' }}>{formatDate(cohort.date)}</td>
              <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--tp-text-secondary)' }}>{formatNumber(cohort.cohortSize)}</td>
              {cohort.retention.map((r) => (
                <td
                  key={r.period}
                  style={{
                    padding: '8px 10px', textAlign: 'center', fontWeight: 500,
                    background: retentionColor(r.percentage, mode),
                    color: r.percentage > 50 ? '#fff' : 'var(--tp-text)',
                  }}
                >
                  {formatPercent(r.percentage)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
