# Trackpaw Roadmap

Future plans for the Trackpaw analytics platform.

## Planned

### Framework Packages
- **`@trackpaw/next`** — Next.js plugin with automatic API route setup, App Router integration, and server-side tracking
- **`@trackpaw/react`** — React hooks package (`useTracker`, `useAnalytics`, `<TrackEvent>` component)
- **`@trackpaw/vue`** — Vue 3 plugin with router integration and composables

### Database Adapters
- **MongoDB adapter** — Using aggregation pipelines for analytical queries
- **DynamoDB adapter** — For AWS-native deployments
- **Turso/LibSQL adapter** — Edge-compatible SQLite

### Infrastructure
- **Redis-backed rate limiter** — For multi-instance deployments behind a load balancer
- **Async ingestion worker** — Queue-based ingestion (Redis/SQS) for high-throughput decoupling
- **Prometheus metrics exporter** — `/metrics` endpoint for Grafana dashboards

### Dashboard Enhancements
- **Saved reports** — Persist dashboard queries for reuse
- **Custom dashboards** — Drag-and-drop layout builder
- **Alerting** — Threshold-based alerts (e.g., "notify if sign-ups drop 50%")
- **A/B testing view** — Experiment analysis with statistical significance

### Developer Experience
- **`npx create-trackpaw`** — CLI scaffolding tool for new projects
- **TypeDoc API reference site** — Auto-generated from source
- **Storybook** — Visual component development for dashboard

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for how to get involved. Feature requests are welcome via [GitHub Issues](https://github.com/arponsd/trackpaw/issues).
