# Trackpaw — Express.js Example

A full Express.js integration demonstrating the tracker SDK, analytics server, and event tracking.

## Quick Start

```bash
# From the monorepo root
pnpm install
pnpm build

# Run the example
cd examples/express-app
pnpm start
```

Open http://localhost:3000 to see the demo.

## What's Included

- **`server.js`** — Express server with `@trackpaw/server` mounted at `/analytics`
- **`public/index.html`** — Demo page with tracker SDK, custom event buttons, identity management
- **`public/pricing.html`** — Second page demonstrating cross-page tracking
- **`docker-compose.yml`** — Optional Postgres setup (default uses SQLite)

## Using Postgres Instead of SQLite

```bash
docker compose up -d
DATABASE_URL=postgresql://analytics:secret@localhost:5432/analytics pnpm start
```

Then update `server.js` to use `PostgresAdapter` instead of `SQLiteAdapter`.

## API Endpoints

Once running, these endpoints are available:

- `GET /analytics/v1/health` — Health check
- `POST /analytics/v1/events/batch` — Ingest events
- `POST /analytics/v1/query` — Query analytics
- `GET /analytics/v1/metadata` — Event metadata
