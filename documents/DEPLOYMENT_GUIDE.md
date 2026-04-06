# Deployment Guide

## Overview

This guide covers how customers deploy Trackpaw in production environments. Since Trackpaw runs entirely on the customer's infrastructure, deployment is straightforward — it's just another npm package in their existing app.

## Deployment Options

### Option 1: Embedded in Existing App (Recommended)

Mount the analytics server as middleware in your existing Express/Fastify/Hono app. No separate deployment needed.

```typescript
// Your existing app
import express from 'express';
import { createAnalyticsServer, PostgresAdapter } from '@trackpaw/server';

const app = express();

// Your existing routes
app.get('/', (req, res) => res.render('home'));
app.post('/api/orders', orderController);

// Add analytics
const analytics = createAnalyticsServer({
  adapter: new PostgresAdapter({ connectionString: process.env.DATABASE_URL }),
  apiKey: process.env.ANALYTICS_KEY,
});
app.use('/analytics', analytics.router);

app.listen(3000);
```

**Pros:** No extra infrastructure, shares existing server and database.
**Cons:** Analytics load affects your main app's performance.

### Option 2: Standalone Analytics Server

Run the analytics server as a separate microservice.

```typescript
// analytics-server.ts
import express from 'express';
import { createAnalyticsServer, PostgresAdapter } from '@trackpaw/server';

const app = express();

const analytics = createAnalyticsServer({
  adapter: new PostgresAdapter({
    connectionString: process.env.ANALYTICS_DATABASE_URL,
    pool: { min: 5, max: 20 },
  }),
  apiKey: process.env.ANALYTICS_KEY,
  cors: { origin: ['https://myapp.com', 'https://admin.myapp.com'] },
});

await analytics.migrate();
app.use('/', analytics.router);

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Analytics server running on port ${port}`);
});
```

**Pros:** Isolated performance, can scale independently, dedicated database.
**Cons:** Extra infrastructure to manage.

### Option 3: Serverless (AWS Lambda / Vercel / Cloudflare)

For serverless deployments, use the appropriate framework adapter:

```typescript
// Vercel: api/analytics/[...path].ts
import { createAnalyticsServer, PostgresAdapter } from '@trackpaw/server';

const analytics = createAnalyticsServer({
  adapter: new PostgresAdapter({
    connectionString: process.env.DATABASE_URL,
    pool: { min: 1, max: 5 }, // Lower pool for serverless
  }),
  apiKey: process.env.ANALYTICS_KEY,
});

export default analytics.vercelHandler();
```

**Note:** Serverless works but has caveats — cold starts add latency to event ingestion, and connection pooling needs to be managed carefully (consider using PgBouncer or Neon's serverless driver).

## Database Setup

### Postgres (Recommended for Production)

```bash
# Create a dedicated database
createdb analytics

# Or use an existing database with a separate schema
psql -c "CREATE SCHEMA trackpaw;" analytics
```

```typescript
const adapter = new PostgresAdapter({
  connectionString: 'postgresql://analytics_user:pass@localhost:5432/analytics',
  schema: 'trackpaw',  // Optional: use a dedicated schema
  pool: {
    min: 2,
    max: 10,
    idleTimeoutMs: 30000,
  },
});
```

**Recommended Postgres config for analytics:**

```sql
-- Increase work_mem for complex analytical queries
ALTER SYSTEM SET work_mem = '256MB';

-- Increase shared_buffers for caching
ALTER SYSTEM SET shared_buffers = '1GB';

-- Tune for write-heavy workload
ALTER SYSTEM SET wal_buffers = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
```

### SQLite (Development / Small Projects)

```typescript
const adapter = new SQLiteAdapter({
  filename: '/data/analytics.db',
  walMode: true,  // Enable WAL for better concurrent read performance
});
```

**Production with SQLite:**
- Use WAL mode (enabled by default)
- Place the DB file on fast storage (SSD)
- Set up regular backups (copy the .db file)
- Consider Litestream for continuous replication

### ClickHouse (High Volume)

```bash
# Docker
docker run -d --name clickhouse \
  -p 8123:8123 \
  -p 9000:9000 \
  -v ch-data:/var/lib/clickhouse \
  clickhouse/clickhouse-server:latest
```

```typescript
const adapter = new ClickHouseAdapter({
  url: 'http://localhost:8123',
  database: 'analytics',
  asyncInsert: true,
  ttl: '365 DAY',
});
```

## Production Checklist

### Server Configuration

- [ ] **HTTPS only** — serve analytics over TLS
- [ ] **API keys configured** — separate write/read/admin keys
- [ ] **Rate limiting enabled** — prevent abuse
- [ ] **CORS configured** — restrict to your domain(s)
- [ ] **IP anonymization on** — privacy compliance
- [ ] **Error logging** — connect to your logging system (Sentry, Datadog, etc.)

### Database

- [ ] **Connection pooling** — configure appropriate pool size
- [ ] **Migrations run** — call `analytics.migrate()` on startup
- [ ] **Retention policy set** — auto-delete old data
- [ ] **Backups configured** — regular database backups
- [ ] **Indexes verified** — check that auto-created indexes exist
- [ ] **Monitoring** — database CPU, memory, disk, query latency

### Client Tracker

- [ ] **Endpoint configured** — points to production server
- [ ] **Write API key set** — via environment variable
- [ ] **Auto-tracking configured** — page views on, clicks optional
- [ ] **Consent management** — opt-in mode for EU users
- [ ] **Error handling** — `onError` callback configured

### Dashboard

- [ ] **Read API key used** — dashboard should use read-only key
- [ ] **Access controlled** — only admins can see the dashboard
- [ ] **Embedded properly** — theme matches your admin panel

## Scaling Guide

### Small Scale (< 10K events/day)

- Embedded in existing app
- SQLite or Postgres
- Single server
- No special configuration needed

### Medium Scale (10K–500K events/day)

- Dedicated Postgres database
- Connection pooling (PgBouncer)
- Consider separate analytics server
- Enable query caching
- Set up data retention (90–365 days)

```typescript
const analytics = createAnalyticsServer({
  adapter: new PostgresAdapter({
    connectionString: process.env.ANALYTICS_DB_URL,
    pool: { min: 5, max: 20 },
    retention: { events: '365d', sessions: '365d', users: 'forever' },
  }),
  queryCache: { enabled: true, ttlSeconds: 60 },
});
```

### Large Scale (500K+ events/day)

- ClickHouse for storage
- Separate ingestion workers (Node.js cluster or multiple instances)
- Load balancer in front of analytics servers
- Redis for rate limiting (instead of in-memory)
- Consider async ingestion (queue → worker → database)

```typescript
// Multi-worker setup with cluster
import cluster from 'cluster';
import os from 'os';

if (cluster.isPrimary) {
  const numWorkers = os.cpus().length;
  for (let i = 0; i < numWorkers; i++) {
    cluster.fork();
  }
} else {
  const app = express();
  const analytics = createAnalyticsServer({
    adapter: new ClickHouseAdapter({
      url: process.env.CLICKHOUSE_URL,
      asyncInsert: true,
    }),
    apiKey: process.env.ANALYTICS_KEY,
  });
  app.use('/analytics', analytics.router);
  app.listen(4000);
}
```

## Monitoring

### Health Check Endpoint

```bash
curl https://myapp.com/analytics/v1/health

# Response:
{
  "status": "ok",
  "version": "1.0.0",
  "adapter": "postgres",
  "database": { "connected": true, "latencyMs": 3 }
}
```

### Key Metrics to Monitor

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| Ingestion latency | Server logs | > 500ms p95 |
| Query latency | Server logs | > 5s p95 |
| Events ingested/min | Database count | Drop > 50% |
| Database connections | Connection pool | > 80% utilization |
| Database disk usage | DB monitoring | > 80% capacity |
| Error rate | Server logs | > 1% of requests |
| Queue size (tracker) | Client console | > 100 events |

### Logging Integration

```typescript
import pino from 'pino';

const logger = pino({ level: 'info' });

const analytics = createAnalyticsServer({
  adapter: new PostgresAdapter({ ... }),
  logger: {
    debug: (msg, data) => logger.debug(data, msg),
    info: (msg, data) => logger.info(data, msg),
    warn: (msg, data) => logger.warn(data, msg),
    error: (msg, data) => logger.error(data, msg),
  },
  hooks: {
    onError: (error, context) => {
      // Send to Sentry, Datadog, etc.
      Sentry.captureException(error, { extra: { context } });
    },
  },
});
```

## Backup & Recovery

### Postgres Backups

```bash
# Daily backup via cron
0 3 * * * pg_dump -Fc analytics > /backups/analytics_$(date +\%Y\%m\%d).dump

# Restore
pg_restore -d analytics /backups/analytics_20250615.dump
```

### SQLite Backups

```bash
# Simple file copy (safe with WAL mode)
cp /data/analytics.db /backups/analytics_$(date +%Y%m%d).db

# Or use .backup command
sqlite3 /data/analytics.db ".backup /backups/analytics_$(date +%Y%m%d).db"
```

## Upgrading

When a new version of Trackpaw is released:

```bash
# Update packages
npm update @trackpaw/tracker @trackpaw/server @trackpaw/dashboard

# Restart your server — migrations run automatically on boot
pm2 restart analytics-server
```

Migrations are backward-compatible — they only add columns/tables, never remove or rename. Rolling back to an older version of the package is safe (the extra columns are ignored).
