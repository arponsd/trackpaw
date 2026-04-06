export interface DashboardTheme {
  mode: 'light' | 'dark';
  colors: {
    accent: string;
    accentLight: string;
    background: string;
    surface: string;
    border: string;
    text: string;
    textSecondary: string;
    success: string;
    danger: string;
    warning: string;
  };
  chart: { palette: string[] };
  borderRadius: string;
  fontFamily: string;
}

const CHART_PALETTES = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#06b6d4',
];

export function buildTheme(opts: {
  mode: 'light' | 'dark';
  accentColor: string;
  borderRadius: string;
  fontFamily: string;
}): DashboardTheme {
  const isDark = opts.mode === 'dark';

  return {
    mode: opts.mode,
    colors: {
      accent: opts.accentColor,
      accentLight: isDark ? adjustAlpha(opts.accentColor, 0.2) : adjustAlpha(opts.accentColor, 0.1),
      background: isDark ? '#0f172a' : '#f8fafc',
      surface: isDark ? '#1e293b' : '#ffffff',
      border: isDark ? '#334155' : '#e2e8f0',
      text: isDark ? '#f1f5f9' : '#0f172a',
      textSecondary: isDark ? '#94a3b8' : '#64748b',
      success: '#22c55e',
      danger: '#ef4444',
      warning: '#f59e0b',
    },
    chart: {
      palette: [opts.accentColor, ...CHART_PALETTES.filter((c) => c !== opts.accentColor)].slice(0, 8),
    },
    borderRadius: opts.borderRadius,
    fontFamily: opts.fontFamily,
  };
}

function adjustAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return hex.length === 7 ? hex + a : hex;
}

export function themeToCSS(theme: DashboardTheme): Record<string, string> {
  return {
    '--tp-accent': theme.colors.accent,
    '--tp-accent-light': theme.colors.accentLight,
    '--tp-bg': theme.colors.background,
    '--tp-surface': theme.colors.surface,
    '--tp-border': theme.colors.border,
    '--tp-text': theme.colors.text,
    '--tp-text-secondary': theme.colors.textSecondary,
    '--tp-success': theme.colors.success,
    '--tp-danger': theme.colors.danger,
    '--tp-warning': theme.colors.warning,
    '--tp-radius': theme.borderRadius,
    '--tp-font': theme.fontFamily,
  };
}
