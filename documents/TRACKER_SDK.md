# Tracker SDK Specification

## Overview

`@trackpaw/tracker` is the client-side JavaScript/TypeScript SDK that developers embed in their applications to capture user behavior. It runs in the browser and optionally in Node.js (for server-side tracking).

**Design Goals:**
- Zero external dependencies
- Under 5KB gzipped
- Framework-agnostic (works with React, Vue, Angular, Svelte, vanilla JS)
- Ships as ESM, CJS, and UMD bundles
- TypeScript-first with full type definitions

## Package Structure

```
packages/tracker/
├── src/
│   ├── index.ts              # Public API exports
│   ├── core/
│   │   ├── client.ts         # Main Trackpaw class
│   │   ├── config.ts         # Configuration types and defaults
│   │   └── constants.ts      # SDK version, defaults
│   ├── transport/
│   │   ├── transport.ts      # Transport interface
│   │   ├── fetch.ts          # Fetch-based transport (default)
│   │   ├── beacon.ts         # sendBeacon transport (page unload)
│   │   └── xhr.ts            # XMLHttpRequest fallback
│   ├── queue/
│   │   ├── event-queue.ts    # In-memory event queue
│   │   ├── persistence.ts    # localStorage persistence layer
│   │   └── flush-policy.ts   # When to flush (timer, size, unload)
│   ├── identity/
│   │   ├── identity.ts       # User identity manager
│   │   ├── anonymous-id.ts   # Anonymous ID generation/storage
│   │   └── session.ts        # Session ID management
│   ├── auto-capture/
│   │   ├── page-view.ts      # Auto page view tracking
│   │   ├── click.ts          # Auto click tracking (optional)
│   │   └── form.ts           # Auto form submission tracking (optional)
│   ├── context/
│   │   ├── browser.ts        # Browser/device/OS detection
│   │   ├── page.ts           # Page URL, title, referrer
│   │   └── utm.ts            # UTM parameter extraction
│   ├── consent/
│   │   └── consent.ts        # Consent management (opt-in/opt-out)
│   └── utils/
│       ├── uuid.ts           # UUID v4 generation (no deps)
│       ├── storage.ts        # Safe localStorage wrapper
│       └── time.ts           # ISO timestamp helpers
├── tsconfig.json
├── tsup.config.ts            # Build config (ESM + CJS + UMD)
├── package.json
└── README.md
```

## Public API

### Initialization

```typescript
import { Trackpaw } from '@trackpaw/tracker';

const tracker = Trackpaw.init({
  // Required
  endpoint: string;             // URL where the server package is mounted
  apiKey: string;               // Write API key

  // Batching
  flushInterval?: number;       // ms between auto-flushes (default: 5000)
  flushQueueSize?: number;      // Max events before force flush (default: 10)
  maxQueueSize?: number;        // Max queue size before dropping (default: 1000)

  // Persistence
  persistence?: 'localStorage' | 'memory' | 'cookie';  // default: 'localStorage'
  persistencePrefix?: string;   // Key prefix (default: 'tp_')

  // Session
  sessionTimeout?: number;      // ms of inactivity to end session (default: 1800000 = 30min)

  // Auto-tracking
  autoTrack?: {
    pageViews?: boolean;        // default: true
    clicks?: boolean;           // default: false
    forms?: boolean;            // default: false
    outboundLinks?: boolean;    // default: false
  };

  // Privacy
  ipAnonymization?: boolean;    // Tell server to mask IP (default: true)
  respectDoNotTrack?: boolean;  // Honor DNT header (default: false)

  // Context enrichment
  defaultProperties?: Record<string, any>;  // Added to every event

  // Debug
  debug?: boolean;              // Log events to console (default: false)

  // Hooks
  onEventTracked?: (event: TrackedEvent) => void;
  onFlush?: (events: TrackedEvent[], success: boolean) => void;
  onError?: (error: Error) => void;
});
```

### Core Methods

```typescript
/** Track a custom event */
tracker.track(eventName: string, properties?: Record<string, any>): void;

/** Identify a user (links anonymous activity to a known user) */
tracker.identify(userId: string, traits?: Record<string, any>): void;

/** Track a page view */
tracker.page(pageName?: string, properties?: Record<string, any>): void;

/** Set user traits without triggering an identify event */
tracker.setUserProperties(traits: Record<string, any>): void;

/** Set properties that persist across all future events (super properties) */
tracker.setSuperProperties(properties: Record<string, any>): void;

/** Remove specific super properties */
tracker.unsetSuperProperties(keys: string[]): void;

/** Register a one-time property (set once, never overwritten) */
tracker.setOnce(properties: Record<string, any>): void;

/** Start a timed event (call track() later to complete it with duration) */
tracker.timeEvent(eventName: string): void;

/** Add the user to a group (e.g., company, team) */
tracker.group(groupType: string, groupId: string, traits?: Record<string, any>): void;

/** Opt the user out of tracking */
tracker.optOut(): void;

/** Opt the user back in */
tracker.optIn(): void;

/** Check if user is opted out */
tracker.hasOptedOut(): boolean;

/** Clear all local data and reset identity */
tracker.reset(): void;

/** Force flush the event queue */
tracker.flush(): Promise<void>;

/** Shut down the tracker (flush + stop timers) */
tracker.shutdown(): Promise<void>;

/** Get the current anonymous ID */
tracker.getAnonymousId(): string;

/** Get the current user ID (null if not identified) */
tracker.getUserId(): string | null;

/** Get the current session ID */
tracker.getSessionId(): string;

/** Get SDK version */
Trackpaw.version: string;
```

### UMD / Script Tag Usage

```html
<script src="https://cdn.myapp.com/trackpaw.min.js"></script>
<script>
  window.trackpaw.init({
    endpoint: '/analytics',
    apiKey: 'my-key',
  });

  window.trackpaw.track('Page Loaded');
  window.trackpaw.identify('user_123', { name: 'Alice' });
</script>
```

## Internal Event Schema

Every event that leaves the tracker has this shape:

```typescript
interface TrackedEvent {
  event: string;                    // Event name
  properties: Record<string, any>; // Event-specific properties
  timestamp: string;               // ISO 8601 timestamp
  userId: string | null;           // Identified user ID
  anonymousId: string;             // Always present
  sessionId: string;
  context: {
    page: {
      url: string;
      path: string;
      title: string;
      referrer: string;
    };
    browser: string;
    browserVersion: string;
    os: string;
    osVersion: string;
    deviceType: 'desktop' | 'mobile' | 'tablet';
    screenWidth: number;
    screenHeight: number;
    locale: string;
    timezone: string;
    utm: {
      source?: string;
      medium?: string;
      campaign?: string;
      term?: string;
      content?: string;
    };
  };
  sdk: {
    name: '@trackpaw/tracker';
    version: string;
  };
  superProperties: Record<string, any>;
  _metadata: {
    sentAt: string;            // When this batch was sent
    ipAnonymization: boolean;
  };
}
```

## Flush / Transport Behavior

### Flush Triggers

1. **Timer:** Every `flushInterval` ms (default 5s)
2. **Queue size:** When queue reaches `flushQueueSize` (default 10 events)
3. **Page unload:** On `visibilitychange` (hidden) or `pagehide` using `sendBeacon`
4. **Manual:** When `tracker.flush()` is called

### Batch Payload

```json
POST /analytics/v1/events/batch
Content-Type: application/json
X-API-Key: <apiKey>

{
  "batch": [
    { "event": "Page View", "properties": {}, "timestamp": "...", ... },
    { "event": "Button Clicked", "properties": { "id": "cta" }, ... }
  ],
  "sentAt": "2025-01-15T10:30:00Z"
}
```

### Retry Logic

- On failed flush (network error or 5xx): retry with exponential backoff
- Retry schedule: 1s → 2s → 4s → 8s → 16s → give up
- Events stay in queue during retries
- If queue exceeds `maxQueueSize`, oldest events are dropped

### Offline Persistence

- When `persistence: 'localStorage'`, the queue is periodically saved to localStorage
- On page load, persisted queue is restored and flushed
- Key: `{persistencePrefix}queue` (default: `tp_queue`)

## Identity Resolution

### Anonymous ID

- Generated on first load (UUID v4)
- Stored in localStorage: `tp_anonymous_id`
- Persists across page loads and sessions
- Cleared only on `tracker.reset()`

### Identify Flow

```
1. User visits site → anonymousId = "anon_abc123"
2. Events tracked with anonymousId only
3. User signs up → tracker.identify("user_456", { name: "Alice" })
4. SDK sends identify event with both anonymousId and userId
5. Server links anon_abc123 → user_456 in the users table
6. All future events include both anonymousId and userId
7. Historical events with anon_abc123 can be attributed to user_456
```

### Session Management

- Session ID generated on first event
- Session expires after `sessionTimeout` ms of inactivity (default: 30 min)
- Activity = any `track()`, `page()`, or `identify()` call
- New session generates a new session ID
- Session ID stored in sessionStorage (dies with tab)

## Build Targets

```
dist/
├── esm/
│   ├── index.js          # ES module (tree-shakable)
│   └── index.d.ts        # TypeScript declarations
├── cjs/
│   ├── index.js          # CommonJS (Node.js, older bundlers)
│   └── index.d.ts
├── umd/
│   ├── trackpaw.js       # UMD (script tag)
│   └── trackpaw.min.js   # Minified UMD
└── package.json
```

**package.json exports:**

```json
{
  "main": "./dist/cjs/index.js",
  "module": "./dist/esm/index.js",
  "types": "./dist/esm/index.d.ts",
  "browser": "./dist/umd/trackpaw.min.js",
  "exports": {
    ".": {
      "import": "./dist/esm/index.js",
      "require": "./dist/cjs/index.js",
      "types": "./dist/esm/index.d.ts"
    }
  },
  "sideEffects": false
}
```

## Testing Strategy

- **Unit tests:** Every module in isolation (queue, identity, transport, context)
- **Integration tests:** Full init → track → flush → verify HTTP request cycle
- **Bundle size test:** CI check that gzipped UMD stays under 5KB
- **Browser tests:** Playwright tests for localStorage, sendBeacon, session handling
- **Framework tests:** Verify no conflicts with React, Vue, Angular
