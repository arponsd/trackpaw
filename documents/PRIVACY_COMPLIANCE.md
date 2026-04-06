# Privacy & Compliance Guide

## Overview

Trackpaw is designed with privacy-first defaults. Since all data stays on the customer's infrastructure, many compliance concerns are simplified. However, customers still need to handle user consent, data retention, and GDPR/CCPA obligations properly. This guide covers how Trackpaw helps.

## Privacy-First Defaults

Out of the box, Trackpaw ships with these defaults:

| Setting | Default | Description |
|---------|---------|-------------|
| IP Anonymization | **ON** | Last octet of IP is zeroed (e.g., 192.168.1.x → 192.168.1.0) |
| PII Scrubbing | OFF | Opt-in: configure which property keys to hash/remove |
| Cookie-less | **YES** | Uses localStorage, NOT cookies (no cookie banner needed in many jurisdictions) |
| Do Not Track | OFF | Opt-in: honor the browser's DNT header |
| Data Retention | 365 days | Configurable per table (events, sessions, users) |
| Server-side only storage | **YES** | No data sent to third parties — stays on customer's DB |

## Consent Management

### Opt-In Mode

For jurisdictions requiring explicit consent (EU/GDPR), use opt-in mode:

```typescript
const tracker = Trackpaw.init({
  endpoint: '/analytics',
  apiKey: 'key',
  // Start opted out — no tracking until consent is given
  defaultOptOut: true,
});

// When user gives consent:
function onConsentGranted() {
  tracker.optIn();
  // Now tracking is active. Retroactive events are NOT captured.
}

// When user revokes consent:
function onConsentRevoked() {
  tracker.optOut();
  tracker.reset(); // Clear all local identity data
}
```

### Check Consent State

```typescript
if (tracker.hasOptedOut()) {
  showConsentBanner();
}
```

### Cookie-less Tracking

By default, Trackpaw uses `localStorage` for persistence (anonymous ID, queue). This avoids the need for cookie consent in many cases. For maximum privacy:

```typescript
const tracker = Trackpaw.init({
  endpoint: '/analytics',
  apiKey: 'key',
  persistence: 'memory', // Nothing persists across page loads
});
```

With `memory` persistence:
- Anonymous ID is regenerated on every page load
- Event queue is lost if page is closed before flush
- No localStorage or cookies are used

## IP Anonymization

Enabled by default. The server zeros out the last octet of IPv4 addresses (or last 80 bits of IPv6) before storage.

```
IPv4: 192.168.1.234 → 192.168.1.0
IPv6: 2001:0db8:85a3::8a2e:0370:7334 → 2001:0db8:85a3::0000:0000:0000
```

To disable (if you need full IP for geolocation):

```typescript
const analytics = createAnalyticsServer({
  adapter: new PostgresAdapter({ ... }),
  privacy: {
    ipAnonymization: false,
  },
});
```

## PII Scrubbing

Configure which event property keys contain PII:

```typescript
const analytics = createAnalyticsServer({
  adapter: new PostgresAdapter({ ... }),
  privacy: {
    piiFields: ['email', 'phone', 'ssn', 'credit_card', 'full_name'],
    piiAction: 'hash',   // 'hash' (SHA-256) or 'remove' (delete the field)
  },
});
```

**Hash mode:** Replaces the value with a SHA-256 hash. Useful for segmentation (you can still group by hashed email) but the original value is unrecoverable.

```json
// Before
{ "email": "alice@example.com", "plan": "pro" }

// After (hash mode)
{ "email": "sha256:b5a2c...", "plan": "pro" }

// After (remove mode)
{ "plan": "pro" }
```

### Custom PII Scrubber

For advanced needs, use the `beforeIngest` hook:

```typescript
const analytics = createAnalyticsServer({
  adapter: new PostgresAdapter({ ... }),
  hooks: {
    beforeIngest: (events) => {
      return events.map(event => ({
        ...event,
        properties: scrubPII(event.properties),
      }));
    },
  },
});

function scrubPII(props: Record<string, any>): Record<string, any> {
  const scrubbed = { ...props };
  // Remove anything that looks like an email
  for (const [key, value] of Object.entries(scrubbed)) {
    if (typeof value === 'string' && value.includes('@') && value.includes('.')) {
      scrubbed[key] = '[REDACTED]';
    }
  }
  return scrubbed;
}
```

## GDPR Compliance

### Right to Erasure (Article 17)

Delete all data for a user:

```typescript
// Via API
DELETE /v1/users/:userId
X-API-Key: <admin-key>

// Via code
await analytics.core.deleteUser('user_123');
```

This deletes:
- All events where `user_id = 'user_123'`
- All events where `anonymous_id` is linked to this user
- The user profile in `tp_users`
- All sessions linked to this user

### Right to Data Portability (Article 20)

Export all data for a user:

```typescript
// Via API
GET /v1/users/:userId/export
X-API-Key: <admin-key>

// Returns JSON with all user data:
{
  "profile": { ... },
  "events": [ ... ],
  "sessions": [ ... ],
  "exportedAt": "2025-06-15T10:00:00Z"
}
```

### Right to Rectification (Article 16)

Update user traits:

```typescript
// Via API
PUT /v1/users/:userId
X-API-Key: <admin-key>
Body: { "traits": { "name": "Updated Name" } }

// Via tracker
tracker.identify('user_123', { name: 'Updated Name' });
```

### Data Processing Records

Trackpaw stores metadata about data processing:

```typescript
// Get processing summary
GET /v1/admin/processing-summary
X-API-Key: <admin-key>

{
  "totalEvents": 154200,
  "totalUsers": 3200,
  "oldestEvent": "2025-01-01T00:00:00Z",
  "newestEvent": "2025-06-15T10:30:00Z",
  "dataCategories": ["behavioral", "device", "location"],
  "retentionPolicy": {
    "events": "365d",
    "sessions": "365d",
    "users": "forever"
  }
}
```

## CCPA Compliance

### Do Not Sell

Since Trackpaw stores data on the customer's own server and doesn't share with third parties, there is no "sale" of data. However, if customers need to honor "Do Not Sell" requests:

```typescript
// Check if user has opted out of sale
tracker.optOut(); // Stops all tracking

// Or use a separate flag
tracker.track('Page View', {}, {
  doNotSell: true, // Server can filter these events
});
```

## Data Retention

### Configure Retention

```typescript
const analytics = createAnalyticsServer({
  adapter: new PostgresAdapter({
    connectionString: process.env.DATABASE_URL,
    retention: {
      events: '90d',     // Delete events older than 90 days
      sessions: '90d',   // Delete sessions older than 90 days
      users: 'forever',  // Keep user profiles indefinitely
    },
    retentionCheckInterval: '24h', // Run cleanup daily
  }),
});
```

### Manual Cleanup

```typescript
// Force retention cleanup
await analytics.core.runRetentionCleanup();

// Delete all data before a specific date
await analytics.core.deleteEventsBefore('2024-01-01');
```

## Security Best Practices

### API Key Management

1. **Use separate keys** for write (tracker), read (dashboard), and admin operations
2. **Rotate keys** regularly — the server supports multiple active keys per permission level
3. **Never expose admin keys** in client-side code
4. **Write keys are safe** to expose in browser code (they can only write events, not read data)

### Network Security

1. **Use HTTPS** — never send events over unencrypted HTTP in production
2. **Configure CORS** — restrict which origins can send events
3. **Rate limit** — prevent abuse (enabled by default)
4. **Validate inputs** — the server validates all event payloads (enabled by default)

### Database Security

1. **Use a dedicated database user** with minimal permissions (INSERT, SELECT on analytics tables)
2. **Enable SSL** for database connections in production
3. **Encrypt at rest** — use database-level encryption for sensitive data
4. **Regular backups** — analytics data may be business-critical

## Compliance Checklist

For customers deploying Trackpaw, here's a checklist:

- [ ] Enable IP anonymization (on by default)
- [ ] Configure PII scrubbing for relevant property fields
- [ ] Set up consent management (opt-in mode for EU users)
- [ ] Configure data retention policy
- [ ] Set up GDPR deletion endpoint in your admin panel
- [ ] Set up GDPR export endpoint in your admin panel
- [ ] Use HTTPS for all analytics traffic
- [ ] Use separate API keys for write, read, and admin
- [ ] Update your privacy policy to mention analytics collection
- [ ] Document what data you collect and why (GDPR Article 30)
- [ ] Set up regular data retention cleanup jobs
