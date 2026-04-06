# Architecture Overview

## System Design

Trackpaw follows a three-layer architecture where all components run on the customer's own infrastructure.

```
┌─────────────────────────────────────────────────────────────────┐
│                     CUSTOMER'S APPLICATION                      │
│                                                                 │
│  ┌──────────────┐    ┌──────────────────┐    ┌───────────────┐  │
│  │   Tracker    │───▶│     Server       │───▶│   Database    │  │
│  │  (Browser)   │    │  (Their Server)  │    │  (Their DB)   │  │
│  │              │    │                  │    │               │  │
│  │ - track()    │    │ - Ingestion API  │    │ - events      │  │
│  │ - identify() │    │ - Query Engine   │    │ - users       │  │
│  │ - page()     │    │ - Adapters       │    │ - sessions    │  │
│  └──────────────┘    └───────┬──────────┘    └───────────────┘  │
│                              │                                  │
│                     ┌────────▼─────────┐                        │
│                     │    Dashboard     │                        │
│                     │  (React UI)     │                        │
│                     │                 │                        │
│                     │ - Trends        │                        │
│                     │ - Funnels       │                        │
│                     │ - Retention     │                        │
│                     │ - User profiles │                        │
│                     └─────────────────┘                        │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Event Ingestion Flow

```
1. User action in browser
      │
2. tracker.track('Clicked Button', { id: 'signup' })
      │
3. Event queued in memory buffer
      │
4. Buffer flushes (every 5s or 10 events, whichever first)
      │
5. POST /analytics/v1/events (batched JSON payload)
      │
6. Server validates events against schema
      │
7. Server enriches events (timestamp normalization, session resolution)
      │
8. Adapter writes to customer's database
      │
9. Acknowledge success to tracker
```

### Query Flow

```
1. Dashboard requests: POST /analytics/v1/query
      │
2. Query engine parses the query definition
      │
      ├── { type: 'trends', event: 'Sign Up', interval: 'day', range: '30d' }
      ├── { type: 'funnel', steps: [...], range: '7d' }
      └── { type: 'retention', startEvent: 'Sign Up', returnEvent: 'Login', range: '8w' }
      │
3. Query engine generates optimized SQL via the active adapter
      │
4. Adapter executes SQL against customer's database
      │
5. Results are transformed into a standard response format
      │
6. Dashboard renders the visualization
```

## Key Architectural Decisions

### Decision 1: Adapter Pattern for Storage

**Why:** Customers have different databases. Forcing Postgres would limit adoption.

**How:** The server package defines a `StorageAdapter` interface. Each adapter (Postgres, MySQL, SQLite, ClickHouse) implements this interface. The query engine generates SQL through the adapter, so database-specific optimizations (like ClickHouse's `MergeTree` or Postgres's `JSONB` operators) are handled per-adapter.

```typescript
interface StorageAdapter {
  initialize(): Promise<void>;          // Run migrations, create tables
  insertEvents(events: Event[]): Promise<void>;
  upsertUser(user: UserProfile): Promise<void>;
  query(query: AnalyticsQuery): Promise<QueryResult>;
  getRawEvents(filters: EventFilter): Promise<Event[]>;
  getUserProfile(userId: string): Promise<UserProfile | null>;
  deleteUser(userId: string): Promise<void>;  // GDPR
  runMigrations(): Promise<void>;
}
```

### Decision 2: Framework-Agnostic Server Core

**Why:** Customers use Express, Fastify, Hono, Koa, or plain Node HTTP.

**How:** The core logic (ingestion, validation, query engine) is framework-agnostic. Thin adapters wrap it for each framework. We ship first-class Express support, with Fastify and Hono as secondary.

```typescript
// Core (framework-agnostic)
class AnalyticsCore {
  async ingestEvents(events: RawEvent[]): Promise<IngestResult> { }
  async executeQuery(query: AnalyticsQuery): Promise<QueryResult> { }
  async identifyUser(userId: string, traits: Record<string, any>): Promise<void> { }
}

// Express adapter
function createExpressRouter(core: AnalyticsCore): express.Router { }

// Fastify adapter
function createFastifyPlugin(core: AnalyticsCore): FastifyPlugin { }
```

### Decision 3: Zero-Dependency Tracker

**Why:** Analytics is invasive — it loads on every page. It must be tiny and dependency-free to avoid conflicts, bundle bloat, and supply-chain risk.

**How:** The tracker is written in pure TypeScript with no external dependencies. It compiles to ESM, CJS, and UMD bundles. The UMD build can be loaded via `<script>` tag for non-bundler users. Target size: under 5KB gzipped.

### Decision 4: Query Engine With Pre-built Query Types

**Why:** Building analytics queries from scratch is hard and error-prone. Raw SQL access is a security risk.

**How:** The query engine supports a fixed set of query types (`trends`, `funnel`, `retention`, `segmentation`, `userList`, `eventStream`). Each has a typed input shape and returns a typed output. No raw SQL is exposed. This also means each adapter can optimize the SQL for its engine.

### Decision 5: Batch Ingestion With Client-Side Queue

**Why:** Sending one HTTP request per event is inefficient and causes performance issues.

**How:** The tracker queues events in memory and flushes them as a batch. Flush triggers: (a) timer (default 5 seconds), (b) batch size (default 10 events), (c) page unload (`visibilitychange` + `sendBeacon`). Queue is backed by `localStorage` so events survive page reloads.

## Package Dependency Graph

```
@trackpaw/tracker  →  (no deps — standalone)
@trackpaw/server   →  @trackpaw/types (shared types)
@trackpaw/dashboard → @trackpaw/types (shared types)
                          react, recharts, tailwindcss (peer deps)
```

`@trackpaw/types` is an internal package containing shared TypeScript interfaces used by both server and dashboard. It is NOT published separately — it's bundled into each package at build time.

## Security Model

- **API Key Authentication:** Every request from tracker or dashboard includes an API key. The server validates it. API keys are meant for server-to-server or trusted client contexts — they are NOT secret tokens (they're visible in browser code).
- **Write vs Read Keys:** Customers can generate separate keys for write (tracker) and read (dashboard) access.
- **Rate Limiting:** The server middleware includes configurable rate limiting per IP and per API key.
- **Input Validation:** All event payloads are validated (max property size, max properties count, allowed event name patterns). Rejects malformed data before it hits the DB.
- **No Raw SQL:** The query engine never accepts raw SQL. Queries are structured objects that get translated to parameterized queries.

## Scalability Considerations

| Scale | Recommended Setup |
|-------|-------------------|
| Small (< 10K events/day) | SQLite adapter, single server |
| Medium (10K–1M events/day) | Postgres adapter, connection pooling |
| Large (1M+ events/day) | ClickHouse adapter, separate ingestion workers, read replicas |

The adapter pattern means customers can start with SQLite for development, move to Postgres for production, and migrate to ClickHouse if they hit scale — without changing application code.
