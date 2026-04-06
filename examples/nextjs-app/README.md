# Trackpaw — Next.js Example

A Next.js App Router integration with the full Trackpaw stack: tracker SDK, analytics server, and embedded dashboard.

## Quick Start

```bash
# From the monorepo root
pnpm install
pnpm build

# Run the example
cd examples/nextjs-app
pnpm dev
```

Open http://localhost:3000 to see the demo.

## What's Included

- **`lib/analytics.ts`** — Client-side tracker singleton
- **`lib/analytics-server.ts`** — Server-side analytics setup with SQLite
- **`components/AnalyticsProvider.tsx`** — Automatic page view tracking on route changes
- **`app/page.tsx`** — Demo page with event tracking buttons
- **`app/admin/analytics/page.tsx`** — Embedded `<AnalyticsDashboard />` component
- **`app/api/analytics/[...path]/route.ts`** — API route forwarding to Trackpaw server

## Architecture

```
Browser                         Next.js Server
  |                                  |
  |-- tracker.track() ------------> /api/analytics/v1/events/batch
  |-- tracker.page()  ------------> /api/analytics/v1/events/batch
  |-- <AnalyticsDashboard /> -----> /api/analytics/v1/query
  |                                  |
  |                           SQLite (analytics.db)
```
