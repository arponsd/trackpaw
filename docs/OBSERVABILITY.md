# Observability & Monitoring

Guide for integrating Trackpaw with logging, error tracking, and monitoring tools.

## Health Check Endpoint

The server exposes a health check endpoint at `/v1/health` (no authentication required). Use this for load balancer health checks, uptime monitors, and Kubernetes probes.

```bash
curl https://myapp.com/analytics/v1/health
```

```json
{
  "status": "ok",
  "version": "0.1.0",
  "adapter": "postgres",
  "uptime": 3600,
  "database": {
    "connected": true,
    "latencyMs": 2
  }
}
```

### Load Balancer Configuration

**AWS ALB / NLB:**
```
Health check path: /analytics/v1/health
Expected status: 200
Interval: 30s
Timeout: 5s
```

**Kubernetes:**
```yaml
livenessProbe:
  httpGet:
    path: /analytics/v1/health
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 30
readinessProbe:
  httpGet:
    path: /analytics/v1/health
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 10
```

## Error Tracking with Sentry

```typescript
import * as Sentry from '@sentry/node';
import { createAnalyticsServer, SQLiteAdapter } from '@trackpaw/server';

Sentry.init({ dsn: process.env.SENTRY_DSN });

const analytics = createAnalyticsServer({
  adapter: new SQLiteAdapter({ filename: './analytics.db' }),
  apiKey: process.env.ANALYTICS_KEY,
  hooks: {
    onError: (error, context) => {
      Sentry.captureException(error, {
        extra: { analyticsContext: context },
      });
    },
  },
});
```

## Structured Logging with Pino

```typescript
import pino from 'pino';
import { createAnalyticsServer, SQLiteAdapter } from '@trackpaw/server';

const logger = pino({ level: 'info' });

const analytics = createAnalyticsServer({
  adapter: new SQLiteAdapter({ filename: './analytics.db' }),
  apiKey: process.env.ANALYTICS_KEY,
  hooks: {
    afterIngest: (events, result) => {
      logger.info({ inserted: result.inserted, failed: result.failed }, 'Events ingested');
    },
    onError: (error, context) => {
      logger.error({ err: error, context }, 'Analytics error');
    },
  },
});
```

## Datadog Integration

```typescript
import { createAnalyticsServer } from '@trackpaw/server';
import { StatsD } from 'hot-shots';

const dogstatsd = new StatsD({ host: 'localhost', port: 8125 });

const analytics = createAnalyticsServer({
  adapter: new PostgresAdapter({ connectionString: process.env.DATABASE_URL }),
  apiKey: process.env.ANALYTICS_KEY,
  hooks: {
    afterIngest: (events, result) => {
      dogstatsd.increment('trackpaw.events.ingested', result.inserted);
      dogstatsd.increment('trackpaw.events.failed', result.failed);
    },
    onError: (error, context) => {
      dogstatsd.increment('trackpaw.errors', 1, { context });
    },
  },
});
```

## Key Metrics to Monitor

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| Ingestion latency | `afterIngest` hook timing | > 500ms p95 |
| Query latency | `beforeQuery` hook timing | > 5s p95 |
| Events ingested/min | `afterIngest` counter | Drop > 50% |
| Error rate | `onError` counter | > 1% of requests |
| Database latency | `/v1/health` endpoint | > 100ms |
| Database connections | Connection pool stats | > 80% utilization |
| Disk usage | OS monitoring | > 80% capacity |

## Migration Dry-Run

Before running migrations in production, you can verify what will be applied:

```typescript
const adapter = new PostgresAdapter({ connectionString: process.env.DATABASE_URL });

// Check without applying
const pending = await adapter.runMigrations();
if (pending.length > 0) {
  console.log('Pending migrations:', pending.map(m => m.name));
} else {
  console.log('No pending migrations');
}
```

Migrations are idempotent — they use `CREATE TABLE IF NOT EXISTS` and track applied migrations in a `tp_migrations` table. Running them multiple times is safe.
