import React, { createContext, useContext, useMemo, useEffect, useState } from 'react';
import { buildTheme, type DashboardTheme } from '../utils/theme';

interface ThemeContextValue {
  theme: DashboardTheme;
  mode: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  mode?: 'light' | 'dark' | 'system';
  accentColor?: string;
  borderRadius?: string;
  fontFamily?: string;
  children: React.ReactNode;
}

export function ThemeProvider({
  mode: modeProp = 'light',
  accentColor = '#6366f1',
  borderRadius = '8px',
  fontFamily = "Inter, system-ui, -apple-system, sans-serif",
  children,
}: ThemeProviderProps) {
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    if (modeProp !== 'system') return;
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    setSystemDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [modeProp]);

  const resolvedMode = modeProp === 'system' ? (systemDark ? 'dark' : 'light') : modeProp;

  const theme = useMemo(
    () => buildTheme({ mode: resolvedMode, accentColor, borderRadius, fontFamily }),
    [resolvedMode, accentColor, borderRadius, fontFamily],
  );

  return (
    <ThemeContext.Provider value={{ theme, mode: resolvedMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>');
  return ctx;
}
