# Development Guide

## Prerequisites

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0 (package manager)
- **Docker** (optional, for running Postgres/MySQL/ClickHouse locally)
- **Git**

## Initial Setup

```bash
# Clone the repo
git clone https://github.com/yourorg/trackpaw.git
cd trackpaw

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run all tests
pnpm test
```

## Monorepo Structure

```
trackpaw/
├── packages/
│   ├── tracker/          # @trackpaw/tracker
│   ├── server/           # @trackpaw/server
│   ├── dashboard/        # @trackpaw/dashboard
│   └── types/            # @trackpaw/types (internal, shared types)
├── examples/
│   ├── express-app/
│   ├── nextjs-app/
│   └── standalone/
├── scripts/
│   ├── build.sh
│   ├── release.sh
│   └── setup-test-dbs.sh
├── turbo.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── vitest.config.ts
```

## Workspace Configuration

### pnpm-workspace.yaml

```yaml
packages:
  - 'packages/*'
  - 'examples/*'
```

### turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {},
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

### tsconfig.base.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
```

## Package-Specific Development

### Tracker SDK

```bash
cd packages/tracker

# Dev mode (watch + rebuild)
pnpm dev

# Build all formats (ESM + CJS + UMD)
pnpm build

# Run tests
pnpm test

# Check bundle size
pnpm size
```

**Build tool:** `tsup`

```typescript
// packages/tracker/tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    treeshake: true,
  },
  {
    entry: ['src/index.ts'],
    format: ['iife'],
    globalName: 'trackpaw',
    outDir: 'dist/umd',
    minify: true,
    sourcemap: true,
  },
]);
```

### Server Package

```bash
cd packages/server

# Dev mode
pnpm dev

# Build
pnpm build

# Run tests (SQLite in-memory, no external DB needed)
pnpm test

# Run tests with Postgres (requires Docker)
pnpm test:postgres

# Run tests with all adapters
pnpm test:all-adapters

# Run adapter conformance suite
pnpm test:conformance
```

**Setting up test databases with Docker:**

```bash
# From repo root
./scripts/setup-test-dbs.sh

# This starts:
# - Postgres on port 5433
# - MySQL on port 3307
# - ClickHouse on port 8124
```

### Dashboard

```bash
cd packages/dashboard

# Dev mode (Storybook)
pnpm storybook

# Build
pnpm build

# Run component tests
pnpm test

# Visual regression tests
pnpm test:visual
```

## Adding a New Database Adapter

Step-by-step guide to adding support for a new database:

### Step 1: Create the Adapter File

```bash
touch packages/server/src/adapters/mongodb.ts
```

### Step 2: Implement StorageAdapter Interface

```typescript
import { StorageAdapter, ValidatedEvent, TrendsQuery, ... } from './types';

export interface MongoAdapterConfig {
  uri: string;
  dbName: string;
}

export class MongoAdapter implements StorageAdapter {
  readonly engine = 'custom' as const;

  constructor(private config: MongoAdapterConfig) {}

  async initialize(): Promise<void> {
    // Connect to MongoDB
    // Create collections and indexes
  }

  async insertEvents(events: ValidatedEvent[]): Promise<InsertResult> {
    // Batch insert into events collection
  }

  async queryTrends(query: TrendsQuery): Promise<TrendsResult> {
    // Build aggregation pipeline
  }

  // ... implement all interface methods
}
```

### Step 3: Add Conformance Tests

```typescript
// packages/server/src/adapters/__tests__/mongodb.test.ts
import { MongoAdapter } from '../mongodb';
import { runAdapterConformanceTests } from './adapter-conformance';

runAdapterConformanceTests(
  async () => {
    const adapter = new MongoAdapter({ uri: 'mongodb://localhost:27017', dbName: 'test_analytics' });
    await adapter.initialize();
    return adapter;
  },
  async (adapter) => {
    await adapter.disconnect();
  }
);
```

### Step 4: Add Migrations

Create migration files in `packages/server/src/adapters/migrations/mongodb/`.

### Step 5: Export from Package

```typescript
// packages/server/src/index.ts
export { MongoAdapter } from './adapters/mongodb';
```

### Step 6: Document

Add usage example to the README and integration guide.

## Testing Strategy

### Unit Tests

Every module should have unit tests. Use Vitest.

```typescript
// packages/server/src/core/__tests__/event-validator.test.ts
import { describe, it, expect } from 'vitest';
import { validateEvent } from '../event-validator';

describe('EventValidator', () => {
  it('rejects events with empty name', () => {
    const result = validateEvent({ event: '', properties: {} });
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Event name is required');
  });

  it('rejects events with too many properties', () => {
    const props = Object.fromEntries(
      Array.from({ length: 51 }, (_, i) => [`key${i}`, 'value'])
    );
    const result = validateEvent({ event: 'Test', properties: props });
    expect(result.valid).toBe(false);
  });
});
```

### Integration Tests

Test full flows with SQLite in-memory:

```typescript
// packages/server/src/__tests__/integration.test.ts
import { createAnalyticsServer, SQLiteAdapter } from '../index';

describe('Full Integration', () => {
  let analytics;

  beforeEach(async () => {
    analytics = createAnalyticsServer({
      adapter: new SQLiteAdapter({ filename: ':memory:' }),
      apiKey: 'test-key',
    });
    await analytics.migrate();
  });

  it('ingests events and queries trends', async () => {
    // Ingest
    await analytics.core.ingestEvents([
      { event: 'Sign Up', properties: {}, timestamp: '2025-06-15T10:00:00Z', anonymousId: 'a1', sessionId: 's1' },
      { event: 'Sign Up', properties: {}, timestamp: '2025-06-15T11:00:00Z', anonymousId: 'a2', sessionId: 's2' },
    ], { ip: '127.0.0.1', userAgent: 'test' });

    // Query
    const result = await analytics.core.executeQuery({
      type: 'trends',
      events: [{ name: 'Sign Up', aggregation: 'total' }],
      interval: 'day',
      dateRange: { start: '2025-06-15', end: '2025-06-16' },
    });

    expect(result.series[0].total).toBe(2);
  });
});
```

### Bundle Size Tests

```typescript
// packages/tracker/__tests__/bundle-size.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { gzipSync } from 'zlib';

describe('Bundle Size', () => {
  it('UMD bundle is under 5KB gzipped', () => {
    const bundle = readFileSync('dist/umd/trackpaw.min.js');
    const gzipped = gzipSync(bundle);
    expect(gzipped.length).toBeLessThan(5 * 1024);
  });
});
```

## Code Quality

### Linting

ESLint with TypeScript rules:

```bash
pnpm lint          # Check all packages
pnpm lint --fix    # Auto-fix
```

### Formatting

Prettier:

```bash
pnpm format        # Format all files
pnpm format:check  # Check formatting
```

### Type Checking

```bash
pnpm typecheck     # All packages
```

## CI Pipeline

GitHub Actions workflow:

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: [18, 20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm build
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test

  test-adapters:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: test_analytics
          POSTGRES_PASSWORD: test
        ports: ['5432:5432']
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm build
      - run: pnpm --filter @trackpaw/server test:all-adapters
        env:
          TEST_PG_URL: postgresql://postgres:test@localhost:5432/test_analytics

  bundle-size:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
      - run: pnpm install
      - run: pnpm --filter @trackpaw/tracker build
      - run: pnpm --filter @trackpaw/tracker size
```

## Release Process

We use changesets for version management:

```bash
# Create a changeset (after making changes)
pnpm changeset

# Version packages (CI does this on main)
pnpm changeset version

# Publish to npm (CI does this on version tags)
pnpm changeset publish
```

### Versioning Rules

- **Patch:** Bug fixes, documentation
- **Minor:** New features (new adapter, new query type, new dashboard view)
- **Major:** Breaking API changes (interface changes, removed features)

All three packages are versioned independently but released together.
