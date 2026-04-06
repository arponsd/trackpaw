---
"@trackpaw/tracker": minor
"@trackpaw/server": minor
"@trackpaw/dashboard": minor
---

Initial release of Trackpaw — a self-hosted, privacy-first analytics platform.

### @trackpaw/tracker (v0.1.0)
- Zero-dependency client-side SDK (under 5KB gzipped)
- Event tracking, page views, user identification
- Batched event queue with localStorage persistence
- Auto-capture: page views, clicks, forms
- Consent management (opt-in/opt-out, DNT support)
- ESM, CJS, and UMD build targets

### @trackpaw/server (v0.1.0)
- Event ingestion API with validation and enrichment pipeline
- Query engine: trends, funnels, retention, event stream, user list, segments
- Database adapters: SQLite, PostgreSQL, MySQL, ClickHouse
- Express.js router with auth, rate limiting, CORS middleware
- Privacy: IP anonymization, PII scrubbing, GDPR delete/export
- `createAnalyticsServer()` factory function

### @trackpaw/dashboard (v0.1.0)
- Embeddable React analytics dashboard (`<AnalyticsDashboard />`)
- 7 views: Overview, Trends, Funnels, Retention, Event Stream, Users, User Profile
- Charts: LineChart, BarChart, FunnelChart, RetentionGrid (Recharts)
- Light/dark/system theme with customizable accent color
- Individual component exports for custom dashboard compositions
- TanStack Query for data fetching with caching
