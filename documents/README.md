# Trackpaw — Self-Hosted Analytics SDK

> A drop-in, privacy-first analytics platform that runs entirely on the customer's infrastructure. Zero data leaves their servers.

## What Is This?

Trackpaw is an open-source analytics SDK (similar to Mixpanel/Amplitude) distributed as npm packages. Developers install it, point it at their own database, and get a full analytics suite — event tracking, funnels, retention, user profiles, and a pre-built dashboard — without sending a single byte to a third-party server.

## Monorepo Structure

```
trackpaw/
├── packages/
│   ├── tracker/          # Client-side SDK (~5KB gzip) — browser & Node.js
│   ├── server/           # Ingestion API + query engine + DB adapters
│   └── dashboard/        # Pre-built React analytics UI (embeddable)
├── examples/
│   ├── express-app/      # Example Express.js integration
│   ├── nextjs-app/       # Example Next.js integration
│   └── standalone/       # Standalone server + dashboard demo
├── docs/                 # Architecture, API reference, guides
├── scripts/              # Build, test, release tooling
├── turbo.json            # Turborepo config
├── package.json          # Root workspace config
└── tsconfig.base.json    # Shared TypeScript config
```

## Quick Start (Developer Experience)

### 1. Install

```bash
npm install @trackpaw/tracker @trackpaw/server @trackpaw/dashboard
```

### 2. Server Setup (Express)

```typescript
import express from 'express';
import { createAnalyticsServer, PostgresAdapter } from '@trackpaw/server';

const app = express();

const analytics = createAnalyticsServer({
  adapter: new PostgresAdapter({
    connectionString: process.env.DATABASE_URL,
  }),
  apiKey: process.env.ANALYTICS_API_KEY,
  cors: { origin: 'https://myapp.com' },
});

// Mount all analytics routes under /analytics
app.use('/analytics', analytics.router);

app.listen(3000);
```

### 3. Client Setup (Browser)

```typescript
import { Trackpaw } from '@trackpaw/tracker';

const tracker = Trackpaw.init({
  endpoint: 'https://myapp.com/analytics',
  apiKey: 'my-api-key',
  autoTrack: {
    pageViews: true,
    clicks: false,
    forms: false,
  },
});

// Identify a user
tracker.identify('user_123', { name: 'Alice', plan: 'pro' });

// Track custom events
tracker.track('Feature Used', { feature: 'export', format: 'csv' });

// Track a page view manually
tracker.page('/dashboard', { section: 'overview' });
```

### 4. Dashboard

```tsx
import { AnalyticsDashboard } from '@trackpaw/dashboard';

function AdminPage() {
  return (
    <AnalyticsDashboard
      endpoint="https://myapp.com/analytics"
      apiKey="my-api-key"
      theme="light"
    />
  );
}
```

## Documentation Index

| Document | Description |
|----------|-------------|
| [Architecture Overview](./architecture/ARCHITECTURE.md) | System design, data flow, and key decisions |
| [Database Schema](./architecture/DATABASE_SCHEMA.md) | Table definitions, indexes, and migration strategy |
| [Adapter Pattern](./architecture/ADAPTER_PATTERN.md) | How the DB adapter system works |
| [Tracker SDK Spec](./packages/tracker/TRACKER_SDK.md) | Full API spec for the client-side tracker |
| [Server Package Spec](./packages/server/SERVER_PACKAGE.md) | Ingestion API, query engine, middleware |
| [Dashboard Package Spec](./packages/dashboard/DASHBOARD_PACKAGE.md) | React dashboard component API and features |
| [Query Engine](./api-reference/QUERY_ENGINE.md) | How analytics queries are translated to SQL |
| [REST API Reference](./api-reference/REST_API.md) | All HTTP endpoints exposed by the server |
| [Development Guide](./guides/DEVELOPMENT_GUIDE.md) | How to set up, build, test, and contribute |
| [Integration Guide](./guides/INTEGRATION_GUIDE.md) | Framework-specific integration examples |
| [Privacy & Compliance](./guides/PRIVACY_COMPLIANCE.md) | GDPR, CCPA, data handling best practices |
| [Deployment Guide](./guides/DEPLOYMENT_GUIDE.md) | How customers deploy the server + dashboard |

## Core Principles

1. **Customer-owned data** — all data stays on the customer's infrastructure
2. **Database-agnostic** — works with Postgres, MySQL, SQLite, ClickHouse via adapters
3. **Zero runtime dependencies** — the tracker SDK has no external deps
4. **Privacy-first defaults** — IP anonymization, consent mode, PII scrubbing out of the box
5. **Embeddable dashboard** — one React component to mount a full analytics UI
6. **TypeScript-native** — full type safety across all packages

## Tech Stack

- **Language:** TypeScript (strict mode)
- **Build:** Turborepo (monorepo), tsup (bundling), Vitest (testing)
- **Tracker:** Vanilla TS, zero deps, ships as ESM + CJS + UMD
- **Server:** Framework-agnostic core with Express/Fastify/Hono adapters
- **Dashboard:** React 18+, Recharts, TailwindCSS
- **Database:** Knex.js (query builder) for adapter SQL generation
