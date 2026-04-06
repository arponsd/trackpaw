# Dashboard Package Specification

## Overview

`@trackpaw/dashboard` is a pre-built React analytics UI that customers embed in their admin panels. It communicates with the server package's REST API to display interactive analytics.

**Design Goals:**
- Single React component to mount a full analytics dashboard
- Themeable (light/dark, custom colors, branding)
- Responsive (desktop + tablet)
- All visualization built with Recharts (lightweight, React-native)
- Zero analytics logic in the frontend — all queries go through the server API

## Package Structure

```
packages/dashboard/
├── src/
│   ├── index.ts                      # Public exports
│   ├── Dashboard.tsx                 # Root dashboard component
│   ├── context/
│   │   ├── AnalyticsProvider.tsx      # API client context
│   │   ├── DateRangeContext.tsx       # Global date range state
│   │   └── ThemeContext.tsx           # Theme configuration
│   ├── api/
│   │   ├── client.ts                 # HTTP client for server API
│   │   ├── hooks.ts                  # React Query hooks for all endpoints
│   │   └── types.ts                  # API request/response types
│   ├── views/
│   │   ├── OverviewView.tsx          # Dashboard home — key metrics
│   │   ├── TrendsView.tsx            # Trend analysis builder
│   │   ├── FunnelView.tsx            # Funnel builder + visualization
│   │   ├── RetentionView.tsx         # Retention cohort grid
│   │   ├── EventStreamView.tsx       # Live event feed
│   │   ├── UserListView.tsx          # User list with search
│   │   ├── UserProfileView.tsx       # Individual user detail
│   │   └── SettingsView.tsx          # Event definitions, data management
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx           # Navigation sidebar
│   │   │   ├── Header.tsx            # Top bar with date picker
│   │   │   └── PageShell.tsx         # Page layout wrapper
│   │   ├── charts/
│   │   │   ├── LineChart.tsx          # Time-series line chart
│   │   │   ├── BarChart.tsx           # Grouped/stacked bar chart
│   │   │   ├── FunnelChart.tsx        # Funnel visualization
│   │   │   ├── RetentionGrid.tsx      # Heatmap retention table
│   │   │   ├── MetricCard.tsx         # Single KPI card
│   │   │   └── PieChart.tsx           # Breakdown pie/donut chart
│   │   ├── filters/
│   │   │   ├── DateRangePicker.tsx    # Date range selector
│   │   │   ├── EventPicker.tsx        # Event name autocomplete
│   │   │   ├── PropertyFilter.tsx     # Property filter builder
│   │   │   ├── IntervalPicker.tsx     # Hour/day/week/month toggle
│   │   │   └── GroupByPicker.tsx      # Group-by property selector
│   │   ├── data/
│   │   │   ├── DataTable.tsx          # Sortable data table
│   │   │   ├── EventRow.tsx           # Single event in stream
│   │   │   ├── UserRow.tsx            # Single user in list
│   │   │   └── Pagination.tsx         # Pagination controls
│   │   └── shared/
│   │       ├── LoadingSpinner.tsx
│   │       ├── EmptyState.tsx
│   │       ├── ErrorBoundary.tsx
│   │       └── Tooltip.tsx
│   ├── hooks/
│   │   ├── useQueryBuilder.ts         # Manage query state for trends/funnels
│   │   ├── useAutoRefresh.ts          # Polling interval for live data
│   │   └── useExport.ts              # CSV/JSON export
│   ├── utils/
│   │   ├── formatters.ts             # Number, date, duration formatting
│   │   ├── colors.ts                 # Chart color palette
│   │   └── constants.ts              # Default intervals, limits
│   └── styles/
│       ├── theme.ts                  # Theme tokens (colors, spacing, fonts)
│       └── globals.css               # Base styles (Tailwind)
├── tsconfig.json
├── package.json
└── README.md
```

## Public API

### AnalyticsDashboard Component

The single component customers render:

```tsx
import { AnalyticsDashboard } from '@trackpaw/dashboard';

function AdminPage() {
  return (
    <AnalyticsDashboard
      // Required
      endpoint="https://myapp.com/analytics"
      apiKey="read-api-key"

      // Optional: Theme
      theme="light"                    // 'light' | 'dark' | 'system'
      accentColor="#6366f1"            // Primary brand color
      borderRadius="8px"              // Card border radius
      fontFamily="Inter, sans-serif"

      // Optional: Features to enable/disable
      features={{
        trends: true,                  // default: true
        funnels: true,                 // default: true
        retention: true,              // default: true
        eventStream: true,            // default: true
        userProfiles: true,           // default: true
        settings: false,              // default: false (admin only)
      }}

      // Optional: Default date range
      defaultDateRange="30d"          // '24h' | '7d' | '14d' | '30d' | '90d'

      // Optional: Refresh interval
      autoRefreshInterval={60000}     // ms (0 = disabled)

      // Optional: Custom navigation
      basePath="/admin/analytics"     // URL prefix for routing

      // Optional: Embed mode (no sidebar, minimal chrome)
      embedded={false}

      // Optional: Callbacks
      onError={(error) => console.error(error)}
      onNavigate={(path) => router.push(path)}

      // Optional: Custom header content
      headerExtra={<MyCustomButton />}

      // Optional: Locale
      locale="en-US"
      timezone="America/New_York"
    />
  );
}
```

### Individual View Components

For customers who want to embed specific views rather than the full dashboard:

```tsx
import {
  TrendsChart,
  FunnelChart,
  RetentionGrid,
  EventStream,
  UserList,
  AnalyticsProvider,
} from '@trackpaw/dashboard';

function CustomDashboard() {
  return (
    <AnalyticsProvider endpoint="/analytics" apiKey="read-key">
      <div className="grid grid-cols-2 gap-4">
        <TrendsChart
          events={[{ name: 'Sign Up' }, { name: 'Purchase' }]}
          interval="day"
          dateRange="30d"
        />
        <FunnelChart
          steps={[
            { event: 'Page View' },
            { event: 'Sign Up' },
            { event: 'Purchase' },
          ]}
          dateRange="7d"
        />
        <RetentionGrid
          startEvent="Sign Up"
          returnEvent="Login"
          interval="week"
          periods={8}
        />
      </div>
    </AnalyticsProvider>
  );
}
```

## View Specifications

### Overview View

The landing page showing key metrics at a glance.

**Components:**
- 4 MetricCards: Total Events (24h), Active Users (24h), New Users (7d), Avg Events/User (7d)
- Line chart: Events over last 30 days
- Bar chart: Top 10 events by count
- Mini list: Recent events (last 5)

**API Calls:**
- `GET /v1/query` — trends for total events (30d, daily)
- `GET /v1/metadata` — event names and counts
- `GET /v1/events/stream?limit=5` — recent events

### Trends View

Interactive trend analysis builder.

**User Flow:**
1. Select one or more events (autocomplete from API)
2. Choose aggregation: Total, Unique Users, Unique Sessions
3. Choose interval: Hour, Day, Week, Month
4. Optionally add property filters
5. Optionally add group-by (breaks chart into multiple series)
6. Choose date range

**Components:**
- EventPicker (multi-select with autocomplete)
- IntervalPicker (segmented control)
- DateRangePicker (preset buttons + custom range)
- PropertyFilter (add/remove filter rows)
- GroupByPicker (single select)
- LineChart or BarChart (toggle)
- DataTable below chart (raw numbers)

### Funnel View

Conversion funnel builder.

**User Flow:**
1. Add 2–10 funnel steps (each is an event + optional filters)
2. Set conversion window (1h, 1d, 7d, 30d, custom)
3. Choose date range
4. Optionally group by a property

**Visualization:**
- Horizontal funnel bars showing count + conversion % at each step
- Drop-off indicators between steps
- Median time between steps
- Grouped breakdown table (if group-by is set)

### Retention View

Cohort retention grid (triangle heatmap).

**User Flow:**
1. Select start event (e.g., "Sign Up")
2. Select return event (e.g., "Login")
3. Choose interval (Day, Week, Month)
4. Choose number of periods (4–12)
5. Choose date range

**Visualization:**
- Rows = cohorts (by start date)
- Columns = periods (0, 1, 2, ... N)
- Cells = retention percentage with color intensity
- Cohort size shown in first column

### Event Stream View

Real-time feed of raw events.

**Features:**
- Auto-refreshing list (every 5s or manual)
- Filter by event name, user ID, session ID
- Expandable rows showing full properties JSON
- Pagination (50 events per page)
- Click user ID to navigate to user profile

### User List View

Searchable, sortable list of identified users.

**Features:**
- Search by user ID, email, name (from traits)
- Sort by: last seen, first seen, total events, total sessions
- Click to open User Profile View
- Export to CSV

### User Profile View

Detailed view of a single user.

**Sections:**
- Profile header: user ID, traits, first/last seen, total events
- Activity timeline: chronological list of all events
- Session breakdown: list of sessions with duration, event count, pages
- Segments: which segments this user belongs to

## API Client

The dashboard communicates with the server via a typed HTTP client:

```typescript
class AnalyticsAPIClient {
  constructor(private endpoint: string, private apiKey: string) {}

  async queryTrends(query: TrendsQuery): Promise<TrendsResult>;
  async queryFunnel(query: FunnelQuery): Promise<FunnelResult>;
  async queryRetention(query: RetentionQuery): Promise<RetentionResult>;
  async getEventStream(filters?: EventStreamFilters): Promise<EventStreamResult>;
  async getUserList(options?: UserListOptions): Promise<UserListResult>;
  async getUserProfile(userId: string): Promise<UserProfile>;
  async getMetadata(): Promise<AnalyticsMetadata>;
  async healthCheck(): Promise<HealthStatus>;
}
```

All hooks use React Query (TanStack Query) for caching, refetching, and loading states:

```typescript
// Example hook
function useTrendsQuery(query: TrendsQuery) {
  return useQuery({
    queryKey: ['trends', query],
    queryFn: () => apiClient.queryTrends(query),
    staleTime: 30000,      // Cache for 30s
    refetchInterval: autoRefreshInterval,
  });
}
```

## Theming

The dashboard uses CSS custom properties for theming:

```typescript
interface DashboardTheme {
  mode: 'light' | 'dark';
  colors: {
    accent: string;           // Primary action color
    accentLight: string;      // Hover/background variant
    background: string;       // Page background
    surface: string;          // Card background
    border: string;           // Border color
    text: string;             // Primary text
    textSecondary: string;    // Secondary text
    success: string;          // Positive metrics
    danger: string;           // Negative metrics / errors
    warning: string;          // Alerts
  };
  chart: {
    palette: string[];        // 8-color palette for chart series
  };
  spacing: { xs, sm, md, lg, xl };
  borderRadius: string;
  fontFamily: string;
  fontSize: { sm, base, lg, xl, '2xl' };
}
```

## Peer Dependencies

```json
{
  "peerDependencies": {
    "react": ">=18.0.0",
    "react-dom": ">=18.0.0"
  },
  "dependencies": {
    "recharts": "^2.12.0",
    "@tanstack/react-query": "^5.0.0"
  }
}
```

## Build Output

- ESM bundle (tree-shakable)
- CJS bundle (for SSR / older setups)
- TypeScript declarations
- CSS file (Tailwind, can be imported separately)

## Testing Strategy

- **Component tests:** Vitest + React Testing Library for every view and component
- **Visual regression:** Storybook + Chromatic for UI consistency
- **Integration tests:** Mock API responses and verify correct query construction
- **Accessibility:** axe-core checks on all views (WCAG 2.1 AA)
