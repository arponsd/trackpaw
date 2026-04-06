import React from 'react';
import { ResponsiveContainer, LineChart as RechartsLine, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { getChartColor } from '../../utils/colors';
import { formatNumber } from '../../utils/formatters';
import type { TrendsSeries } from '@trackpaw/types';

export interface LineChartProps {
  series: TrendsSeries[];
  height?: number;
  palette?: string[];
}

export function LineChart({ series, height = 320, palette }: LineChartProps) {
  if (!series.length || !series[0]?.data.length) return null;

  // Merge all series into a unified data set keyed by date
  const dateSet = new Map<string, Record<string, any>>();
  for (const s of series) {
    const key = s.groupValue ? `${s.event} (${s.groupValue})` : s.event;
    for (const point of s.data) {
      if (!dateSet.has(point.date)) dateSet.set(point.date, { date: point.date });
      dateSet.get(point.date)![key] = point.value;
    }
  }
  const data = Array.from(dateSet.values()).sort((a, b) => a.date.localeCompare(b.date));
  const keys = series.map((s) => s.groupValue ? `${s.event} (${s.groupValue})` : s.event);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsLine data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--tp-border, #e2e8f0)" />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="var(--tp-text-secondary, #94a3b8)" />
        <YAxis tick={{ fontSize: 12 }} stroke="var(--tp-text-secondary, #94a3b8)" tickFormatter={formatNumber} />
        <Tooltip formatter={(v: number) => formatNumber(v)} />
        {keys.length > 1 && <Legend />}
        {keys.map((key, i) => (
          <Line key={key} type="monotone" dataKey={key} stroke={getChartColor(i, palette)} strokeWidth={2} dot={false} />
        ))}
      </RechartsLine>
    </ResponsiveContainer>
  );
}
