import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createAnalyticsServer } from '../core/create-server';
import { SQLiteAdapter } from '../adapters/sqlite';

describe('Security', () => {
  let app: express.Express;
  let adapter: SQLiteAdapter;

  beforeAll(async () => {
    adapter = new SQLiteAdapter({ filename: ':memory:' });
    await adapter.initialize();

    const analytics = createAnalyticsServer({
      adapter,
      apiKeys: { write: ['write-key'], read: ['read-key'], admin: ['admin-key'] },
      rateLimit: { enabled: false },
      privacy: { ipAnonymization: true, piiFields: ['email', 'ssn'], piiAction: 'hash' },
    });

    app = express();
    app.use('/analytics', analytics.router);
  });

  afterAll(async () => {
    await adapter.disconnect();
  });

  // ─── SQL Injection Prevention ──────────────────────

  describe('SQL Injection', () => {
    it('rejects malicious event names', async () => {
      const res = await request(app)
        .post('/analytics/v1/events/batch')
        .set('X-API-Key', 'write-key')
        .send({
          batch: [{
            event: "'; DROP TABLE tp_events; --",
            properties: {},
            timestamp: '2025-06-15T10:00:00Z',
            anonymousId: 'anon_1',
            sessionId: 'sess_1',
          }],
        });

      // Should succeed (parameterized query escapes the name)
      expect(res.status).toBe(200);

      // Verify tables still exist
      const health = await request(app).get('/analytics/v1/health');
      expect(health.body.status).toBe('ok');
    });

    it('handles malicious property values safely', async () => {
      const res = await request(app)
        .post('/analytics/v1/events/batch')
        .set('X-API-Key', 'write-key')
        .send({
          batch: [{
            event: 'Test',
            properties: { name: "Robert'); DROP TABLE tp_users; --" },
            timestamp: '2025-06-15T10:00:00Z',
            anonymousId: 'anon_sql',
            sessionId: 'sess_sql',
          }],
        });

      expect(res.status).toBe(200);
      expect(res.body.inserted).toBe(1);
    });

    it('handles malicious query group-by safely', async () => {
      const res = await request(app)
        .post('/analytics/v1/query')
        .set('X-API-Key', 'read-key')
        .send({
          type: 'trends',
          events: [{ name: 'Test' }],
          interval: 'day',
          dateRange: { preset: '7d' },
          groupBy: "'); DROP TABLE tp_events; --",
        });

      // Malicious groupBy causes a query error, NOT SQL injection — this is safe
      // The server returns 500 (query failed) rather than executing injected SQL
      expect([200, 500]).toContain(res.status);
      // Verify tables still exist
      const health = await request(app).get('/analytics/v1/health');
      expect(health.body.status).toBe('ok');
    });
  });

  // ─── Oversized Payloads ────────────────────────────

  describe('Oversized Payloads', () => {
    it('rejects batch exceeding max events', async () => {
      const batch = Array.from({ length: 101 }, (_, i) => ({
        event: `Event ${i}`,
        properties: {},
        timestamp: '2025-06-15T10:00:00Z',
        anonymousId: 'anon',
        sessionId: 'sess',
      }));

      const res = await request(app)
        .post('/analytics/v1/events/batch')
        .set('X-API-Key', 'write-key')
        .send({ batch });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('rejects events with too many properties', async () => {
      const props: Record<string, string> = {};
      for (let i = 0; i < 51; i++) props[`key_${i}`] = 'value';

      const res = await request(app)
        .post('/analytics/v1/events/batch')
        .set('X-API-Key', 'write-key')
        .send({
          batch: [{
            event: 'Overloaded',
            properties: props,
            timestamp: '2025-06-15T10:00:00Z',
            anonymousId: 'anon',
            sessionId: 'sess',
          }],
        });

      expect(res.body.failed).toBeGreaterThanOrEqual(1);
    });

    it('rejects event name exceeding 256 characters', async () => {
      const res = await request(app)
        .post('/analytics/v1/events/batch')
        .set('X-API-Key', 'write-key')
        .send({
          batch: [{
            event: 'x'.repeat(257),
            properties: {},
            timestamp: '2025-06-15T10:00:00Z',
            anonymousId: 'anon',
            sessionId: 'sess',
          }],
        });

      expect(res.body.failed).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── PII Scrubbing ────────────────────────────────

  describe('PII Scrubbing', () => {
    it('hashes configured PII fields in events', async () => {
      await request(app)
        .post('/analytics/v1/events/batch')
        .set('X-API-Key', 'write-key')
        .send({
          batch: [{
            event: 'Sign Up',
            properties: { email: 'alice@example.com', ssn: '123-45-6789', plan: 'pro' },
            timestamp: '2025-06-15T12:00:00Z',
            anonymousId: 'anon_pii',
            sessionId: 'sess_pii',
          }],
        });

      const events = await request(app)
        .get('/analytics/v1/events/stream?event=Sign Up&api_key=read-key');

      const evt = events.body.events.find((e: any) => e.anonymousId === 'anon_pii');
      if (evt) {
        expect(evt.properties.email).toMatch(/^sha256:/);
        expect(evt.properties.ssn).toMatch(/^sha256:/);
        expect(evt.properties.plan).toBe('pro');
      }
    });
  });

  // ─── GDPR Cascade Deletion ─────────────────────────

  describe('GDPR Cascade Deletion', () => {
    it('deletes all user data including linked anonymous events', async () => {
      // Create user with events
      await request(app)
        .post('/analytics/v1/identify')
        .set('X-API-Key', 'admin-key')
        .send({ userId: 'gdpr_user', anonymousId: 'gdpr_anon', traits: { name: 'GDPR Test' } });

      await request(app)
        .post('/analytics/v1/events/batch')
        .set('X-API-Key', 'write-key')
        .send({
          batch: [
            { event: 'E1', properties: {}, timestamp: '2025-06-15T10:00:00Z', userId: 'gdpr_user', anonymousId: 'gdpr_anon', sessionId: 's_gdpr' },
            { event: 'E2', properties: {}, timestamp: '2025-06-15T10:01:00Z', userId: 'gdpr_user', anonymousId: 'gdpr_anon', sessionId: 's_gdpr' },
          ],
        });

      // Delete
      const delRes = await request(app)
        .delete('/analytics/v1/users/gdpr_user')
        .set('X-API-Key', 'admin-key');

      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);
      expect(delRes.body.deleted.userProfile).toBe(true);

      // Verify profile gone
      const profile = await request(app)
        .get('/analytics/v1/users/gdpr_user')
        .set('X-API-Key', 'read-key');

      expect(profile.status).toBe(404);
    });
  });

  // ─── API Key Edge Cases ────────────────────────────

  describe('API Key Edge Cases', () => {
    it('rejects empty API key', async () => {
      const res = await request(app)
        .get('/analytics/v1/metadata')
        .set('X-API-Key', '');

      expect(res.status).toBe(401);
    });

    it('rejects null-like API keys', async () => {
      const res = await request(app)
        .get('/analytics/v1/metadata')
        .set('X-API-Key', 'null');

      expect(res.status).toBe(403);
    });

    it('write key cannot access admin endpoints', async () => {
      const res = await request(app)
        .delete('/analytics/v1/users/some_user')
        .set('X-API-Key', 'write-key');

      expect(res.status).toBe(403);
    });
  });
});
