<h1 align="center">trackpaw</h1>

<p align="center">
  <strong>Self-hosted, privacy-first analytics that runs entirely on your infrastructure.</strong><br />
  Event tracking, funnels, retention, user profiles, and a pre-built dashboard —<br />
  zero data leaves your servers. Ever.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@trackpaw/tracker"><img src="https://img.shields.io/badge/version-v0.1.0-orange.svg" alt="Version" /></a>
  <a href="./packages/tracker"><img src="https://img.shields.io/badge/tracker%20size-%3C5KB%20gzip-blueviolet.svg" alt="Size" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-yellow.svg" alt="License" /></a>
  <a href="#development"><img src="https://img.shields.io/badge/tests-193%20passing-success.svg" alt="Tests" /></a>
</p>

<p align="center">
  <a href="#quick-start">Installation</a> &bull;
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#rest-api">API Reference</a> &bull;
  <a href="#configuration">Configuration</a> &bull;
  <a href="#examples">Examples</a>
</p>

---

## Why Trackpaw?

Most analytics tools (Mixpanel, Amplitude, Google Analytics) send your user data to third-party servers. **Trackpaw doesn't.** It's a complete analytics platform you install via npm and run on your own infrastructure.

| | Traditional Analytics | Trackpaw |
|---|---|---|
| **Data ownership** | Their servers | Your servers |
| **Privacy** | Trust their policy | You control everything |
| **Cost** | Per-event pricing | Free (open source) |
| **Setup** | Add a script tag | `npm install` + mount a route |
| **Dashboard** | Their UI | Embeddable React component |

---

## Packages

| Package | What it does | Size |
|---------|-------------|------|
| [`@trackpaw/cli`](./packages/cli) | One-command setup: `npx @trackpaw/cli init` | **~8KB** |
| [`@trackpaw/tracker`](./packages/tracker) | Client-side SDK for browser & Node.js | **< 5KB** gzip |
| [`@trackpaw/server`](./packages/server) | Ingestion API + query engine + DB adapters | — |
| [`@trackpaw/dashboard`](./packages/dashboard) | Embeddable React analytics UI | — |

---

## Quick Start

### One-command setup

```bash
npx @trackpaw/cli init
```

That's it. The CLI asks your framework, database, and product type — then scaffolds everything and installs dependencies.

Or skip the prompts entirely:

```bash
npx @trackpaw/cli init --framework express --db sqlite --preset saas
```

**Presets:** `saas` | `ecommerce` | `media` — each comes with standard events out of the box.

> Using an AI assistant? Just say: **"install trackpaw"** — it will find and run the CLI for you.

---

### Manual setup

<details>
<summary>If you prefer to set things up yourself</summary>

#### 1. Install

```bash
npm install @trackpaw/tracker @trackpaw/server @trackpaw/dashboard
```

#### 2. Set up the server

```typescript
// server.ts
import express from 'express';
import { createAnalyticsServer, SQLiteAdapter } from '@trackpaw/server';

const app = express();

const analytics = createAnalyticsServer({
  adapter: new SQLiteAdapter({ filename: './analytics.db' }),
  apiKey: 'your-api-key',
  cors: { origin: 'https://myapp.com' },
});

await analytics.migrate();          // creates tables on first run
app.use('/analytics', analytics.router);
app.listen(3000);
```

> **That's it.** No external services, no config files, no Docker required. SQLite works out of the box. Swap to Postgres/MySQL/ClickHouse when you need scale.

### 3. Track events in the browser

```typescript
import { Trackpaw } from '@trackpaw/tracker';

const tracker = Trackpaw.init({
  endpoint: 'https://myapp.com/analytics',
  apiKey: 'your-api-key',
  autoTrack: { pageViews: true },
});

// Identify users
tracker.identify('user_123', { name: 'Alice', plan: 'pro' });

// Track custom events
tracker.track('Feature Used', { feature: 'export', format: 'csv' });

// Track page views manually (auto-tracking handles this by default)
tracker.page('/dashboard');
```

### 4. Embed the dashboard

```tsx
import { AnalyticsDashboard } from '@trackpaw/dashboard';

function AdminPage() {
  return (
    <AnalyticsDashboard
      endpoint="https://myapp.com/analytics"
      apiKey="your-read-key"
      theme="light"                    // or "dark" or "system"
    />
  );
}
```

</details>

---

## Features

### Tracker SDK
- **Zero dependencies** — pure TypeScript, no bloat
- **Under 5KB gzipped** — won't slow down your pages
- **Auto-capture** — page views, clicks, form submissions (opt-in)
- **Batched queue** — events buffered and sent efficiently
- **Offline persistence** — events survive page reloads via localStorage
- **Consent mode** — opt-in/opt-out, Do Not Track support
- **Works everywhere** — browser (ESM/CJS/UMD) and Node.js

### Server
- **Event ingestion** — validates, enriches, and stores events
- **Query engine** — trends, funnels, retention, segments, event stream, user list
- **4 database adapters** — SQLite, PostgreSQL, MySQL, ClickHouse
- **REST API** — 11 endpoints with auth, rate limiting, CORS
- **Privacy built-in** — IP anonymization, PII scrubbing (hash or remove)
- **GDPR ready** — one-call user deletion and data export
- **Framework agnostic** — Express router (Fastify/Hono planned)

### Dashboard
- **One component** — `<AnalyticsDashboard />` gives you everything
- **7 views** — Overview, Trends, Funnels, Retention, Event Stream, Users, User Profile
- **Themeable** — light/dark/system, custom accent color and fonts
- **Embeddable** — drop it into any React admin panel
- **Individual exports** — use `<LineChart>`, `<FunnelChart>`, `<MetricCard>` independently

---

## Database Support

Start with SQLite for development. Move to Postgres for production. Scale to ClickHouse when you need to.

```typescript
// Development — zero config
new SQLiteAdapter({ filename: './analytics.db' })

// Production — battle tested
new PostgresAdapter({ connectionString: process.env.DATABASE_URL })

// Scale — millions of events/day
new ClickHouseAdapter({ url: 'http://localhost:8123' })

// MySQL — if that's what you run
new MySQLAdapter({ host: 'localhost', database: 'analytics', user: 'root', password: '' })
```

| Database | Best for | Events/day |
|----------|----------|-----------|
| **SQLite** | Development, small projects | < 10K |
| **PostgreSQL** | Production workloads | 10K–1M |
| **MySQL** | Teams already on MySQL | 10K–500K |
| **ClickHouse** | High-volume analytics | 1M+ |

All adapters implement the same interface — **switch databases without changing your application code.**

---

## REST API

All endpoints are mounted under your chosen path (e.g., `/analytics`).

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/v1/health` | — | Health check |
| `POST` | `/v1/events/batch` | write | Ingest events |
| `POST` | `/v1/identify` | write | Identify user |
| `POST` | `/v1/query` | read | Run analytics query |
| `GET` | `/v1/events/stream` | read | Event stream |
| `GET` | `/v1/users` | read | User list |
| `GET` | `/v1/users/:id` | read | User profile |
| `DELETE` | `/v1/users/:id` | admin | Delete user (GDPR) |
| `GET` | `/v1/users/:id/export` | admin | Export user data |
| `GET` | `/v1/metadata` | read | Event metadata |

Supports **separate API keys** for write (tracker), read (dashboard), and admin (GDPR) operations.

---

## Examples

| Example | Description | Run it |
|---------|-------------|--------|
| [`express-app`](./examples/express-app) | Express.js + tracker + HTML demo pages | `cd examples/express-app && pnpm start` |
| [`nextjs-app`](./examples/nextjs-app) | Next.js App Router + embedded dashboard | `cd examples/nextjs-app && pnpm dev` |
| [`standalone`](./examples/standalone) | Zero-config server with seed data | `cd examples/standalone && pnpm demo` |

---

## Configuration

### Server options

```typescript
createAnalyticsServer({
  adapter: StorageAdapter,            // Required — database adapter

  // Auth
  apiKey: 'single-key',              // Simple mode: one key for everything
  apiKeys: {                          // Multi-key mode: separate permissions
    write: ['tracker-key'],
    read: ['dashboard-key'],
    admin: ['admin-key'],
  },

  // Privacy (all enabled by default)
  privacy: {
    ipAnonymization: true,            // Mask last IP octet
    piiFields: ['email', 'phone'],    // Fields to hash or remove
    piiAction: 'hash',                // 'hash' (SHA-256) or 'remove'
  },

  // Performance
  rateLimit: { maxRequests: 100, windowMs: 60000 },
  queryCache: { enabled: true, ttlSeconds: 60 },

  // Hooks
  hooks: {
    beforeIngest: (events) => events,       // Transform events before storage
    afterIngest: (events, result) => {},     // Side effects after storage
    onError: (error, context) => {},         // Error handling
  },
});
```

### Tracker options

```typescript
Trackpaw.init({
  endpoint: '/analytics',
  apiKey: 'write-key',
  flushInterval: 5000,               // Send events every 5s
  flushQueueSize: 10,                // Or when 10 events queue up
  persistence: 'localStorage',       // 'localStorage' | 'memory'
  sessionTimeout: 1800000,           // 30 min session timeout
  autoTrack: {
    pageViews: true,                  // Auto-track page views
    clicks: false,                    // Auto-track clicks (opt-in)
    forms: false,                     // Auto-track form submits (opt-in)
  },
  ipAnonymization: true,
  respectDoNotTrack: false,
  defaultOptOut: false,               // true = opt-in consent mode
  debug: false,                       // Log events to console
});
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Language** | TypeScript (strict mode) |
| **Build** | Turborepo + tsup |
| **Testing** | Vitest (193 tests) |
| **Tracker** | Vanilla TS, zero deps |
| **Server** | Express.js, framework-agnostic core |
| **Dashboard** | React 18+, Recharts, TanStack Query |
| **Databases** | Adapter pattern (SQLite, Postgres, MySQL, ClickHouse) |
| **CI/CD** | GitHub Actions + Changesets |

---

## Development

```bash
pnpm install          # Install dependencies
pnpm build            # Build all packages
pnpm test             # Run all 193 tests
pnpm typecheck        # Type-check all packages
pnpm lint             # Lint all packages
pnpm format           # Format with Prettier
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full development guide.

---

## License

MIT &copy; [Trackpaw Contributors](./LICENSE)
