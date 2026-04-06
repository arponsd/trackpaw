/** Format a number for display: 1234 → "1.2K", 1234567 → "1.2M" */
export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/** Format a percentage: 0.4567 → "45.7%", or pass raw percent 45.67 → "45.7%" */
export function formatPercent(value: number, isDecimal = false): string {
  const pct = isDecimal ? value * 100 : value;
  return `${pct.toFixed(1)}%`;
}

/** Format a date string for display */
export function formatDate(isoString: string, format: 'short' | 'long' = 'short'): string {
  const d = new Date(isoString);
  if (format === 'long') {
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Format a duration in seconds: 120 → "2m 0s", 3661 → "1h 1m" */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

/** Format a relative time: "2 hours ago", "3 days ago" */
export function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
