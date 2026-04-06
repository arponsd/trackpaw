# Adapter Pattern

## Overview

The adapter pattern is the backbone of Trackpaw's database flexibility. It defines a contract (`StorageAdapter`) that each database implementation must fulfill. The query engine and ingestion layer talk ONLY to this interface — they never write raw SQL or database-specific code.

## StorageAdapter Interface

```typescript
// packages/server/src/adapters/types.ts

export interface StorageAdapter {
  /** Database engine identifier */
  readonly engine: 'postgres' | 'mysql' | 'sqlite' | 'clickhouse' | 'custom';

  /** Connection & Setup */
  initialize(): Promise<void>;
  disconnect(): Promise<void>;
  healthCheck(): Promise<{ ok: boolean; latencyMs: number }>;
  runMigrations(): Promise<MigrationResult[]>;

  /** Event Ingestion */
  insertEvents(events: ValidatedEvent[]): Promise<InsertResult>;
  
  /** User Management */
  upsertUser(userId: string, traits: Record<string, any>, anonymousId?: string): Promise<void>;
  getUserProfile(userId: string): Promise<UserProfile | null>;
  getUsersByAnonymousId(anonymousId: string): Promise<UserProfile[]>;
  deleteUser(userId: string): Promise<DeleteResult>;  // GDPR right to erasure
  
  /** Session Management */
  upsertSession(session: SessionUpdate): Promise<void>;
  
  /** Query Engine Interface */
  queryTrends(query: TrendsQuery): Promise<TrendsResult>;
  queryFunnel(query: FunnelQuery): Promise<FunnelResult>;
  queryRetention(query: RetentionQuery): Promise<RetentionResult>;
  queryEventStream(query: EventStreamQuery): Promise<EventStreamResult>;
  queryUserList(query: UserListQuery): Promise<UserListResult>;
  querySegment(query: SegmentQuery): Promise<SegmentResult>;
  
  /** Metadata */
  getEventNames(options?: { limit?: number; search?: string }): Promise<string[]>;
  getEventProperties(eventName: string): Promise<PropertyDefinition[]>;
  getEventCount(range?: DateRange): Promise<number>;
  getUserCount(range?: DateRange): Promise<number>;
  
  /** Maintenance */
  runRetentionCleanup(policy: RetentionPolicy): Promise<CleanupResult>;
}
```

## Implementing a Custom Adapter

Customers can write their own adapter for unsupported databases:

```typescript
import { StorageAdapter, ValidatedEvent, TrendsQuery, TrendsResult } from '@trackpaw/server';

export class MongoAdapter implements StorageAdapter {
  readonly engine = 'custom' as const;
  private client: MongoClient;

  constructor(private config: { uri: string; dbName: string }) {}

  async initialize(): Promise<void> {
    this.client = await MongoClient.connect(this.config.uri);
    const db = this.client.db(this.config.dbName);
    
    // Create collections and indexes
    await db.createCollection('tp_events');
    await db.collection('tp_events').createIndex({ event_name: 1, timestamp: -1 });
    await db.collection('tp_events').createIndex({ user_id: 1, timestamp: -1 });
  }

  async insertEvents(events: ValidatedEvent[]): Promise<InsertResult> {
    const db = this.client.db(this.config.dbName);
    const result = await db.collection('tp_events').insertMany(events);
    return { inserted: result.insertedCount, failed: 0 };
  }

  async queryTrends(query: TrendsQuery): Promise<TrendsResult> {
    // Translate TrendsQuery into MongoDB aggregation pipeline
    const pipeline = this.buildTrendsPipeline(query);
    const results = await db.collection('tp_events').aggregate(pipeline).toArray();
    return this.formatTrendsResult(results, query);
  }

  // ... implement remaining interface methods
}
```

Register it:

```typescript
const analytics = createAnalyticsServer({
  adapter: new MongoAdapter({ uri: 'mongodb://localhost', dbName: 'analytics' }),
  apiKey: 'my-key',
});
```

## Built-in Adapters

### PostgresAdapter

**Best for:** Production workloads, 10K–1M events/day.

```typescript
import { PostgresAdapter } from '@trackpaw/server/adapters';

const adapter = new PostgresAdapter({
  connectionString: 'postgresql://user:pass@localhost:5432/analytics',
  // OR individual fields:
  host: 'localhost',
  port: 5432,
  database: 'analytics',
  user: 'analytics_user',
  password: 'secret',
  
  // Connection pool
  pool: {
    min: 2,
    max: 10,
    idleTimeoutMs: 30000,
  },
  
  // Schema (allows running in a dedicated schema)
  schema: 'trackpaw',  // default: 'public'
  
  // Data retention
  retention: {
    events: '365d',
    sessions: '365d',
    users: 'forever',
  },
});
```

**Postgres-specific optimizations:**
- Uses `JSONB` for properties with GIN indexes for fast property queries
- Batch inserts via `COPY` for high-throughput ingestion
- Uses `date_trunc()` for time-bucketed aggregations
- Supports `BRIN` indexes on timestamp columns for range scans

### SQLiteAdapter

**Best for:** Development, testing, small projects (< 10K events/day).

```typescript
import { SQLiteAdapter } from '@trackpaw/server/adapters';

const adapter = new SQLiteAdapter({
  filename: './analytics.db',  // File path
  // OR
  filename: ':memory:',        // In-memory (for testing)
  
  // WAL mode for concurrent reads (enabled by default)
  walMode: true,
  
  retention: {
    events: '90d',
    sessions: '90d',
    users: 'forever',
  },
});
```

**SQLite-specific considerations:**
- Properties stored as JSON text (uses `json_extract()` for queries)
- Single-writer limitation — ingestion is serialized
- No concurrent write connections — uses a write queue internally
- Perfect for single-server deployments and development

### MySQLAdapter

**Best for:** Teams already running MySQL, moderate scale.

```typescript
import { MySQLAdapter } from '@trackpaw/server/adapters';

const adapter = new MySQLAdapter({
  host: 'localhost',
  port: 3306,
  database: 'analytics',
  user: 'analytics_user',
  password: 'secret',
  
  pool: { min: 2, max: 10 },
  
  // Use JSON column type (MySQL 5.7+)
  jsonSupport: true,  // default: true
});
```

### ClickHouseAdapter

**Best for:** High-volume production (1M+ events/day), analytical queries.

```typescript
import { ClickHouseAdapter } from '@trackpaw/server/adapters';

const adapter = new ClickHouseAdapter({
  url: 'http://localhost:8123',
  database: 'analytics',
  username: 'default',
  password: '',
  
  // ClickHouse-specific
  engine: 'MergeTree',
  partitionBy: 'toYYYYMM(timestamp)',
  ttl: '365 DAY',  // Auto-delete old data
  
  // Async insert for high throughput
  asyncInsert: true,
  asyncInsertMaxDataSize: '10000000',  // 10MB buffer
});
```

**ClickHouse-specific optimizations:**
- Uses `MergeTree` engine with monthly partitioning
- `ORDER BY (event_name, timestamp, user_id)` for fast analytical queries
- Async inserts for high-throughput ingestion
- Native `TTL` for data retention
- Uses `JSONExtract` functions for property queries

## Adapter Testing

Every adapter must pass a shared test suite:

```typescript
// packages/server/src/adapters/__tests__/adapter-conformance.ts

export function runAdapterConformanceTests(
  createAdapter: () => Promise<StorageAdapter>,
  cleanupAdapter: (adapter: StorageAdapter) => Promise<void>
) {
  describe('StorageAdapter Conformance', () => {
    let adapter: StorageAdapter;

    beforeEach(async () => { adapter = await createAdapter(); });
    afterEach(async () => { await cleanupAdapter(adapter); });

    test('initialize creates required tables', async () => { /* ... */ });
    test('insertEvents stores and returns correct count', async () => { /* ... */ });
    test('upsertUser creates and updates user profiles', async () => { /* ... */ });
    test('queryTrends returns correct daily counts', async () => { /* ... */ });
    test('queryFunnel calculates conversion rates', async () => { /* ... */ });
    test('queryRetention builds correct cohort grid', async () => { /* ... */ });
    test('deleteUser removes all user data (GDPR)', async () => { /* ... */ });
    // ... 30+ conformance tests
  });
}
```

Usage in adapter-specific test file:

```typescript
// packages/server/src/adapters/__tests__/postgres.test.ts
import { PostgresAdapter } from '../postgres';
import { runAdapterConformanceTests } from './adapter-conformance';

runAdapterConformanceTests(
  async () => {
    const adapter = new PostgresAdapter({ connectionString: process.env.TEST_PG_URL });
    await adapter.initialize();
    return adapter;
  },
  async (adapter) => {
    // Drop all tables, disconnect
    await adapter.disconnect();
  }
);
```
