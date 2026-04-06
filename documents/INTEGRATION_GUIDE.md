# Integration Guide

## Overview

This guide shows how to integrate Trackpaw with popular frameworks and platforms. Every integration follows the same three steps: set up the server, initialize the tracker, and mount the dashboard.

## Express.js

The most straightforward integration. Express is the primary supported framework.

### Full Setup

```typescript
// server.ts
import express from 'express';
import { createAnalyticsServer, PostgresAdapter } from '@trackpaw/server';

const app = express();

// Create the analytics server
const analytics = createAnalyticsServer({
  adapter: new PostgresAdapter({
    connectionString: process.env.DATABASE_URL!,
  }),
  apiKeys: {
    write: [process.env.ANALYTICS_WRITE_KEY!],
    read: [process.env.ANALYTICS_READ_KEY!],
    admin: [process.env.ANALYTICS_ADMIN_KEY!],
  },
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  },
  rateLimit: {
    maxRequests: 200,
    windowMs: 60000,
  },
  privacy: {
    ipAnonymization: true,
    piiFields: ['email', 'phone'],
    piiAction: 'hash',
  },
});

// Run migrations on startup
await analytics.migrate();

// Mount analytics routes
app.use('/analytics', analytics.router);

// Your other routes
app.get('/', (req, res) => res.send('Hello'));

app.listen(3000, () => {
  console.log('Server running with analytics at /analytics');
});
```

### Client-Side (Vanilla JS)

```html
<!-- Include tracker via CDN or bundle -->
<script src="/analytics/tracker.min.js"></script>
<script>
  trackpaw.init({
    endpoint: '/analytics',
    apiKey: 'your-write-key',
    autoTrack: { pageViews: true },
  });
</script>
```

## Next.js (App Router)

### Server: API Route Handler

```typescript
// app/api/analytics/[...path]/route.ts
import { createAnalyticsServer, PostgresAdapter } from '@trackpaw/server';

const analytics = createAnalyticsServer({
  adapter: new PostgresAdapter({
    connectionString: process.env.DATABASE_URL!,
  }),
  apiKey: process.env.ANALYTICS_API_KEY!,
});

// Initialize on first request
let initialized = false;
async function ensureInitialized() {
  if (!initialized) {
    await analytics.migrate();
    initialized = true;
  }
}

export async function POST(request: Request) {
  await ensureInitialized();
  // Forward to analytics core
  const path = new URL(request.url).pathname.replace('/api/analytics', '');
  const body = await request.json();
  
  // Route to appropriate handler
  if (path === '/v1/events/batch') {
    const result = await analytics.core.ingestEvents(body.batch, {
      ip: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || '',
    });
    return Response.json(result);
  }
  
  if (path === '/v1/query') {
    const result = await analytics.core.executeQuery(body);
    return Response.json(result);
  }
  
  return Response.json({ error: 'Not found' }, { status: 404 });
}

export async function GET(request: Request) {
  await ensureInitialized();
  const path = new URL(request.url).pathname.replace('/api/analytics', '');
  
  if (path === '/v1/health') {
    const health = await analytics.healthCheck();
    return Response.json(health);
  }

  if (path === '/v1/metadata') {
    const meta = await analytics.core.getMetadata();
    return Response.json(meta);
  }
  
  return Response.json({ error: 'Not found' }, { status: 404 });
}
```

### Client: Tracker in Layout

```typescript
// lib/analytics.ts
import { Trackpaw } from '@trackpaw/tracker';

let tracker: ReturnType<typeof Trackpaw.init> | null = null;

export function getTracker() {
  if (!tracker && typeof window !== 'undefined') {
    tracker = Trackpaw.init({
      endpoint: '/api/analytics',
      apiKey: process.env.NEXT_PUBLIC_ANALYTICS_KEY!,
      autoTrack: { pageViews: false }, // We'll track manually for SPA
    });
  }
  return tracker;
}
```

```tsx
// components/AnalyticsProvider.tsx
'use client';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { getTracker } from '@/lib/analytics';

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    const tracker = getTracker();
    tracker?.page(pathname);
  }, [pathname]);

  return <>{children}</>;
}
```

```tsx
// app/layout.tsx
import { AnalyticsProvider } from '@/components/AnalyticsProvider';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AnalyticsProvider>{children}</AnalyticsProvider>
      </body>
    </html>
  );
}
```

### Dashboard Page

```tsx
// app/admin/analytics/page.tsx
'use client';
import { AnalyticsDashboard } from '@trackpaw/dashboard';

export default function AnalyticsPage() {
  return (
    <div style={{ height: '100vh' }}>
      <AnalyticsDashboard
        endpoint="/api/analytics"
        apiKey={process.env.NEXT_PUBLIC_ANALYTICS_READ_KEY!}
        theme="light"
      />
    </div>
  );
}
```

## React (Vite / CRA)

### Tracker Setup

```tsx
// src/analytics.ts
import { Trackpaw } from '@trackpaw/tracker';

export const tracker = Trackpaw.init({
  endpoint: import.meta.env.VITE_ANALYTICS_ENDPOINT,
  apiKey: import.meta.env.VITE_ANALYTICS_KEY,
  autoTrack: { pageViews: false },
});
```

### React Router Integration

```tsx
// src/App.tsx
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { tracker } from './analytics';

function App() {
  const location = useLocation();

  useEffect(() => {
    tracker.page(location.pathname);
  }, [location]);

  return <Routes>{/* ... */}</Routes>;
}
```

### Track Events in Components

```tsx
import { tracker } from '../analytics';

function PricingCard({ plan }) {
  const handleSelect = () => {
    tracker.track('Plan Selected', {
      plan: plan.name,
      price: plan.price,
      interval: plan.interval,
    });
  };

  return (
    <div>
      <h3>{plan.name}</h3>
      <button onClick={handleSelect}>Select Plan</button>
    </div>
  );
}
```

## Vue.js

### Plugin

```typescript
// plugins/analytics.ts
import { Trackpaw } from '@trackpaw/tracker';

export const analyticsPlugin = {
  install(app, options) {
    const tracker = Trackpaw.init({
      endpoint: options.endpoint,
      apiKey: options.apiKey,
      autoTrack: { pageViews: false },
    });

    // Make tracker available via inject
    app.provide('tracker', tracker);
    app.config.globalProperties.$track = tracker.track.bind(tracker);

    // Track route changes
    const router = options.router;
    if (router) {
      router.afterEach((to) => {
        tracker.page(to.path, { name: to.name });
      });
    }
  },
};
```

```typescript
// main.ts
import { createApp } from 'vue';
import { analyticsPlugin } from './plugins/analytics';
import router from './router';

const app = createApp(App);
app.use(analyticsPlugin, {
  endpoint: import.meta.env.VITE_ANALYTICS_ENDPOINT,
  apiKey: import.meta.env.VITE_ANALYTICS_KEY,
  router,
});
app.mount('#app');
```

### Use in Components

```vue
<script setup>
import { inject } from 'vue';
const tracker = inject('tracker');

function handlePurchase(item) {
  tracker.track('Purchase', { item: item.name, price: item.price });
}
</script>
```

## Node.js (Server-Side Tracking)

For tracking server-side events (API calls, background jobs, etc.):

```typescript
import { Trackpaw } from '@trackpaw/tracker';

const tracker = Trackpaw.init({
  endpoint: 'http://localhost:3000/analytics',
  apiKey: process.env.ANALYTICS_WRITE_KEY!,
  // Server-side: disable browser-specific features
  persistence: 'memory',
  autoTrack: {
    pageViews: false,
    clicks: false,
    forms: false,
  },
});

// Track server events
app.post('/api/orders', async (req, res) => {
  const order = await createOrder(req.body);
  
  tracker.track('Order Created', {
    orderId: order.id,
    amount: order.total,
    items: order.items.length,
  });

  // Associate with user
  if (req.user) {
    tracker.identify(req.user.id, {
      name: req.user.name,
      email: req.user.email,
    });
  }

  res.json(order);
});

// Flush before process exit
process.on('SIGTERM', async () => {
  await tracker.shutdown();
  process.exit(0);
});
```

## Docker Deployment

### docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - '3000:3000'
    environment:
      - DATABASE_URL=postgresql://analytics:secret@db:5432/analytics
      - ANALYTICS_API_KEY=your-api-key
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16
    environment:
      POSTGRES_DB: analytics
      POSTGRES_USER: analytics
      POSTGRES_PASSWORD: secret
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - '5432:5432'
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U analytics']
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
```

## Environment Variables

Recommended `.env` structure:

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/analytics

# API Keys
ANALYTICS_WRITE_KEY=itw_live_abc123    # Prefix: itw_ for write
ANALYTICS_READ_KEY=itr_live_def456     # Prefix: itr_ for read
ANALYTICS_ADMIN_KEY=ita_live_ghi789    # Prefix: ita_ for admin

# Client-side (safe to expose)
NEXT_PUBLIC_ANALYTICS_KEY=itw_live_abc123
NEXT_PUBLIC_ANALYTICS_ENDPOINT=/analytics

# Privacy
ANALYTICS_IP_ANONYMIZATION=true
ANALYTICS_PII_FIELDS=email,phone,ssn

# Performance
ANALYTICS_RATE_LIMIT_MAX=200
ANALYTICS_RATE_LIMIT_WINDOW=60000
```
