# @trackpaw/dashboard

Embeddable React analytics dashboard for Trackpaw. One component to mount a full analytics UI.

## Installation

```bash
npm install @trackpaw/dashboard
```

**Peer dependencies:** `react >= 18`, `react-dom >= 18`

## Quick Start

```tsx
import { AnalyticsDashboard } from '@trackpaw/dashboard';

function AdminPage() {
  return (
    <AnalyticsDashboard
      endpoint="https://myapp.com/analytics"
      apiKey="your-read-key"
      theme="light"
    />
  );
}
```

## Props

```typescript
interface AnalyticsDashboardProps {
  endpoint: string;              // Server URL
  apiKey: string;                // Read API key
  theme?: 'light' | 'dark' | 'system';
  accentColor?: string;          // Primary color (default: '#6366f1')
  borderRadius?: string;         // Card radius (default: '8px')
  fontFamily?: string;
  features?: {
    trends?: boolean;            // default: true
    funnels?: boolean;           // default: true
    retention?: boolean;         // default: true
    eventStream?: boolean;       // default: true
    userProfiles?: boolean;      // default: true
  };
  defaultDateRange?: '24h' | '7d' | '14d' | '30d' | '90d';
  embedded?: boolean;            // Hide sidebar (default: false)
  onError?: (error: Error) => void;
}
```

## Individual Components

For custom dashboard layouts, use individual views with `AnalyticsProvider`:

```tsx
import {
  AnalyticsProvider,
  TrendsView,
  FunnelView,
  RetentionView,
  LineChart,
  MetricCard,
} from '@trackpaw/dashboard';

function CustomDashboard() {
  return (
    <AnalyticsProvider endpoint="/analytics" apiKey="read-key">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <MetricCard label="Total Events" value={1234} />
        <MetricCard label="Active Users" value={567} />
      </div>
      <TrendsView />
    </AnalyticsProvider>
  );
}
```

## Available Views

| Component | Description |
|-----------|-------------|
| `OverviewView` | Key metrics, event trend chart, top events |
| `TrendsView` | Interactive trend analysis with event picker |
| `FunnelView` | Funnel builder with conversion visualization |
| `RetentionView` | Cohort retention heatmap grid |
| `EventStreamView` | Live event feed with auto-refresh |
| `UserListView` | Searchable user list with CSV export |
| `UserProfileView` | Individual user detail with activity timeline |

## Chart Components

| Component | Description |
|-----------|-------------|
| `LineChart` | Time-series line chart (Recharts) |
| `BarChart` | Horizontal bar chart |
| `FunnelChart` | Funnel bars with conversion % |
| `RetentionGrid` | Cohort retention heatmap table |
| `MetricCard` | Single KPI card with trend indicator |

## Theming

The dashboard supports light, dark, and system-auto themes with customizable accent color:

```tsx
<AnalyticsDashboard
  theme="dark"
  accentColor="#ec4899"
  borderRadius="12px"
  fontFamily="'JetBrains Mono', monospace"
/>
```
