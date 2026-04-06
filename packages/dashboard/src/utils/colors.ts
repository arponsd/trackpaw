const DEFAULT_PALETTE = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#06b6d4',
];

export function getChartColor(index: number, palette: string[] = DEFAULT_PALETTE): string {
  return palette[index % palette.length] || DEFAULT_PALETTE[0]!;
}

/** Generate retention heatmap color from percentage (0-100) */
export function retentionColor(percentage: number, mode: 'light' | 'dark' = 'light'): string {
  const intensity = Math.min(percentage / 100, 1);
  if (mode === 'dark') {
    return `rgba(99, 102, 241, ${0.1 + intensity * 0.7})`;
  }
  return `rgba(99, 102, 241, ${0.05 + intensity * 0.6})`;
}
