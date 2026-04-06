# Query Engine Deep Dive

## Overview

The query engine is the brain of the analytics system. It takes structured query objects from the dashboard or API, translates them into optimized SQL for the active database adapter, and returns formatted results.

The engine NEVER accepts raw SQL. All queries are structured TypeScript objects with strict validation.

## Architecture

```
Dashboard / API Request
        │
        ▼
┌──────────────────────┐
│   Query Validator     │  Validates query shape, date ranges,
│                       │  event names, filter operators.
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│   Query Planner       │  Determines execution strategy:
│                       │  - Single query vs multi-step
│                       │  - Subquery needs
│                       │  - Index hints for adapter
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│   SQL Generator       │  Adapter-specific SQL generation.
│   (per adapter)       │  Uses parameterized queries only.
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│   Executor            │  Runs query via adapter's connection.
│                       │  Handles timeouts and cancellation.
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│   Result Formatter    │  Transforms raw DB rows into the
│                       │  standard result shape for each
│                       │  query type.
└──────────────────────┘
```

## SQL Generation Examples

### Trends — Daily Event Counts (Postgres)

**Input:**
```json
{
  "type": "trends",
  "events": [{ "name": "Sign Up", "aggregation": "total" }],
  "interval": "day",
  "dateRange": { "preset": "7d" }
}
```

**Generated SQL:**
```sql
SELECT
  date_trunc('day', timestamp) AS bucket,
  COUNT(*) AS value
FROM tp_events
WHERE event_name = $1
  AND timestamp >= $2
  AND timestamp < $3
GROUP BY bucket
ORDER BY bucket ASC;

-- Params: ['Sign Up', '2025-06-08T00:00:00Z', '2025-06-15T00:00:00Z']
```

### Trends — Unique Users With Group-By (Postgres)

**Input:**
```json
{
  "type": "trends",
  "events": [{ "name": "Purchase", "aggregation": "unique_users" }],
  "interval": "week",
  "dateRange": { "preset": "30d" },
  "groupBy": "properties.plan"
}
```

**Generated SQL:**
```sql
SELECT
  date_trunc('week', timestamp) AS bucket,
  properties->>'plan' AS group_value,
  COUNT(DISTINCT COALESCE(user_id, anonymous_id)) AS value
FROM tp_events
WHERE event_name = $1
  AND timestamp >= $2
  AND timestamp < $3
GROUP BY bucket, group_value
ORDER BY bucket ASC, value DESC;
```

### Funnel (Postgres)

**Input:**
```json
{
  "type": "funnel",
  "steps": [
    { "event": "Page View" },
    { "event": "Sign Up" },
    { "event": "Purchase" }
  ],
  "dateRange": { "preset": "7d" },
  "conversionWindow": 86400
}
```

**Generated SQL (using window functions):**
```sql
WITH user_events AS (
  SELECT
    COALESCE(user_id, anonymous_id) AS uid,
    event_name,
    timestamp,
    ROW_NUMBER() OVER (
      PARTITION BY COALESCE(user_id, anonymous_id), event_name
      ORDER BY timestamp
    ) AS event_rank
  FROM tp_events
  WHERE event_name IN ($1, $2, $3)
    AND timestamp >= $4
    AND timestamp < $5
),
step1 AS (
  SELECT uid, MIN(timestamp) AS ts
  FROM user_events WHERE event_name = $1 AND event_rank = 1
  GROUP BY uid
),
step2 AS (
  SELECT ue.uid, MIN(ue.timestamp) AS ts
  FROM user_events ue
  INNER JOIN step1 s1 ON ue.uid = s1.uid
  WHERE ue.event_name = $2
    AND ue.timestamp > s1.ts
    AND ue.timestamp <= s1.ts + INTERVAL '86400 seconds'
  GROUP BY ue.uid
),
step3 AS (
  SELECT ue.uid, MIN(ue.timestamp) AS ts
  FROM user_events ue
  INNER JOIN step1 s1 ON ue.uid = s1.uid
  INNER JOIN step2 s2 ON ue.uid = s2.uid
  WHERE ue.event_name = $3
    AND ue.timestamp > s2.ts
    AND ue.timestamp <= s1.ts + INTERVAL '86400 seconds'
  GROUP BY ue.uid
)
SELECT
  (SELECT COUNT(*) FROM step1) AS step1_count,
  (SELECT COUNT(*) FROM step2) AS step2_count,
  (SELECT COUNT(*) FROM step3) AS step3_count,
  (SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM s2.ts - s1.ts))
   FROM step2 s2 JOIN step1 s1 ON s2.uid = s1.uid) AS median_time_1_2,
  (SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM s3.ts - s2.ts))
   FROM step3 s3 JOIN step2 s2 ON s3.uid = s2.uid) AS median_time_2_3;
```

### Retention (Postgres)

**Input:**
```json
{
  "type": "retention",
  "startEvent": "Sign Up",
  "returnEvent": "Login",
  "interval": "week",
  "periods": 4,
  "dateRange": { "start": "2025-05-01", "end": "2025-06-01" }
}
```

**Generated SQL:**
```sql
WITH cohorts AS (
  SELECT
    COALESCE(user_id, anonymous_id) AS uid,
    date_trunc('week', MIN(timestamp)) AS cohort_week
  FROM tp_events
  WHERE event_name = $1
    AND timestamp >= $2
    AND timestamp < $3
  GROUP BY uid
),
returns AS (
  SELECT
    COALESCE(e.user_id, e.anonymous_id) AS uid,
    c.cohort_week,
    FLOOR(EXTRACT(EPOCH FROM (date_trunc('week', e.timestamp) - c.cohort_week)) / 604800)::int AS period
  FROM tp_events e
  INNER JOIN cohorts c ON COALESCE(e.user_id, e.anonymous_id) = c.uid
  WHERE e.event_name = $4
    AND e.timestamp >= c.cohort_week
    AND FLOOR(EXTRACT(EPOCH FROM (date_trunc('week', e.timestamp) - c.cohort_week)) / 604800)::int <= $5
)
SELECT
  c.cohort_week,
  COUNT(DISTINCT c.uid) AS cohort_size,
  r.period,
  COUNT(DISTINCT r.uid) AS returned_count
FROM cohorts c
LEFT JOIN returns r ON c.cohort_week = r.cohort_week
GROUP BY c.cohort_week, r.period
ORDER BY c.cohort_week, r.period;
```

## Adapter-Specific Differences

| Feature | Postgres | MySQL | SQLite | ClickHouse |
|---------|----------|-------|--------|------------|
| JSON access | `properties->>'key'` | `JSON_EXTRACT(properties, '$.key')` | `json_extract(properties, '$.key')` | `JSONExtractString(properties, 'key')` |
| Date truncation | `date_trunc('day', ts)` | `DATE(ts)` | `date(ts)` | `toStartOfDay(ts)` |
| Percentile | `PERCENTILE_CONT` | approx via subquery | not supported (use app-level) | `quantile(0.5)` |
| Batch insert | `INSERT ... VALUES` or `COPY` | `INSERT ... VALUES` | `INSERT ... VALUES` (in transaction) | Async insert buffer |
| UUID generation | `gen_random_uuid()` | `UUID()` | app-generated | `generateUUIDv4()` |

## Query Validation Rules

Before any SQL is generated:

1. **Date ranges** must not exceed 365 days
2. **Event names** must exist in the database (optional strict mode)
3. **Filter operators** must be from the allowed set
4. **Property keys** must not contain SQL injection patterns (additional layer beyond parameterization)
5. **Funnel steps** must be between 2 and 10
6. **Retention periods** must be between 1 and 52
7. **Limit** must not exceed 10,000
8. **Group-by** is limited to 1 property per query

## Query Timeouts

All queries have a configurable timeout (default: 30 seconds). If a query exceeds the timeout, the adapter cancels the database query and returns:

```json
{
  "error": "QUERY_TIMEOUT",
  "message": "Query exceeded 30s timeout. Try a narrower date range or fewer events.",
  "status": 408
}
```

## Caching Strategy

The query engine includes an optional in-memory LRU cache:

```typescript
const analytics = createAnalyticsServer({
  adapter: new PostgresAdapter({ ... }),
  queryCache: {
    enabled: true,
    maxSize: 100,           // Max cached queries
    ttlSeconds: 60,         // Cache TTL
    excludeTypes: ['event_stream'],  // Don't cache real-time data
  },
});
```

Cache key = hash of the full query object. Invalidated on TTL expiry or when new events are ingested (optional).
