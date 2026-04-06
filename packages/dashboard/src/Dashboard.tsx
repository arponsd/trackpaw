import React, { useState, useCallback } from 'react';
import { AnalyticsProvider } from './context/AnalyticsProvider';
import { DateRangeProvider, useDateRange } from './context/DateRangeContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { OverviewView } from './views/OverviewView';
import { TrendsView } from './views/TrendsView';
import { FunnelView } from './views/FunnelView';
import { RetentionView } from './views/RetentionView';
import { EventStreamView } from './views/EventStreamView';
import { UserListView } from './views/UserListView';
import { UserProfileView } from './views/UserProfileView';
import { themeToCSS } from './utils/theme';
import type { DateRange } from '@trackpaw/types';

export interface DashboardFeatures {
  trends?: boolean;
  funnels?: boolean;
  retention?: boolean;
  eventStream?: boolean;
  userProfiles?: boolean;
}

export interface AnalyticsDashboardProps {
  endpoint: string;
  apiKey: string;
  theme?: 'light' | 'dark' | 'system';
  accentColor?: string;
  borderRadius?: string;
  fontFamily?: string;
  features?: DashboardFeatures;
  defaultDateRange?: '24h' | '7d' | '14d' | '30d' | '90d';
  autoRefreshInterval?: number;
  embedded?: boolean;
  onError?: (error: Error) => void;
  onNavigate?: (path: string) => void;
  headerExtra?: React.ReactNode;
}

export function AnalyticsDashboard(props: AnalyticsDashboardProps) {
  const {
    endpoint, apiKey,
    theme: themeProp = 'light',
    accentColor, borderRadius, fontFamily,
    features, defaultDateRange = '30d',
    embedded = false,
    headerExtra,
  } = props;

  return (
    <ErrorBoundary>
      <AnalyticsProvider endpoint={endpoint} apiKey={apiKey}>
        <ThemeProvider mode={themeProp} accentColor={accentColor} borderRadius={borderRadius} fontFamily={fontFamily}>
          <DateRangeProvider defaultRange={{ preset: defaultDateRange }}>
            <DashboardInner features={features} embedded={embedded} headerExtra={headerExtra} />
          </DateRangeProvider>
        </ThemeProvider>
      </AnalyticsProvider>
    </ErrorBoundary>
  );
}

function DashboardInner({
  features = {},
  embedded,
  headerExtra,
}: {
  features?: DashboardFeatures;
  embedded?: boolean;
  headerExtra?: React.ReactNode;
}) {
  const { theme } = useTheme();
  const { dateRange, setDateRange } = useDateRange();
  const [activeView, setActiveView] = useState('overview');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const cssVars = themeToCSS(theme);

  const navItems = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    ...(features.trends !== false ? [{ id: 'trends', label: 'Trends', icon: '📈' }] : []),
    ...(features.funnels !== false ? [{ id: 'funnels', label: 'Funnels', icon: '🔽' }] : []),
    ...(features.retention !== false ? [{ id: 'retention', label: 'Retention', icon: '🔄' }] : []),
    ...(features.eventStream !== false ? [{ id: 'events', label: 'Events', icon: '⚡' }] : []),
    ...(features.userProfiles !== false ? [{ id: 'users', label: 'Users', icon: '👥' }] : []),
  ];

  const handleNavigate = useCallback((view: string) => {
    setActiveView(view);
    setSelectedUserId(null);
  }, []);

  const renderView = () => {
    if (selectedUserId) {
      return <UserProfileView userId={selectedUserId} onBack={() => setSelectedUserId(null)} />;
    }

    switch (activeView) {
      case 'overview': return <OverviewView />;
      case 'trends': return <TrendsView />;
      case 'funnels': return <FunnelView />;
      case 'retention': return <RetentionView />;
      case 'events': return <EventStreamView />;
      case 'users': return <UserListView onSelectUser={setSelectedUserId} />;
      default: return <OverviewView />;
    }
  };

  return (
    <div
      style={{
        ...cssVars as any,
        display: 'flex',
        height: '100%',
        fontFamily: theme.fontFamily,
        color: theme.colors.text,
        background: theme.colors.background,
        fontSize: 14,
      }}
    >
      {!embedded && (
        <Sidebar activeView={activeView} onNavigate={handleNavigate} items={navItems} />
      )}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Header dateRange={dateRange} onDateRangeChange={setDateRange} extra={headerExtra} />
        <div style={{ flex: 1, overflow: 'auto' }}>
          <ErrorBoundary>
            {renderView()}
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
