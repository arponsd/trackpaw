import React from 'react';
import { ResponsiveContainer, BarChart as RechartsBar, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { getChartColor } from '../../utils/colors';
import { formatNumber } from '../../utils/formatters';

export interface BarChartProps {
  data: Array<{ name: string; value: number }>;
  height?: number;
  color?: string;
}

export function BarChart({ data, height = 320, color }: BarChartProps) {
  if (!data.length) return null;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBar data={data} layout="vertical" margin={{ left: 100 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--tp-border, #e2e8f0)" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={formatNumber} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={100} />
        <Tooltip formatter={(v: number) => formatNumber(v)} />
        <Bar dataKey="value" fill={color || getChartColor(0)} radius={[0, 4, 4, 0]} />
      </RechartsBar>
    </ResponsiveContainer>
  );
}
