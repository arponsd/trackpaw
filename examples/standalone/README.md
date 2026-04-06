# Trackpaw — Standalone Demo

A zero-config standalone analytics server with SQLite and pre-seeded demo data.

## Quick Start

```bash
# From the monorepo root
pnpm install
pnpm build

# Run the demo (seeds data + starts server)
cd examples/standalone
pnpm demo
```

The server runs at http://localhost:4000.

## Try It

```bash
# Health check
curl http://localhost:4000/v1/health

# View metadata
curl http://localhost:4000/v1/metadata -H "X-API-Key: demo-key"

# Query trends
curl -X POST http://localhost:4000/v1/query \
  -H "Content-Type: application/json" \
  -H "X-API-Key: demo-key" \
  -d '{"type":"trends","events":[{"name":"Sign Up"}],"interval":"day","dateRange":{"preset":"30d"}}'

# View event stream
curl "http://localhost:4000/v1/events/stream?api_key=demo-key&limit=5"

# View users
curl "http://localhost:4000/v1/users?api_key=demo-key"
```

## Seed Data

The seed script generates ~1,000 events across 31 days with 5 demo users and 6 event types. Run it again to add more data:

```bash
pnpm seed
```

## What's Included

- **`server.js`** — Express server with SQLite adapter
- **`scripts/seed.js`** — Generates realistic demo data
- **`demo-analytics.db`** — Created automatically on first run
