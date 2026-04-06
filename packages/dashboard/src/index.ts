// Root dashboard
export { AnalyticsDashboard, type AnalyticsDashboardProps, type DashboardFeatures } from './Dashboard';

// Provider (for custom compositions)
export { AnalyticsProvider, useAnalytics, type AnalyticsProviderProps } from './context/AnalyticsProvider';
export { DateRangeProvider, useDateRange } from './context/DateRangeContext';
export { ThemeProvider, useTheme, type ThemeProviderProps } from './context/ThemeContext';

// API
export { AnalyticsAPIClient } from './api/client';
export {
  useTrendsQuery, useFunnelQuery, useRetentionQuery,
  useEventStream, useUserList, useUserProfile, useMetadata, useEventProperties,
} from './api/hooks';

// Views (for custom compositions)
export { OverviewView } from './views/OverviewView';
export { TrendsView } from './views/TrendsView';
export { FunnelView } from './views/FunnelView';
export { RetentionView } from './views/RetentionView';
export { EventStreamView } from './views/EventStreamView';
export { UserListView } from './views/UserListView';
export { UserProfileView } from './views/UserProfileView';

// Chart components
export { LineChart } from './components/charts/LineChart';
export { BarChart } from './components/charts/BarChart';
export { FunnelChart } from './components/charts/FunnelChart';
export { RetentionGrid } from './components/charts/RetentionGrid';

// Shared components
export { MetricCard } from './components/shared/MetricCard';
export { LoadingSpinner } from './components/shared/LoadingSpinner';
export { EmptyState } from './components/shared/EmptyState';
export { ErrorBoundary } from './components/shared/ErrorBoundary';
export { DataTable } from './components/data/DataTable';
export { Pagination } from './components/data/Pagination';

// Filter components
export { DateRangePicker } from './components/filters/DateRangePicker';
export { IntervalPicker } from './components/filters/IntervalPicker';

// Layout
export { Sidebar } from './components/layout/Sidebar';
export { Header } from './components/layout/Header';
export { PageShell } from './components/layout/PageShell';

// Hooks
export { useAutoRefresh } from './hooks/useAutoRefresh';
export { useExport } from './hooks/useExport';

// Utils
export { formatNumber, formatPercent, formatDate, formatDuration, formatRelativeTime } from './utils/formatters';
export { getChartColor, retentionColor } from './utils/colors';
export { buildTheme, themeToCSS, type DashboardTheme } from './utils/theme';
