# REST API Reference

## Overview

All endpoints are mounted under the path where the customer mounts the analytics router (e.g., `/analytics`). All endpoints except health check require an API key via the `X-API-Key` header.

**Base URL:** `{mountPath}/v1`

## Authentication

```
X-API-Key: <your-api-key>
```

Or as a query parameter:

```
?api_key=<your-api-key>
```

## Endpoints

---

### Health Check

```
GET /v1/health
```

No authentication required.

**Response:**

```json
{
  "status": "ok",
  "version": "1.2.0",
  "adapter": "postgres",
  "uptime": 3600,
  "database": {
    "connected": true,
    "latencyMs": 2
  }
}
```

---

### Ingest Events (Batch)

```
POST /v1/events/batch
```

**Permission:** `write`

**Request Body:**

```json
{
  "batch": [
    {
      "event": "Button Clicked",
      "properties": {
        "button_id": "cta_signup",
        "page": "/pricing"
      },
      "timestamp": "2025-06-15T10:30:00.000Z",
      "userId": "user_123",
      "anonymousId": "anon_abc",
      "sessionId": "sess_xyz",
      "context": {
        "page": {
          "url": "https://myapp.com/pricing",
          "title": "Pricing - MyApp",
          "referrer": "https://google.com"
        },
        "browser": "Chrome",
        "os": "macOS",
        "deviceType": "desktop"
      }
    }
  ],
  "sentAt": "2025-06-15T10:30:05.000Z"
}
```

**Response (200):**

```json
{
  "success": true,
  "inserted": 1,
  "failed": 0,
  "errors": []
}
```

**Response (400 — validation errors):**

```json
{
  "success": false,
  "inserted": 0,
  "failed": 1,
  "errors": [
    {
      "index": 0,
      "code": "INVALID_EVENT_NAME",
      "message": "Event name exceeds 256 characters"
    }
  ]
}
```

---

### Identify User

```
POST /v1/identify
```

**Permission:** `write`

**Request Body:**

```json
{
  "userId": "user_123",
  "anonymousId": "anon_abc",
  "traits": {
    "name": "Alice Johnson",
    "email": "alice@example.com",
    "plan": "pro",
    "company": "Acme Inc"
  }
}
```

**Response (200):**

```json
{
  "success": true,
  "userId": "user_123",
  "isNewUser": false
}
```

---

### Query Analytics

```
POST /v1/query
```

**Permission:** `read`

The unified query endpoint. The `type` field determines which query engine is invoked.

#### Trends Query

**Request:**

```json
{
  "type": "trends",
  "events": [
    {
      "name": "Sign Up",
      "aggregation": "unique_users"
    },
    {
      "name": "Purchase",
      "aggregation": "total"
    }
  ],
  "interval": "day",
  "dateRange": { "preset": "30d" },
  "groupBy": "properties.plan"
}
```

**Response:**

```json
{
  "type": "trends",
  "series": [
    {
      "event": "Sign Up",
      "groupValue": "free",
      "data": [
        { "date": "2025-05-16", "value": 45 },
        { "date": "2025-05-17", "value": 52 }
      ],
      "total": 1423
    },
    {
      "event": "Sign Up",
      "groupValue": "pro",
      "data": [
        { "date": "2025-05-16", "value": 12 },
        { "date": "2025-05-17", "value": 15 }
      ],
      "total": 387
    }
  ],
  "dateRange": {
    "start": "2025-05-16",
    "end": "2025-06-15"
  },
  "queryTimeMs": 45
}
```

#### Funnel Query

**Request:**

```json
{
  "type": "funnel",
  "steps": [
    { "event": "Page View", "filters": [{ "key": "page", "operator": "eq", "value": "/pricing" }] },
    { "event": "Sign Up" },
    { "event": "Purchase" }
  ],
  "dateRange": { "preset": "7d" },
  "conversionWindow": 86400,
  "countType": "unique_users"
}
```

**Response:**

```json
{
  "type": "funnel",
  "steps": [
    { "event": "Page View", "count": 1200, "conversionRate": 100, "overallRate": 100, "dropoff": 0 },
    { "event": "Sign Up", "count": 180, "conversionRate": 15.0, "overallRate": 15.0, "dropoff": 1020, "medianTimeBetween": 340 },
    { "event": "Purchase", "count": 45, "conversionRate": 25.0, "overallRate": 3.75, "dropoff": 135, "medianTimeBetween": 7200 }
  ],
  "queryTimeMs": 120
}
```

#### Retention Query

**Request:**

```json
{
  "type": "retention",
  "startEvent": "Sign Up",
  "returnEvent": "Login",
  "dateRange": { "start": "2025-05-01", "end": "2025-06-01" },
  "interval": "week",
  "periods": 4
}
```

**Response:**

```json
{
  "type": "retention",
  "cohorts": [
    {
      "date": "2025-05-05",
      "cohortSize": 150,
      "retention": [
        { "period": 0, "count": 150, "percentage": 100 },
        { "period": 1, "count": 60, "percentage": 40 },
        { "period": 2, "count": 38, "percentage": 25.3 },
        { "period": 3, "count": 30, "percentage": 20 }
      ]
    },
    {
      "date": "2025-05-12",
      "cohortSize": 180,
      "retention": [
        { "period": 0, "count": 180, "percentage": 100 },
        { "period": 1, "count": 78, "percentage": 43.3 },
        { "period": 2, "count": 52, "percentage": 28.9 }
      ]
    }
  ],
  "queryTimeMs": 200
}
```

---

### Event Stream

```
GET /v1/events/stream
```

**Permission:** `read`

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | int | 50 | Max events to return (1–200) |
| `offset` | int | 0 | Pagination offset |
| `event` | string | — | Filter by event name (comma-separated for multiple) |
| `user_id` | string | — | Filter by user ID |
| `session_id` | string | — | Filter by session ID |
| `from` | ISO date | — | Start of date range |
| `to` | ISO date | — | End of date range |
| `order` | string | desc | `asc` or `desc` by timestamp |

**Response:**

```json
{
  "events": [
    {
      "id": "evt_abc123",
      "event": "Purchase",
      "userId": "user_123",
      "anonymousId": "anon_abc",
      "sessionId": "sess_xyz",
      "properties": { "amount": 49.99, "plan": "pro" },
      "timestamp": "2025-06-15T10:30:00Z",
      "context": { "browser": "Chrome", "os": "macOS", "deviceType": "desktop" }
    }
  ],
  "total": 15420,
  "limit": 50,
  "offset": 0
}
```

---

### User List

```
GET /v1/users
```

**Permission:** `read`

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | int | 50 | Max users (1–200) |
| `offset` | int | 0 | Pagination offset |
| `search` | string | — | Search user_id or traits |
| `sort` | string | last_seen | `last_seen`, `first_seen`, `total_events` |
| `order` | string | desc | `asc` or `desc` |

---

### User Profile

```
GET /v1/users/:userId
```

**Permission:** `read`

**Response:**

```json
{
  "userId": "user_123",
  "traits": { "name": "Alice", "email": "alice@example.com", "plan": "pro" },
  "firstSeen": "2025-01-10T08:00:00Z",
  "lastSeen": "2025-06-15T10:30:00Z",
  "totalEvents": 482,
  "totalSessions": 45,
  "recentEvents": [
    { "event": "Purchase", "timestamp": "2025-06-15T10:30:00Z", "properties": {} }
  ]
}
```

---

### Delete User (GDPR)

```
DELETE /v1/users/:userId
```

**Permission:** `admin`

Deletes all events, sessions, and profile data for the user.

**Response:**

```json
{
  "success": true,
  "deleted": {
    "events": 482,
    "sessions": 45,
    "userProfile": true
  }
}
```

---

### Export User Data (GDPR)

```
GET /v1/users/:userId/export
```

**Permission:** `admin`

Returns all data associated with the user as a JSON download.

---

### Metadata

```
GET /v1/metadata
```

**Permission:** `read`

**Response:**

```json
{
  "eventNames": ["Page View", "Sign Up", "Purchase", "Button Clicked"],
  "eventCount": 154200,
  "userCount": 3200,
  "sessionCount": 18500,
  "dateRange": {
    "earliest": "2025-01-01T00:00:00Z",
    "latest": "2025-06-15T10:30:00Z"
  },
  "properties": {
    "Page View": ["page", "referrer", "title"],
    "Purchase": ["amount", "plan", "currency"]
  }
}
```

---

### Event Properties

```
GET /v1/metadata/events/:eventName/properties
```

**Permission:** `read`

Returns property keys and sample values for a specific event.

**Response:**

```json
{
  "eventName": "Purchase",
  "properties": [
    { "key": "amount", "type": "number", "sampleValues": [9.99, 29.99, 49.99] },
    { "key": "plan", "type": "string", "sampleValues": ["free", "pro", "enterprise"] },
    { "key": "currency", "type": "string", "sampleValues": ["USD", "EUR"] }
  ]
}
```

---

## Rate Limiting

When rate limited, the API returns:

```
HTTP 429 Too Many Requests
Retry-After: 30

{
  "error": "RATE_LIMITED",
  "message": "Too many requests. Try again in 30 seconds.",
  "retryAfter": 30
}
```

## Versioning

The API is versioned via URL path (`/v1/`). Breaking changes will increment the version. Non-breaking additions (new fields, new endpoints) do not change the version.
