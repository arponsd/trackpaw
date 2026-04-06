# Trackpaw

> A drop-in, privacy-first analytics platform that runs entirely on your infrastructure. Zero data leaves your servers.

Trackpaw is an open-source analytics SDK (similar to Mixpanel/Amplitude) distributed as npm packages. Install it, point it at your own database, and get a full analytics suite — event tracking, funnels, retention, user profiles, and a pre-built dashboard.

## Packages

| Package | Description | Size |
|---------|-------------|------|
| [`@trackpaw/tracker`](./packages/tracker) | Client-side SDK for browser & Node.js | < 5KB gzipped |
| [`@trackpaw/server`](./packages/server) | Ingestion API, query engine, DB adapters | - |
| [`@trackpaw/dashboard`](./packages/dashboard) | Embeddable React analytics UI | - |

## Quick Start

### 1. Install

```bash
npm install @trackpaw/tracker @trackpaw/server @trackpaw/dashboard
```

### 2. Server Setup (Express)

```typescript
import express from 'express';
import { createAnalyticsServer, SQLiteAdapter } from '@trackpaw/server';

const app = express();

const analytics = createAnalyticsServer({
  adapter: new SQLiteAdapter({ filename: './analytics.db' }),
  apiKey: process.env.ANALYTICS_API_KEY,
});

await analytics.migrate();
app.use('/analytics', analytics.router);
app.listen(3000);
```

### 3. Client Setup (Browser)

```typescript
import { Trackpaw } from '@trackpaw/tracker';

const tracker = Trackpaw.init({
  endpoint: 'https://myapp.com/analytics',
  apiKey: 'your-write-key',
  autoTrack: { pageViews: true },
});

tracker.identify('user_123', { name: 'Alice', plan: 'pro' });
tracker.track('Feature Used', { feature: 'export' });
```

### 4. Dashboard

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

## Database Support

| Database | Adapter | Best For |
|----------|---------|----------|
| SQLite | `SQLiteAdapter` | Development, small projects |
| PostgreSQL | `PostgresAdapter` | Production (10K-1M events/day) |
| MySQL | `MySQLAdapter` | Teams already running MySQL |
| ClickHouse | `ClickHouseAdapter` | High volume (1M+ events/day) |

## Features

- **Event Tracking** — track custom events with properties
- **User Identification** — link anonymous and identified users
- **Trends** — event counts over time with group-by
- **Funnels** — multi-step conversion analysis
- **Retention** — cohort retention grids
- **User Profiles** — traits, activity timeline, session history
- **Privacy-First** — IP anonymization, PII scrubbing, consent mode, GDPR delete/export
- **Embeddable Dashboard** — one React component for a full analytics UI

## Core Principles

1. **Customer-owned data** — all data stays on your infrastructure
2. **Database-agnostic** — works with SQLite, Postgres, MySQL, ClickHouse
3. **Zero runtime dependencies** — the tracker SDK has no external deps
4. **Privacy-first defaults** — IP anonymization, consent mode, PII scrubbing
5. **TypeScript-native** — full type safety across all packages

## Examples

| Example | Description |
|---------|-------------|
| [`express-app`](./examples/express-app) | Express.js with tracker, server, and HTML demo pages |
| [`nextjs-app`](./examples/nextjs-app) | Next.js App Router with embedded dashboard |
| [`standalone`](./examples/standalone) | Zero-config server with SQLite and seed data |

## Tech Stack

- **Language:** TypeScript (strict mode)
- **Build:** Turborepo + tsup + Vitest
- **Tracker:** Vanilla TS, zero deps, ESM + CJS + UMD
- **Server:** Express with framework-agnostic core
- **Dashboard:** React 18+, Recharts, TanStack Query
- **Database:** Adapter pattern with 4 built-in adapters

## Development

```bash
pnpm install        # Install dependencies
pnpm build          # Build all packages
pnpm test           # Run all tests
pnpm typecheck      # Type-check all packages
pnpm lint           # Lint all packages
```

## License

MIT
