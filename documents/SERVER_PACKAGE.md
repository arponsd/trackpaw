# Server Package Specification

## Overview

`@trackpaw/server` is the backend package that handles event ingestion, user identification, query execution, and database management. It runs on the customer's server and connects to their database.

**Design Goals:**
- Framework-agnostic core (with Express, Fastify, Hono adapters)
- Pluggable storage via the adapter pattern
- Secure by default (API key auth, rate limiting, input validation)
- Auto-migration on first run
- TypeScript-first

## Package Structure

```
packages/server/
├── src/
│   ├── index.ts                    # Public API exports
│   ├── core/
│   │   ├── analytics-core.ts       # Main orchestrator class
│   │   ├── event-validator.ts      # Event payload validation
│   │   ├── event-enricher.ts       # Add server-side context (IP, UA parsing)
│   │   ├── identity-resolver.ts    # Link anonymous → identified users
│   │   └── session-resolver.ts     # Session creation/update logic
│   ├── query-engine/
│   │   ├── engine.ts               # Query dispatcher
│   │   ├── trends.ts               # Trends query builder
│   │   ├── funnel.ts               # Funnel query builder
│   │   ├── retention.ts            # Retention cohort query builder
│   │   ├── segmentation.ts         # User segmentation query builder
│   │   ├── event-stream.ts         # Raw event stream query
│   │   ├── user-list.ts            # User list/search query
│   │   └── types.ts                # Query and result type definitions
│   ├── adapters/
│   │   ├── types.ts                # StorageAdapter interface
│   │   ├── postgres.ts             # PostgresAdapter
│   │   ├── sqlite.ts               # SQLiteAdapter
│   │   ├── mysql.ts                # MySQLAdapter
│   │   ├── clickhouse.ts           # ClickHouseAdapter
│   │   └── migrations/
│   │       ├── postgres/
│   │       ├── sqlite/
│   │       ├── mysql/
│   │       └── clickhouse/
│   ├── middleware/
│   │   ├── auth.ts                 # API key validation middleware
│   │   ├── rate-limiter.ts         # Rate limiting (per IP, per key)
│   │   ├── cors.ts                 # CORS configuration
│   │   └── error-handler.ts        # Global error handler
│   ├── framework/
│   │   ├── express.ts              # Express router adapter
│   │   ├── fastify.ts              # Fastify plugin adapter
│   │   └── hono.ts                 # Hono app adapter
│   ├── privacy/
│   │   ├── ip-anonymizer.ts        # IP address anonymization
│   │   ├── pii-scrubber.ts         # Remove/hash PII from properties
│   │   └── gdpr.ts                 # Data deletion, export handlers
│   └── utils/
│       ├── ua-parser.ts            # Lightweight user-agent parser
│       ├── geo.ts                  # Optional IP geolocation
│       └── logger.ts               # Internal structured logger
├── tsconfig.json
├── package.json
└── README.md
```

## Factory Function API

### createAnalyticsServer()

The main entry point. Returns a configured analytics server instance.

```typescript
import { createAnalyticsServer, PostgresAdapter } from '@trackpaw/server';

const analytics = createAnalyticsServer({
  // Required
  adapter: StorageAdapter;

  // Authentication
  apiKey?: string;                    // Single API key (simple mode)
  apiKeys?: {
    write: string[];                  // Keys allowed to ingest events
    read: string[];                   // Keys allowed to query data
    admin: string[];                  // Keys allowed to manage settings
  };

  // Rate limiting
  rateLimit?: {
    enabled?: boolean;                // default: true
    windowMs?: number;                // default: 60000 (1 min)
    maxRequests?: number;             // default: 100 per window
    maxEventsPerBatch?: number;       // default: 100
    keyGenerator?: (req) => string;   // default: IP address
  };

  // CORS
  cors?: {
    origin: string | string[] | boolean;
    credentials?: boolean;
  };

  // Privacy
  privacy?: {
    ipAnonymization?: boolean;        // default: true
    piiFields?: string[];             // Property keys to hash/remove
    piiAction?: 'hash' | 'remove';    // default: 'hash'
  };

  // Event validation
  validation?: {
    maxEventNameLength?: number;      // default: 256
    maxPropertiesCount?: number;      // default: 50
    maxPropertyValueLength?: number;  // default: 8192
    allowedEventNames?: string[];     // Whitelist (optional)
    blockedEventNames?: string[];     // Blacklist (optional)
  };

  // Hooks
  hooks?: {
    beforeIngest?: (events: RawEvent[]) => RawEvent[] | Promise<RawEvent[]>;
    afterIngest?: (events: ValidatedEvent[], result: InsertResult) => void;
    beforeQuery?: (query: AnalyticsQuery) => AnalyticsQuery;
    onError?: (error: Error, context: string) => void;
  };

  // Logging
  logger?: Logger;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
});
```

### Return Value

```typescript
interface AnalyticsServerInstance {
  router: express.Router;           // Express router
  fastifyPlugin: FastifyPlugin;     // Fastify plugin
  honoApp: HonoApp;                 // Hono app
  core: AnalyticsCore;              // Direct core access
  migrate(): Promise<MigrationResult[]>;
  healthCheck(): Promise<HealthCheckResult>;
  shutdown(): Promise<void>;
}
```

## Event Processing Pipeline

Events flow through this pipeline on ingestion:

```
Raw Events (from tracker)
    │
    ▼
┌─────────────────────┐
│  1. VALIDATION       │  Reject malformed events, enforce name
│                      │  length, property count, value sizes.
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  2. ENRICHMENT       │  Parse User-Agent → browser, OS, device.
│                      │  Parse IP → country (optional). Normalize
│                      │  timestamps to UTC.
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  3. PRIVACY          │  Anonymize IP (mask last octet).
│                      │  Hash/remove configured PII fields.
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  4. SESSION RESOLVE  │  Find or create session record.
│                      │  Update ended_at and event_count.
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  5. HOOKS            │  Run customer's beforeIngest hooks.
│                      │  Allows filtering or transforming events.
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  6. STORAGE          │  Adapter batch-inserts events into DB.
│                      │  Upserts session records.
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  7. POST-HOOKS       │  Run afterIngest hooks.
│                      │  Customer can trigger side effects.
└─────────────────────┘
```

## Query Engine

The query engine translates structured query objects into adapter-specific SQL.

### Supported Query Types

#### TrendsQuery

Aggregate event counts or unique users over time intervals.

```typescript
interface TrendsQuery {
  type: 'trends';
  events: Array<{
    name: string;
    filters?: PropertyFilter[];
    aggregation?: 'total' | 'unique_users' | 'unique_sessions'
                  | 'avg_per_user' | 'property_sum' | 'property_avg';
    propertyKey?: string;
  }>;
  interval: 'hour' | 'day' | 'week' | 'month';
  dateRange: DateRange;
  filters?: GlobalFilter[];
  groupBy?: string;
}

interface TrendsResult {
  series: Array<{
    event: string;
    groupValue?: string;
    data: Array<{ date: string; value: number }>;
    total: number;
  }>;
  dateRange: { start: string; end: string };
}
```

#### FunnelQuery

Measure conversion through a sequence of steps.

```typescript
interface FunnelQuery {
  type: 'funnel';
  steps: Array<{
    event: string;
    filters?: PropertyFilter[];
  }>;
  dateRange: DateRange;
  conversionWindow?: number;      // Max seconds between first and last step
  groupBy?: string;               // Property to break down conversion by
  countType?: 'unique_users' | 'total';
}

interface FunnelResult {
  steps: Array<{
    event: string;
    count: number;
    conversionRate: number;       // Percentage from previous step
    overallRate: number;          // Percentage from step 1
    dropoff: number;              // Count that didn't convert
    medianTimeBetween?: number;   // Median seconds from previous step
  }>;
  groupedResults?: Record<string, FunnelResult['steps']>;
}
```

#### RetentionQuery

Build cohort retention grids.

```typescript
interface RetentionQuery {
  type: 'retention';
  startEvent: string;             // The "activation" event
  returnEvent: string;            // The "return" event
  dateRange: DateRange;
  interval: 'day' | 'week' | 'month';
  periods: number;                // How many intervals to track
  filters?: GlobalFilter[];
}

interface RetentionResult {
  cohorts: Array<{
    date: string;                 // Cohort date (e.g., "2025-01-06")
    cohortSize: number;           // Users who did startEvent
    retention: Array<{
      period: number;             // 0, 1, 2, ... N
      count: number;              // Users who returned
      percentage: number;         // count / cohortSize * 100
    }>;
  }>;
}
```

#### EventStreamQuery

Fetch raw events with filtering and pagination.

```typescript
interface EventStreamQuery {
  type: 'event_stream';
  filters?: {
    eventNames?: string[];
    userId?: string;
    anonymousId?: string;
    sessionId?: string;
    properties?: PropertyFilter[];
    dateRange?: DateRange;
  };
  limit?: number;                 // default: 50
  offset?: number;                // default: 0
  orderBy?: 'timestamp_asc' | 'timestamp_desc';  // default: desc
}
```

#### SegmentQuery

Count or list users matching behavioral criteria.

```typescript
interface SegmentQuery {
  type: 'segment';
  conditions: Array<{
    event: string;
    operator: 'did' | 'did_not';
    count?: { operator: 'gte' | 'lte' | 'eq'; value: number };
    dateRange?: DateRange;
    properties?: PropertyFilter[];
  }>;
  combinator: 'and' | 'or';
  output: 'count' | 'user_list';
  limit?: number;
}
```

### PropertyFilter

Used across all query types:

```typescript
interface PropertyFilter {
  key: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
            | 'contains' | 'not_contains'
            | 'is_set' | 'is_not_set'
            | 'in' | 'not_in';
  value?: any;
  values?: any[];                 // For 'in' / 'not_in'
}

interface DateRange {
  preset?: '24h' | '7d' | '14d' | '30d' | '90d' | '365d';
  start?: string;                 // ISO date
  end?: string;                   // ISO date
}
```

## Middleware Stack

All routes pass through this middleware chain:

```
Request
  → CORS (if configured)
  → Rate Limiter
  → API Key Auth
  → Body Parser (JSON, max 1MB)
  → Route Handler
  → Error Handler
  → Response
```

### Auth Middleware

```typescript
// Checks X-API-Key header or ?api_key query param
function authMiddleware(config: AuthConfig) {
  return (req, res, next) => {
    const key = req.headers['x-api-key'] || req.query.api_key;
    
    if (!key) return res.status(401).json({ error: 'API key required' });
    
    const permission = resolvePermission(key, config);
    if (!permission) return res.status(403).json({ error: 'Invalid API key' });
    
    req.analyticsPermission = permission; // 'write' | 'read' | 'admin'
    next();
  };
}
```

### Rate Limiter

In-memory sliding window rate limiter (no external deps like Redis required):

```typescript
// Default: 100 requests per minute per IP
// Configurable per key type (write keys get higher limits)
```

## Error Handling

All errors follow a standard format:

```typescript
interface AnalyticsError {
  error: string;                  // Machine-readable error code
  message: string;                // Human-readable description
  status: number;                 // HTTP status code
  details?: any;                  // Additional context (validation errors, etc.)
}
```

Error codes:
- `INVALID_API_KEY` — 401
- `RATE_LIMITED` — 429
- `VALIDATION_ERROR` — 400
- `INVALID_QUERY` — 400
- `USER_NOT_FOUND` — 404
- `INTERNAL_ERROR` — 500
- `ADAPTER_ERROR` — 500

## Integration Examples

### Express

```typescript
import express from 'express';
import { createAnalyticsServer, PostgresAdapter } from '@trackpaw/server';

const app = express();
const analytics = createAnalyticsServer({
  adapter: new PostgresAdapter({ connectionString: process.env.DATABASE_URL }),
  apiKey: process.env.ANALYTICS_KEY,
});

app.use('/analytics', analytics.router);
app.listen(3000);
```

### Fastify

```typescript
import Fastify from 'fastify';
import { createAnalyticsServer, PostgresAdapter } from '@trackpaw/server';

const fastify = Fastify();
const analytics = createAnalyticsServer({
  adapter: new PostgresAdapter({ connectionString: process.env.DATABASE_URL }),
  apiKey: process.env.ANALYTICS_KEY,
});

fastify.register(analytics.fastifyPlugin, { prefix: '/analytics' });
fastify.listen({ port: 3000 });
```

### Hono (Edge / Cloudflare Workers)

```typescript
import { Hono } from 'hono';
import { createAnalyticsServer, SQLiteAdapter } from '@trackpaw/server';

const app = new Hono();
const analytics = createAnalyticsServer({
  adapter: new SQLiteAdapter({ filename: './analytics.db' }),
  apiKey: 'my-key',
});

app.route('/analytics', analytics.honoApp);
export default app;
```

### Next.js API Route

```typescript
// app/api/analytics/[...path]/route.ts
import { createAnalyticsServer, PostgresAdapter } from '@trackpaw/server';

const analytics = createAnalyticsServer({
  adapter: new PostgresAdapter({ connectionString: process.env.DATABASE_URL }),
  apiKey: process.env.ANALYTICS_KEY,
});

export const { GET, POST } = analytics.nextjsHandler();
```

## Testing Strategy

- **Unit tests:** Validator, enricher, session resolver, each query builder
- **Integration tests:** Full pipeline with SQLite in-memory adapter
- **Adapter conformance tests:** Shared test suite every adapter must pass
- **Load tests:** Benchmark ingestion throughput (target: 1000 events/sec on SQLite, 10K on Postgres)
- **Security tests:** API key validation, rate limiting, SQL injection prevention
