# @trackpaw/server

Analytics server package for Trackpaw. Handles event ingestion, query engine, database adapters, and REST API.

## Installation

```bash
npm install @trackpaw/server

# Install the database driver you need:
npm install better-sqlite3   # SQLite (included by default)
npm install pg               # PostgreSQL
npm install mysql2            # MySQL
npm install @clickhouse/client  # ClickHouse
```

## Quick Start

```typescript
import express from 'express';
import { createAnalyticsServer, SQLiteAdapter } from '@trackpaw/server';

const app = express();

const analytics = createAnalyticsServer({
  adapter: new SQLiteAdapter({ filename: './analytics.db' }),
  apiKey: process.env.ANALYTICS_API_KEY,
  cors: { origin: 'https://myapp.com' },
});

await analytics.migrate();
app.use('/analytics', analytics.router);
app.listen(3000);
```

## Database Adapters

### SQLite (Development / Small Projects)
```typescript
new SQLiteAdapter({ filename: './analytics.db' })
new SQLiteAdapter({ filename: ':memory:' }) // for testing
```

### PostgreSQL (Production)
```typescript
new PostgresAdapter({
  connectionString: 'postgresql://user:pass@localhost:5432/analytics',
  pool: { min: 2, max: 10 },
  schema: 'trackpaw',
})
```

### MySQL
```typescript
new MySQLAdapter({
  host: 'localhost', port: 3306,
  database: 'analytics', user: 'root', password: 'secret',
})
```

### ClickHouse (High Volume)
```typescript
new ClickHouseAdapter({
  url: 'http://localhost:8123',
  database: 'analytics',
  asyncInsert: true,
  ttl: '365 DAY',
})
```

## Configuration

```typescript
createAnalyticsServer({
  adapter: StorageAdapter;        // Required
  apiKey?: string;                // Single API key
  apiKeys?: { write, read, admin }; // Multi-key mode
  rateLimit?: { maxRequests, windowMs };
  cors?: { origin, credentials };
  privacy?: { ipAnonymization, piiFields, piiAction };
  validation?: { maxEventNameLength, maxPropertiesCount };
  hooks?: { beforeIngest, afterIngest, beforeQuery, onError };
  queryCache?: { enabled, maxSize, ttlSeconds };
});
```

## REST API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/v1/health` | none | Health check |
| POST | `/v1/events/batch` | write | Ingest events |
| POST | `/v1/identify` | write | Identify user |
| POST | `/v1/query` | read | Run analytics query |
| GET | `/v1/events/stream` | read | Event stream |
| GET | `/v1/users` | read | User list |
| GET | `/v1/users/:id` | read | User profile |
| DELETE | `/v1/users/:id` | admin | Delete user (GDPR) |
| GET | `/v1/users/:id/export` | admin | Export user data |
| GET | `/v1/metadata` | read | Event metadata |

## Query Types

- **Trends** — event counts over time intervals
- **Funnel** — multi-step conversion analysis
- **Retention** — cohort retention grids
- **Event Stream** — filtered raw events
- **User List** — searchable user listing
- **Segment** — behavioral user segmentation
