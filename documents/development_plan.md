# Trackpaw — Development Plan

> Phase-by-phase roadmap to build and publish the Trackpaw self-hosted analytics platform as npm packages.

---

## Phase 1: Monorepo Foundation & Shared Types

**Goal:** Set up the monorepo infrastructure, tooling, and the internal shared types package.

### 1.1 — Repository & Workspace Setup
- [ ] Initialize git repository
- [ ] Create root `package.json` with `name: "trackpaw"` (private: true)
- [ ] Install and configure **pnpm** as the package manager
- [ ] Create `pnpm-workspace.yaml` defining `packages/*` and `examples/*`
- [ ] Install and configure **Turborepo** (`turbo.json`) with pipelines: `build`, `test`, `lint`, `typecheck`, `dev`

### 1.2 — TypeScript Configuration
- [ ] Create `tsconfig.base.json` (target ES2022, strict mode, bundler module resolution)
- [ ] Configure `declaration`, `declarationMap`, `sourceMap`, `noUncheckedIndexedAccess`

### 1.3 — Code Quality Tooling
- [ ] Set up **ESLint** with TypeScript rules (shared config at root)
- [ ] Set up **Prettier** with shared config
- [ ] Add root scripts: `pnpm lint`, `pnpm format`, `pnpm typecheck`
- [ ] Set up **Husky** + **lint-staged** for pre-commit hooks

### 1.4 — Shared Types Package (`@trackpaw/types`)
- [ ] Create `packages/types/` directory structure
- [ ] Define core event interfaces: `TrackedEvent`, `RawEvent`, `ValidatedEvent`
- [ ] Define user interfaces: `UserProfile`, `SessionRecord`
- [ ] Define query interfaces: `TrendsQuery`, `FunnelQuery`, `RetentionQuery`, `SegmentQuery`, `EventStreamQuery`
- [ ] Define result interfaces: `TrendsResult`, `FunnelResult`, `RetentionResult`, `SegmentResult`, `EventStreamResult`
- [ ] Define filter types: `PropertyFilter`, `DateRange`, `GlobalFilter`
- [ ] Define error types: `AnalyticsError` with error codes
- [ ] Define configuration types: `AnalyticsServerConfig`, `TrackerConfig`
- [ ] Build with **tsup** (ESM + CJS + declarations)
- [ ] Write unit tests verifying type exports

### 1.5 — CI Pipeline (GitHub Actions)
- [ ] Create `.github/workflows/ci.yml`
- [ ] Test matrix: Node 18, 20, 22
- [ ] Jobs: install → build → typecheck → lint → test
- [ ] Add caching for pnpm store

**Deliverables:** Working monorepo with `pnpm build`, `pnpm test`, `pnpm lint` running across all packages. Shared types package compiles and exports all interfaces.

---

## Phase 2: Tracker SDK (`@trackpaw/tracker`)

**Goal:** Build the zero-dependency, browser + Node.js client SDK under 5KB gzipped.

### 2.1 — Package Scaffold
- [ ] Create `packages/tracker/` directory structure per spec
- [ ] Set up `package.json` with correct `main`, `module`, `types`, `browser`, `exports` fields
- [ ] Configure `tsup.config.ts` for ESM + CJS + UMD (IIFE with `globalName: 'trackpaw'`)
- [ ] Set up `tsconfig.json` extending base config
- [ ] Add `sideEffects: false` for tree-shaking

### 2.2 — Core Client
- [ ] Implement `Trackpaw` class with static `init()` factory method
- [ ] Implement configuration parsing with defaults (`config.ts`)
- [ ] Define constants: SDK version, default flush interval (5s), default queue size (10), session timeout (30min)
- [ ] Implement `track(eventName, properties)` method
- [ ] Implement `page(pageName, properties)` method
- [ ] Implement `identify(userId, traits)` method
- [ ] Implement `setUserProperties(traits)` method
- [ ] Implement `setSuperProperties(properties)` / `unsetSuperProperties(keys)`
- [ ] Implement `setOnce(properties)` for one-time properties
- [ ] Implement `timeEvent(eventName)` for timed events
- [ ] Implement `group(groupType, groupId, traits)` for group analytics
- [ ] Implement `reset()` to clear all local state
- [ ] Implement `shutdown()` to flush and stop timers
- [ ] Implement getter methods: `getAnonymousId()`, `getUserId()`, `getSessionId()`

### 2.3 — Identity Management
- [ ] Implement UUID v4 generation (no dependencies — custom implementation)
- [ ] Implement anonymous ID generation and storage (`localStorage` key: `tp_anonymous_id`)
- [ ] Implement session ID management (`sessionStorage`, regenerate after 30min inactivity)
- [ ] Implement identify flow: link `anonymousId` → `userId`, send identify event
- [ ] Implement activity tracking to reset session timeout timer

### 2.4 — Event Queue & Flush
- [ ] Implement in-memory event queue (`event-queue.ts`)
- [ ] Implement flush policy: timer (5s), queue size (10 events), page unload
- [ ] Implement `localStorage` persistence layer for queue survival across reloads
- [ ] Implement queue restoration on page load
- [ ] Implement max queue size (1000) with oldest-event-drop policy

### 2.5 — Transport Layer
- [ ] Define `Transport` interface
- [ ] Implement `FetchTransport` (default) — POST to `/v1/events/batch`
- [ ] Implement `BeaconTransport` — `navigator.sendBeacon` for page unload
- [ ] Implement `XHRTransport` — fallback for older environments
- [ ] Implement retry logic: exponential backoff (1s → 2s → 4s → 8s → 16s → give up)
- [ ] Add `X-API-Key` header to all requests
- [ ] Construct batch payload shape: `{ batch: [...events], sentAt: ISO8601 }`

### 2.6 — Context Enrichment
- [ ] Implement browser detection (browser name, version)
- [ ] Implement OS detection (OS name, version)
- [ ] Implement device type detection (desktop / mobile / tablet)
- [ ] Implement page context: URL, path, title, referrer
- [ ] Implement screen dimensions
- [ ] Implement locale and timezone detection
- [ ] Implement UTM parameter extraction from URL query string

### 2.7 — Auto-Capture
- [ ] Implement auto page view tracking (enabled by default)
- [ ] Implement SPA support: listen to `popstate` / `pushState` / `replaceState`
- [ ] Implement auto click tracking (opt-in, disabled by default)
- [ ] Implement auto form submission tracking (opt-in, disabled by default)
- [ ] Implement outbound link tracking (opt-in, disabled by default)

### 2.8 — Consent & Privacy
- [ ] Implement `optOut()` / `optIn()` / `hasOptedOut()` methods
- [ ] Implement `defaultOptOut` config option for opt-in consent mode
- [ ] Implement `respectDoNotTrack` option (honor browser DNT header)
- [ ] Implement `ipAnonymization` flag in event metadata
- [ ] Support `persistence: 'memory'` mode for zero-storage tracking

### 2.9 — UMD / Script Tag Support
- [ ] Ensure UMD build exposes `window.trackpaw` global
- [ ] Implement snippet-based init (like Google Analytics pattern)
- [ ] Test script tag usage in plain HTML

### 2.10 — Testing
- [ ] Unit tests for every module (queue, identity, transport, context, consent)
- [ ] Integration test: full init → track → flush → verify HTTP request payload
- [ ] Bundle size test: assert UMD gzipped < 5KB
- [ ] Add `pnpm size` script to check bundle size
- [ ] Test `localStorage` persistence and restoration
- [ ] Test `sendBeacon` fallback on page unload
- [ ] Test session timeout and renewal logic

**Deliverables:** `@trackpaw/tracker` package that can be installed via npm, initialized in browser or Node.js, and sends batched events to a configurable endpoint. Passes all unit and integration tests. UMD build under 5KB gzipped.

---

## Phase 3: Server Package — Core & Adapters (`@trackpaw/server`)

**Goal:** Build the ingestion API core, storage adapter interface, and the SQLite + Postgres adapters.

### 3.1 — Package Scaffold
- [ ] Create `packages/server/` directory structure per spec
- [ ] Set up `package.json` with dependencies: `knex` (query builder)
- [ ] Configure `tsup.config.ts` for ESM + CJS + declarations
- [ ] Set up `tsconfig.json` extending base config

### 3.2 — Storage Adapter Interface
- [ ] Define the full `StorageAdapter` interface in `adapters/types.ts`
- [ ] Define all method signatures: `initialize`, `disconnect`, `healthCheck`, `runMigrations`
- [ ] Define ingestion methods: `insertEvents`
- [ ] Define user methods: `upsertUser`, `getUserProfile`, `getUsersByAnonymousId`, `deleteUser`
- [ ] Define session methods: `upsertSession`
- [ ] Define query methods: `queryTrends`, `queryFunnel`, `queryRetention`, `queryEventStream`, `queryUserList`, `querySegment`
- [ ] Define metadata methods: `getEventNames`, `getEventProperties`, `getEventCount`, `getUserCount`
- [ ] Define maintenance methods: `runRetentionCleanup`
- [ ] Define supporting types: `InsertResult`, `DeleteResult`, `CleanupResult`, `MigrationResult`, `RetentionPolicy`

### 3.3 — SQLite Adapter (Development First)
- [ ] Implement `SQLiteAdapter` class using `better-sqlite3`
- [ ] Write migration files: `001_create_events`, `002_create_users`, `003_create_sessions`, `004_create_event_definitions`, `005_create_saved_queries`
- [ ] Implement auto-migration system with `tp_migrations` tracking table
- [ ] Implement `insertEvents` with transaction-wrapped batch insert
- [ ] Implement `upsertUser` with INSERT OR REPLACE
- [ ] Implement `upsertSession` with session update logic
- [ ] Implement `getUserProfile`, `getUsersByAnonymousId`
- [ ] Implement `deleteUser` (cascade delete events, sessions, profile)
- [ ] Implement `getEventNames`, `getEventProperties`, `getEventCount`, `getUserCount`
- [ ] Implement WAL mode support (default on)
- [ ] Implement internal write queue for serialized writes
- [ ] Implement in-memory mode (`:memory:`) for testing
- [ ] Implement retention cleanup with `DELETE WHERE timestamp < ?`

### 3.4 — Postgres Adapter
- [ ] Implement `PostgresAdapter` class using `knex` + `pg`
- [ ] Write Postgres-specific migration files (JSONB columns, GIN indexes, BRIN indexes)
- [ ] Implement connection pooling configuration (min, max, idleTimeout)
- [ ] Implement `insertEvents` with batch INSERT (and optional COPY for high throughput)
- [ ] Implement all user, session, and metadata methods
- [ ] Implement `deleteUser` with cascading deletes
- [ ] Implement schema support (`schema: 'trackpaw'`)
- [ ] Implement retention cleanup with scheduled deletion

### 3.5 — Adapter Conformance Test Suite
- [ ] Create `adapter-conformance.ts` shared test harness
- [ ] Test: `initialize` creates required tables
- [ ] Test: `insertEvents` stores and returns correct count
- [ ] Test: `upsertUser` creates and updates profiles
- [ ] Test: `getUsersByAnonymousId` links anonymous to identified users
- [ ] Test: `queryTrends` returns correct daily/weekly/monthly counts
- [ ] Test: `queryFunnel` calculates conversion rates correctly
- [ ] Test: `queryRetention` builds correct cohort grid
- [ ] Test: `queryEventStream` with filters and pagination
- [ ] Test: `queryUserList` with search and sorting
- [ ] Test: `querySegment` with did/did_not conditions
- [ ] Test: `deleteUser` removes all user data (GDPR)
- [ ] Test: `runRetentionCleanup` deletes old data correctly
- [ ] Test: `healthCheck` returns connection status
- [ ] Run conformance suite against SQLite adapter
- [ ] Run conformance suite against Postgres adapter

### 3.6 — Event Processing Pipeline
- [ ] Implement `EventValidator`: validate event name length (256), property count (50), value size (8192), allowed/blocked event names
- [ ] Implement `EventEnricher`: parse User-Agent → browser/OS/device, normalize timestamps to UTC
- [ ] Implement `IdentityResolver`: link anonymous IDs to user IDs on identify calls
- [ ] Implement `SessionResolver`: find or create sessions, update `ended_at` and `event_count`
- [ ] Wire pipeline: validate → enrich → privacy → session → hooks → storage → post-hooks

### 3.7 — Privacy Layer
- [ ] Implement `IPAnonymizer`: zero last octet of IPv4, last 80 bits of IPv6
- [ ] Implement `PIIScrubber`: hash (SHA-256) or remove configured PII fields
- [ ] Implement GDPR handlers: `deleteUser`, `exportUserData`

### 3.8 — Analytics Core
- [ ] Implement `AnalyticsCore` class as the main orchestrator
- [ ] Implement `ingestEvents(events, context)` — runs full pipeline
- [ ] Implement `executeQuery(query)` — dispatches to query engine
- [ ] Implement `identifyUser(userId, traits, anonymousId)`
- [ ] Implement `getMetadata()` — returns event names, counts, date ranges
- [ ] Implement `deleteUser(userId)` — GDPR deletion
- [ ] Implement `exportUserData(userId)` — GDPR export
- [ ] Implement `runRetentionCleanup()`

**Deliverables:** `@trackpaw/server` core with two working adapters (SQLite + Postgres), full event ingestion pipeline, and passing conformance tests.

---

## Phase 4: Server Package — Query Engine & REST API

**Goal:** Build the query engine, HTTP layer, and middleware stack.

### 4.1 — Query Engine
- [ ] Implement `QueryValidator`: validate date ranges (max 365d), filter operators, funnel steps (2–10), retention periods (1–52), limits (max 10,000)
- [ ] Implement `TrendsQueryBuilder`: generate SQL for event counts/unique users over time intervals, with group-by and property filters
- [ ] Implement `FunnelQueryBuilder`: generate SQL with CTEs and window functions for multi-step conversion, median time between steps
- [ ] Implement `RetentionQueryBuilder`: generate SQL for cohort retention grids
- [ ] Implement `EventStreamQueryBuilder`: generate SQL for filtered, paginated raw events
- [ ] Implement `UserListQueryBuilder`: generate SQL for user search and sorting
- [ ] Implement `SegmentQueryBuilder`: generate SQL for behavioral segmentation (did/did_not conditions)
- [ ] Implement `ResultFormatter`: transform raw DB rows into typed result shapes
- [ ] Implement query timeouts (default 30s) with adapter-level cancellation
- [ ] Implement optional LRU query cache (configurable size, TTL, excluded types)

### 4.2 — Middleware Stack
- [ ] Implement `authMiddleware`: validate `X-API-Key` header or `?api_key` query param, resolve permission level (write/read/admin)
- [ ] Implement `rateLimiter`: in-memory sliding window, configurable per IP and per API key
- [ ] Implement `corsMiddleware`: configurable origin allowlist
- [ ] Implement `errorHandler`: catch all errors, return standard `AnalyticsError` JSON response
- [ ] Implement body parser configuration (JSON, max 1MB)

### 4.3 — REST API Routes (Express)
- [ ] `GET /v1/health` — health check (no auth)
- [ ] `POST /v1/events/batch` — batch event ingestion (write permission)
- [ ] `POST /v1/identify` — identify user (write permission)
- [ ] `POST /v1/query` — unified query endpoint (read permission)
- [ ] `GET /v1/events/stream` — event stream with filters and pagination (read permission)
- [ ] `GET /v1/users` — user list with search, sort, pagination (read permission)
- [ ] `GET /v1/users/:userId` — user profile detail (read permission)
- [ ] `DELETE /v1/users/:userId` — GDPR delete (admin permission)
- [ ] `GET /v1/users/:userId/export` — GDPR export (admin permission)
- [ ] `GET /v1/metadata` — event names, counts, date ranges (read permission)
- [ ] `GET /v1/metadata/events/:eventName/properties` — event property details (read permission)

### 4.4 — Framework Adapters
- [ ] Implement `createExpressRouter(core)` — Express router adapter
- [ ] Implement `createFastifyPlugin(core)` — Fastify plugin adapter
- [ ] Implement `createHonoApp(core)` — Hono app adapter

### 4.5 — Factory Function
- [ ] Implement `createAnalyticsServer(config)` — the main entry point
- [ ] Accept full config: adapter, apiKey/apiKeys, rateLimit, cors, privacy, validation, hooks, logger
- [ ] Return `AnalyticsServerInstance`: `{ router, fastifyPlugin, honoApp, core, migrate(), healthCheck(), shutdown() }`
- [ ] Wire all middleware, routes, and core together

### 4.6 — Server Testing
- [ ] Unit tests: validator, enricher, session resolver, each query builder
- [ ] Integration tests: full HTTP request → pipeline → SQLite → response cycle
- [ ] Test all REST API endpoints with supertest
- [ ] Test API key authentication (write vs read vs admin permissions)
- [ ] Test rate limiting behavior
- [ ] Test CORS headers
- [ ] Test error responses for all error codes
- [ ] Test query timeout behavior
- [ ] Security tests: SQL injection prevention, oversized payloads, invalid inputs

**Deliverables:** Complete server package with REST API, query engine, middleware, and framework adapters. Full test coverage for all endpoints and query types.

---

## Phase 5: Dashboard Package (`@trackpaw/dashboard`)

**Goal:** Build the embeddable React analytics UI.

### 5.1 — Package Scaffold
- [ ] Create `packages/dashboard/` directory structure per spec
- [ ] Set up `package.json` with peer deps (`react >= 18`, `react-dom >= 18`)
- [ ] Add dependencies: `recharts`, `@tanstack/react-query`
- [ ] Configure **tsup** for ESM + CJS + declarations
- [ ] Set up **TailwindCSS** configuration
- [ ] Set up **Storybook** for component development

### 5.2 — API Client & Providers
- [ ] Implement `AnalyticsAPIClient` class with typed methods for all server endpoints
- [ ] Implement `AnalyticsProvider` context — provides API client to all child components
- [ ] Implement `DateRangeContext` — global date range state shared across views
- [ ] Implement `ThemeContext` — theme tokens, light/dark mode, custom accent color
- [ ] Implement React Query hooks for all endpoints (`useTrendsQuery`, `useFunnelQuery`, `useRetentionQuery`, `useEventStream`, `useUserList`, `useUserProfile`, `useMetadata`)

### 5.3 — Shared Components
- [ ] `LoadingSpinner` — consistent loading indicator
- [ ] `EmptyState` — "no data" illustration with message
- [ ] `ErrorBoundary` — catch and display errors gracefully
- [ ] `Tooltip` — lightweight tooltip component

### 5.4 — Layout Components
- [ ] `Sidebar` — navigation with icons for each view
- [ ] `Header` — top bar with global date range picker and refresh button
- [ ] `PageShell` — page layout wrapper with title and actions area

### 5.5 — Filter Components
- [ ] `DateRangePicker` — preset buttons (24h, 7d, 14d, 30d, 90d) + custom date range
- [ ] `EventPicker` — autocomplete multi-select from API metadata
- [ ] `PropertyFilter` — add/remove filter rows with operator selection
- [ ] `IntervalPicker` — segmented control (Hour / Day / Week / Month)
- [ ] `GroupByPicker` — single-select property dropdown

### 5.6 — Chart Components
- [ ] `LineChart` — time-series line chart with Recharts (multi-series support)
- [ ] `BarChart` — grouped/stacked bar chart
- [ ] `FunnelChart` — horizontal funnel bars with conversion % and drop-off
- [ ] `RetentionGrid` — heatmap cohort table with color intensity
- [ ] `MetricCard` — single KPI card with value, label, and trend indicator
- [ ] `PieChart` — breakdown donut chart

### 5.7 — Data Components
- [ ] `DataTable` — sortable, paginated data table
- [ ] `EventRow` — expandable event row showing full properties JSON
- [ ] `UserRow` — user row with traits summary
- [ ] `Pagination` — page controls with total count

### 5.8 — View Pages
- [ ] **OverviewView** — 4 metric cards, 30d event trend line chart, top 10 events bar chart, recent events mini-list
- [ ] **TrendsView** — interactive trend builder: event picker, aggregation selector, interval picker, date range, property filters, group-by, line/bar chart toggle, data table
- [ ] **FunnelView** — funnel step builder (2–10 steps), conversion window selector, funnel chart visualization, drop-off indicators, median time between steps
- [ ] **RetentionView** — start/return event pickers, interval and period selectors, retention cohort heatmap grid
- [ ] **EventStreamView** — auto-refreshing event feed (5s polling), filters (event name, user ID, session ID), expandable rows, pagination
- [ ] **UserListView** — searchable user list, sort by last seen / first seen / total events, click-through to profile, CSV export
- [ ] **UserProfileView** — profile header with traits, activity timeline, session breakdown
- [ ] **SettingsView** — event definitions catalog, data management (optional, admin-only)

### 5.9 — Root Dashboard Component
- [ ] Implement `AnalyticsDashboard` — single component entry point
- [ ] Accept all props: `endpoint`, `apiKey`, `theme`, `accentColor`, `features`, `defaultDateRange`, `autoRefreshInterval`, `basePath`, `embedded`, callbacks
- [ ] Implement client-side routing between views
- [ ] Implement embedded mode (no sidebar, minimal chrome)
- [ ] Export individual view components for custom dashboard compositions

### 5.10 — Theming
- [ ] Implement CSS custom properties for all theme tokens
- [ ] Build light and dark theme presets
- [ ] Support `theme: 'system'` (auto-detect from `prefers-color-scheme`)
- [ ] Support custom `accentColor`, `borderRadius`, `fontFamily`
- [ ] Generate 8-color chart palette from accent color

### 5.11 — Utilities & Hooks
- [ ] `useQueryBuilder` — manage query state for trends/funnel builders
- [ ] `useAutoRefresh` — polling interval for live data
- [ ] `useExport` — CSV/JSON export of query results
- [ ] `formatters.ts` — number (1234 → "1.2K"), date, duration formatting
- [ ] `colors.ts` — chart color palette generation

### 5.12 — Dashboard Testing
- [ ] Component tests with **Vitest** + **React Testing Library** for every view and component
- [ ] Integration tests: mock API responses, verify correct query construction
- [ ] Storybook stories for all components and views
- [ ] Accessibility checks with **axe-core** (WCAG 2.1 AA)
- [ ] Visual regression setup with Storybook + Chromatic (optional)

**Deliverables:** `@trackpaw/dashboard` package that renders a full analytics UI as a single React component. Themed, responsive, accessible.

---

## Phase 6: MySQL & ClickHouse Adapters

**Goal:** Extend database support to MySQL and ClickHouse.

### 6.1 — MySQL Adapter
- [ ] Implement `MySQLAdapter` class using `knex` + `mysql2`
- [ ] Write MySQL-specific migrations (JSON columns, MySQL 5.7+ JSON functions)
- [ ] Implement `JSON_EXTRACT()` for property queries
- [ ] Implement connection pooling
- [ ] Pass full adapter conformance test suite
- [ ] Document MySQL-specific configuration

### 6.2 — ClickHouse Adapter
- [ ] Implement `ClickHouseAdapter` class using `@clickhouse/client`
- [ ] Write ClickHouse-specific migrations (MergeTree engine, monthly partitioning)
- [ ] Implement `ORDER BY (event_name, timestamp, user_id)` for analytical queries
- [ ] Implement async inserts for high-throughput ingestion
- [ ] Implement native TTL for data retention
- [ ] Implement `JSONExtractString` for property queries
- [ ] Implement `toStartOfDay/Week/Month` for time bucketing
- [ ] Pass full adapter conformance test suite
- [ ] Document ClickHouse-specific configuration

### 6.3 — CI: Adapter Test Matrix
- [ ] Add Docker services to CI: Postgres, MySQL, ClickHouse
- [ ] Run conformance tests against all four adapters in CI
- [ ] Add `pnpm test:all-adapters` script

**Deliverables:** Four fully tested adapters (SQLite, Postgres, MySQL, ClickHouse) all passing the conformance test suite.

---

## Phase 7: Examples & Documentation

**Goal:** Build working example apps and complete documentation.

### 7.1 — Example: Express App
- [ ] Create `examples/express-app/` with full Express.js integration
- [ ] Include: server setup with Postgres, tracker initialization, basic HTML pages with tracking
- [ ] Include `docker-compose.yml` for Postgres
- [ ] Write README with setup instructions

### 7.2 — Example: Next.js App
- [ ] Create `examples/nextjs-app/` with App Router integration
- [ ] Include: API route handler, client-side tracker in layout, dashboard page
- [ ] Write README with setup instructions

### 7.3 — Example: Standalone Demo
- [ ] Create `examples/standalone/` — standalone analytics server + dashboard
- [ ] Use SQLite for zero-config demo experience
- [ ] Include seed script to populate demo data
- [ ] Write README with one-command setup (`npx trackpaw-demo`)

### 7.4 — Package READMEs
- [ ] Write `packages/tracker/README.md` — installation, quick start, full API reference, UMD usage
- [ ] Write `packages/server/README.md` — installation, server setup, adapter selection, configuration, API endpoints
- [ ] Write `packages/dashboard/README.md` — installation, embedding, theming, individual components

### 7.5 — Root README
- [ ] Write comprehensive root `README.md` with project overview, quick start, links to all docs
- [ ] Add badges: npm version, CI status, bundle size, license

**Deliverables:** Three working example apps, complete package READMEs, polished root README.

---

## Phase 8: Testing, Security & Performance

**Goal:** Harden the project with comprehensive testing, security auditing, and performance benchmarks.

### 8.1 — Test Coverage Audit
- [ ] Ensure >90% test coverage across all packages
- [ ] Add coverage reporting to CI
- [ ] Fill any gaps in unit test coverage

### 8.2 — Security Audit
- [ ] Verify API key validation blocks unauthorized access
- [ ] Verify rate limiting prevents abuse
- [ ] Verify SQL injection is impossible (parameterized queries only)
- [ ] Verify PII scrubbing works correctly
- [ ] Verify GDPR deletion removes all user data across all tables
- [ ] Verify no raw SQL is exposed anywhere in the query engine
- [ ] Run `npm audit` and resolve vulnerabilities

### 8.3 — Performance Benchmarks
- [ ] Benchmark tracker bundle size (must stay < 5KB gzipped)
- [ ] Benchmark event ingestion throughput: target 1,000 events/sec (SQLite), 10,000 events/sec (Postgres)
- [ ] Benchmark query latency for each query type (trends, funnel, retention) with 1M events
- [ ] Add bundle size check to CI (fail if tracker exceeds 5KB)

### 8.4 — Browser Compatibility
- [ ] Test tracker in Chrome, Firefox, Safari, Edge (latest 2 versions)
- [ ] Test `sendBeacon` fallback behavior
- [ ] Test `localStorage` unavailable scenario (private browsing)
- [ ] Test UMD bundle via `<script>` tag in plain HTML

### 8.5 — Load Testing
- [ ] Simulate concurrent event ingestion (100, 500, 1000 clients)
- [ ] Simulate concurrent query execution
- [ ] Verify rate limiter behavior under load
- [ ] Document performance results and scaling recommendations

**Deliverables:** Comprehensive test coverage, verified security posture, documented performance benchmarks.

---

## Phase 9: npm Publishing & Release Infrastructure

**Goal:** Set up the release pipeline and publish all packages to npm.

### 9.1 — Changesets Setup
- [ ] Install and configure `@changesets/cli`
- [ ] Create `.changeset/config.json` with independent versioning
- [ ] Add `pnpm changeset` script for creating changesets
- [ ] Add `pnpm changeset version` for bumping versions
- [ ] Add `pnpm changeset publish` for publishing

### 9.2 — Package Preparation
- [ ] Verify `package.json` for each package:
  - `name`: `@trackpaw/tracker`, `@trackpaw/server`, `@trackpaw/dashboard`
  - `version`: `0.1.0` (initial release)
  - `license`: MIT (or chosen license)
  - `repository`, `homepage`, `bugs` fields
  - `keywords` for npm discovery
  - `files` array to include only `dist/` and necessary files
  - `engines`: `{ "node": ">=18.0.0" }`
- [ ] Verify `exports` map is correct for all packages
- [ ] Verify peer dependencies are correctly declared (dashboard: React 18+)
- [ ] Add `publishConfig: { "access": "public" }` for scoped packages

### 9.3 — npm Organization
- [ ] Create `@trackpaw` organization on npm
- [ ] Configure npm access tokens for CI publishing
- [ ] Verify all package names are available

### 9.4 — Automated Release Pipeline
- [ ] Create `.github/workflows/release.yml`
- [ ] Trigger on push to `main` with changeset files
- [ ] Steps: install → build → test → changeset version → changeset publish
- [ ] Publish to npm with provenance (`--provenance` flag)
- [ ] Auto-create GitHub releases with changelogs
- [ ] Notify on successful publish (optional: Slack/Discord webhook)

### 9.5 — Pre-Release Testing
- [ ] Publish canary versions (`0.1.0-canary.1`) to npm
- [ ] Test installation from npm in a fresh project
- [ ] Verify ESM, CJS, and UMD imports all work
- [ ] Verify TypeScript declarations resolve correctly
- [ ] Test full flow: install packages → set up server → track events → query data → view dashboard

### 9.6 — First Stable Release
- [ ] Create changeset for `0.1.0` release
- [ ] Run `pnpm changeset version` to update all package versions
- [ ] Run full CI pipeline
- [ ] Publish to npm: `pnpm changeset publish`
- [ ] Verify packages are live on npmjs.com
- [ ] Create GitHub release with changelog and migration notes

**Deliverables:** All three packages published to npm under the `@trackpaw` scope. Automated release pipeline via GitHub Actions and changesets.

---

## Phase 10: Post-Launch Polish

**Goal:** Community readiness, observability, and ecosystem growth.

### 10.1 — Community Setup
- [ ] Add `LICENSE` file (MIT)
- [ ] Add `CONTRIBUTING.md` with development setup, PR guidelines
- [ ] Add `CODE_OF_CONDUCT.md`
- [ ] Create GitHub issue templates (bug report, feature request)
- [ ] Create GitHub PR template
- [ ] Add GitHub Discussions for Q&A

### 10.2 — Developer Experience Improvements
- [ ] Add `npx create-trackpaw` CLI scaffolding tool (stretch goal)
- [ ] Add debug mode logging for all packages
- [ ] Add migration dry-run mode for server adapters
- [ ] Add TypeDoc-generated API reference site

### 10.3 — Monitoring & Observability Hooks
- [ ] Document integration with Sentry, Datadog, Pino for error/logging
- [ ] Document Prometheus/Grafana metrics export (stretch goal)
- [ ] Document health check endpoint usage for load balancers

### 10.4 — Ecosystem Expansion (Future)
- [ ] Next.js plugin package (`@trackpaw/next`)
- [ ] React hooks package (`@trackpaw/react`)
- [ ] Vue plugin package (`@trackpaw/vue`)
- [ ] MongoDB adapter
- [ ] Redis-backed rate limiter for multi-instance deployments

**Deliverables:** Community-ready open source project with contribution guidelines, templates, and a roadmap for ecosystem growth.

---

## Summary Timeline

| Phase | Description | Priority |
|-------|-------------|----------|
| **Phase 1** | Monorepo Foundation & Shared Types | P0 — Start here |
| **Phase 2** | Tracker SDK | P0 — Core package |
| **Phase 3** | Server Core & Adapters (SQLite + Postgres) | P0 — Core package |
| **Phase 4** | Query Engine & REST API | P0 — Core package |
| **Phase 5** | Dashboard Package | P0 — Core package |
| **Phase 6** | MySQL & ClickHouse Adapters | P1 — Extended support |
| **Phase 7** | Examples & Documentation | P1 — Launch requirement |
| **Phase 8** | Testing, Security & Performance | P1 — Launch requirement |
| **Phase 9** | npm Publishing & Release | P0 — Ship it |
| **Phase 10** | Post-Launch Polish | P2 — Ongoing |

---

> **Note:** Phases 3 & 4 are split for clarity but belong to the same package (`@trackpaw/server`). Phases 6–8 can be parallelized. Phase 9 should be rehearsed early with canary publishes.
