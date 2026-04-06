import { describe, it, expect } from 'vitest';
import { buildTheme, themeToCSS } from '../utils/theme';

describe('buildTheme', () => {
  it('builds a light theme', () => {
    const theme = buildTheme({
      mode: 'light',
      accentColor: '#6366f1',
      borderRadius: '8px',
      fontFamily: 'Inter',
    });

    expect(theme.mode).toBe('light');
    expect(theme.colors.accent).toBe('#6366f1');
    expect(theme.colors.background).toBe('#f8fafc');
    expect(theme.chart.palette.length).toBe(8);
    expect(theme.chart.palette[0]).toBe('#6366f1');
  });

  it('builds a dark theme', () => {
    const theme = buildTheme({
      mode: 'dark',
      accentColor: '#6366f1',
      borderRadius: '8px',
      fontFamily: 'Inter',
    });

    expect(theme.mode).toBe('dark');
    expect(theme.colors.background).toBe('#0f172a');
    expect(theme.colors.surface).toBe('#1e293b');
  });

  it('puts accentColor first in palette', () => {
    const theme = buildTheme({
      mode: 'light',
      accentColor: '#ff0000',
      borderRadius: '4px',
      fontFamily: 'Arial',
    });

    expect(theme.chart.palette[0]).toBe('#ff0000');
  });
});

describe('themeToCSS', () => {
  it('generates CSS custom properties', () => {
    const theme = buildTheme({ mode: 'light', accentColor: '#6366f1', borderRadius: '8px', fontFamily: 'Inter' });
    const css = themeToCSS(theme);

    expect(css['--tp-accent']).toBe('#6366f1');
    expect(css['--tp-bg']).toBe('#f8fafc');
    expect(css['--tp-radius']).toBe('8px');
    expect(css['--tp-font']).toBe('Inter');
  });
});
