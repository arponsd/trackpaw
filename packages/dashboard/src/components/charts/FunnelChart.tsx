import React from 'react';
import { formatNumber, formatPercent, formatDuration } from '../../utils/formatters';
import { getChartColor } from '../../utils/colors';
import type { FunnelStepResult } from '@trackpaw/types';

export interface FunnelChartProps {
  steps: FunnelStepResult[];
}

export function FunnelChart({ steps }: FunnelChartProps) {
  if (!steps.length) return null;
  const maxCount = steps[0]!.count;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {steps.map((step, i) => {
        const widthPct = maxCount > 0 ? (step.count / maxCount) * 100 : 0;
        return (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
              <span style={{ fontWeight: 600, color: 'var(--tp-text, #0f172a)' }}>{step.event}</span>
              <span style={{ color: 'var(--tp-text-secondary, #64748b)' }}>
                {formatNumber(step.count)} ({formatPercent(step.overallRate)})
              </span>
            </div>
            <div style={{ background: 'var(--tp-bg, #f8fafc)', borderRadius: 4, height: 32, overflow: 'hidden' }}>
              <div style={{ width: `${widthPct}%`, height: '100%', background: getChartColor(i), borderRadius: 4, transition: 'width 0.3s ease' }} />
            </div>
            {i > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2, fontSize: 11, color: 'var(--tp-text-secondary, #94a3b8)' }}>
                <span>{formatPercent(step.conversionRate)} conversion</span>
                {step.medianTimeBetween !== undefined && <span>Median: {formatDuration(step.medianTimeBetween)}</span>}
                <span>{formatNumber(step.dropoff)} dropped</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
