# @trackpaw/tracker

Privacy-first analytics tracker SDK for browser and Node.js. Zero dependencies, under 5KB gzipped.

## Installation

```bash
npm install @trackpaw/tracker
```

## Quick Start

```typescript
import { Trackpaw } from '@trackpaw/tracker';

const tracker = Trackpaw.init({
  endpoint: 'https://myapp.com/analytics',
  apiKey: 'your-write-key',
  autoTrack: { pageViews: true },
});

// Track events
tracker.track('Sign Up', { plan: 'pro' });

// Identify users
tracker.identify('user_123', { name: 'Alice', plan: 'pro' });

// Track page views
tracker.page('/dashboard');
```

## API Reference

### Initialization

```typescript
const tracker = Trackpaw.init({
  endpoint: string;          // Server URL
  apiKey: string;            // Write API key
  flushInterval?: number;    // Auto-flush interval in ms (default: 5000)
  flushQueueSize?: number;   // Flush when queue reaches N events (default: 10)
  maxQueueSize?: number;     // Max queue size before dropping old events (default: 1000)
  persistence?: 'localStorage' | 'memory';  // default: 'localStorage'
  sessionTimeout?: number;   // Session timeout in ms (default: 1800000 = 30min)
  autoTrack?: {
    pageViews?: boolean;     // default: true
    clicks?: boolean;        // default: false
    forms?: boolean;         // default: false
  };
  ipAnonymization?: boolean; // default: true
  respectDoNotTrack?: boolean; // default: false
  defaultOptOut?: boolean;   // default: false (opt-in consent mode)
  debug?: boolean;           // Log to console (default: false)
});
```

### Core Methods

| Method | Description |
|--------|-------------|
| `tracker.track(event, properties?)` | Track a custom event |
| `tracker.page(name?, properties?)` | Track a page view |
| `tracker.identify(userId, traits?)` | Identify a user |
| `tracker.setUserProperties(traits)` | Set user traits without triggering identify |
| `tracker.setSuperProperties(props)` | Set properties added to every event |
| `tracker.unsetSuperProperties(keys)` | Remove super properties |
| `tracker.setOnce(props)` | Set properties once (never overwritten) |
| `tracker.timeEvent(eventName)` | Start timing an event |
| `tracker.group(type, id, traits?)` | Add user to a group |
| `tracker.optOut()` | Stop tracking |
| `tracker.optIn()` | Resume tracking |
| `tracker.hasOptedOut()` | Check opt-out status |
| `tracker.reset()` | Clear identity and local data |
| `tracker.flush()` | Force flush the event queue |
| `tracker.shutdown()` | Flush and stop all timers |

### UMD / Script Tag

```html
<script src="https://cdn.myapp.com/trackpaw.min.js"></script>
<script>
  trackpaw.init({ endpoint: '/analytics', apiKey: 'key' });
  trackpaw.track('Page Loaded');
</script>
```

## Build Formats

| Format | File | Use Case |
|--------|------|----------|
| ESM | `dist/index.mjs` | Modern bundlers (Vite, webpack 5) |
| CJS | `dist/index.js` | Node.js, older bundlers |
| UMD | `dist/umd/index.min.js` | Script tag, no bundler |

## Bundle Size

Under **5KB gzipped** (UMD minified).
