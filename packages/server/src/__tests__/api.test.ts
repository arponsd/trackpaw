import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createAnalyticsServer } from '../core/create-server';
import { SQLiteAdapter } from '../adapters/sqlite';

describe('REST API', () => {
  let app: express.Express;
  let adapter: SQLiteAdapter;

  const WRITE_KEY = 'test-write-key';
  const READ_KEY = 'test-read-key';
  const ADMIN_KEY = 'test-admin-key';

  beforeAll(async () => {
    adapter = new SQLiteAdapter({ filename: ':memory:' });
    await adapter.initialize();

    const analytics = createAnalyticsServer({
      adapter,
      apiKeys: {
        write: [WRITE_KEY],
        read: [READ_KEY],
        admin: [ADMIN_KEY],
      },
    });

    app = express();
    app.use('/analytics', analytics.router);
  });

  afterAll(async () => {
    await adapter.disconnect();
  });

  // ─── Health ────────────────────────────────────────

  describe('GET /v1/health', () => {
    it('returns health status without auth', async () => {
      const res = await request(app).get('/analytics/v1/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.adapter).toBe('sqlite');
      expect(res.body.database.connected).toBe(true);
    });
  });

  // ─── Auth ──────────────────────────────────────────

  describe('Authentication', () => {
    it('rejects requests without API key', async () => {
      const res = await request(app).post('/analytics/v1/events/batch').send({ batch: [] });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('INVALID_API_KEY');
    });

    it('rejects requests with invalid API key', async () => {
      const res = await request(app)
        .post('/analytics/v1/events/batch')
        .set('X-API-Key', 'wrong-key')
        .send({ batch: [] });

      expect(res.status).toBe(403);
    });

    it('accepts API key via query param', async () => {
      const res = await request(app)
        .get('/analytics/v1/metadata?api_key=' + READ_KEY);

      expect(res.status).toBe(200);
    });
  });

  // ─── Permission Levels ─────────────────────────────

  describe('Permissions', () => {
    it('write key cannot read data', async () => {
      const res = await request(app)
        .post('/analytics/v1/query')
        .set('X-API-Key', WRITE_KEY)
        .send({ type: 'trends', events: [{ name: 'Test' }], interval: 'day', dateRange: { preset: '7d' } });

      expect(res.status).toBe(403);
    });

    it('read key cannot ingest events', async () => {
      const res = await request(app)
        .post('/analytics/v1/events/batch')
        .set('X-API-Key', READ_KEY)
        .send({ batch: [] });

      expect(res.status).toBe(403);
    });

    it('read key cannot delete users', async () => {
      const res = await request(app)
        .delete('/analytics/v1/users/some_user')
        .set('X-API-Key', READ_KEY);

      expect(res.status).toBe(403);
    });

    it('admin key can do everything', async () => {
      const res = await request(app)
        .get('/analytics/v1/metadata')
        .set('X-API-Key', ADMIN_KEY);

      expect(res.status).toBe(200);
    });
  });

  // ─── Event Ingestion ───────────────────────────────

  describe('POST /v1/events/batch', () => {
    it('ingests valid events', async () => {
      const res = await request(app)
        .post('/analytics/v1/events/batch')
        .set('X-API-Key', WRITE_KEY)
        .send({
          batch: [
            {
              event: 'Sign Up',
              properties: { plan: 'free' },
              timestamp: '2025-06-15T10:00:00Z',
              anonymousId: 'anon_api_1',
              sessionId: 'sess_api_1',
            },
            {
              event: 'Purchase',
              properties: { amount: 49.99 },
              timestamp: '2025-06-15T10:05:00Z',
              anonymousId: 'anon_api_1',
              sessionId: 'sess_api_1',
            },
          ],
          sentAt: '2025-06-15T10:06:00Z',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.inserted).toBe(2);
      expect(res.body.failed).toBe(0);
    });

    it('rejects malformed body', async () => {
      const res = await request(app)
        .post('/analytics/v1/events/batch')
        .set('X-API-Key', WRITE_KEY)
        .send({ data: 'not a batch' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('rejects invalid events and reports errors', async () => {
      const res = await request(app)
        .post('/analytics/v1/events/batch')
        .set('X-API-Key', WRITE_KEY)
        .send({
          batch: [
            { event: '', properties: {}, timestamp: '2025-06-15T10:00:00Z', anonymousId: 'a', sessionId: 's' },
          ],
        });

      expect(res.body.inserted).toBe(0);
      expect(res.body.failed).toBe(1);
      expect(res.body.errors.length).toBe(1);
    });
  });

  // ─── Identify ──────────────────────────────────────

  describe('POST /v1/identify', () => {
    it('identifies a user', async () => {
      const res = await request(app)
        .post('/analytics/v1/identify')
        .set('X-API-Key', WRITE_KEY)
        .send({
          userId: 'user_api_1',
          anonymousId: 'anon_api_1',
          traits: { name: 'API Test User', plan: 'pro' },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.userId).toBe('user_api_1');
      expect(res.body.isNewUser).toBe(true);
    });

    it('rejects missing userId', async () => {
      const res = await request(app)
        .post('/analytics/v1/identify')
        .set('X-API-Key', WRITE_KEY)
        .send({ anonymousId: 'a' });

      expect(res.status).toBe(400);
    });
  });

  // ─── Query ─────────────────────────────────────────

  describe('POST /v1/query', () => {
    it('executes a trends query', async () => {
      const res = await request(app)
        .post('/analytics/v1/query')
        .set('X-API-Key', READ_KEY)
        .send({
          type: 'trends',
          events: [{ name: 'Sign Up', aggregation: 'total' }],
          interval: 'day',
          dateRange: { start: '2025-06-15', end: '2025-06-16' },
        });

      expect(res.status).toBe(200);
      expect(res.body.type).toBe('trends');
      expect(res.body.series).toBeDefined();
    });

    it('validates invalid queries', async () => {
      const res = await request(app)
        .post('/analytics/v1/query')
        .set('X-API-Key', READ_KEY)
        .send({
          type: 'funnel',
          steps: [{ event: 'Only One Step' }],
          dateRange: { preset: '7d' },
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_QUERY');
    });

    it('executes a funnel query', async () => {
      const res = await request(app)
        .post('/analytics/v1/query')
        .set('X-API-Key', READ_KEY)
        .send({
          type: 'funnel',
          steps: [{ event: 'Sign Up' }, { event: 'Purchase' }],
          dateRange: { start: '2025-06-15', end: '2025-06-16' },
        });

      expect(res.status).toBe(200);
      expect(res.body.type).toBe('funnel');
      expect(res.body.steps.length).toBe(2);
    });
  });

  // ─── Event Stream ──────────────────────────────────

  describe('GET /v1/events/stream', () => {
    it('returns events', async () => {
      const res = await request(app)
        .get('/analytics/v1/events/stream')
        .set('X-API-Key', READ_KEY);

      expect(res.status).toBe(200);
      expect(res.body.type).toBe('event_stream');
      expect(Array.isArray(res.body.events)).toBe(true);
    });

    it('filters by event name', async () => {
      const res = await request(app)
        .get('/analytics/v1/events/stream?event=Sign Up')
        .set('X-API-Key', READ_KEY);

      expect(res.status).toBe(200);
      for (const event of res.body.events) {
        expect(event.event).toBe('Sign Up');
      }
    });
  });

  // ─── Users ─────────────────────────────────────────

  describe('GET /v1/users', () => {
    it('returns user list', async () => {
      const res = await request(app)
        .get('/analytics/v1/users')
        .set('X-API-Key', READ_KEY);

      expect(res.status).toBe(200);
      expect(res.body.type).toBe('user_list');
      expect(Array.isArray(res.body.users)).toBe(true);
    });
  });

  describe('GET /v1/users/:userId', () => {
    it('returns user profile', async () => {
      const res = await request(app)
        .get('/analytics/v1/users/user_api_1')
        .set('X-API-Key', READ_KEY);

      expect(res.status).toBe(200);
      expect(res.body.userId).toBe('user_api_1');
      expect(res.body.traits.name).toBe('API Test User');
    });

    it('returns 404 for unknown user', async () => {
      const res = await request(app)
        .get('/analytics/v1/users/nonexistent')
        .set('X-API-Key', READ_KEY);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('USER_NOT_FOUND');
    });
  });

  // ─── Metadata ──────────────────────────────────────

  describe('GET /v1/metadata', () => {
    it('returns event metadata', async () => {
      const res = await request(app)
        .get('/analytics/v1/metadata')
        .set('X-API-Key', READ_KEY);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.eventNames)).toBe(true);
      expect(typeof res.body.eventCount).toBe('number');
      expect(typeof res.body.userCount).toBe('number');
    });
  });

  describe('GET /v1/metadata/events/:eventName/properties', () => {
    it('returns event properties', async () => {
      const res = await request(app)
        .get('/analytics/v1/metadata/events/Sign Up/properties')
        .set('X-API-Key', READ_KEY);

      expect(res.status).toBe(200);
      expect(res.body.eventName).toBe('Sign Up');
      expect(Array.isArray(res.body.properties)).toBe(true);
    });
  });

  // ─── GDPR ──────────────────────────────────────────

  describe('DELETE /v1/users/:userId', () => {
    it('deletes user data (admin only)', async () => {
      // First create a user to delete
      await request(app)
        .post('/analytics/v1/identify')
        .set('X-API-Key', ADMIN_KEY)
        .send({ userId: 'user_to_delete', anonymousId: 'anon_del', traits: { name: 'Delete Me' } });

      const res = await request(app)
        .delete('/analytics/v1/users/user_to_delete')
        .set('X-API-Key', ADMIN_KEY);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.deleted.userProfile).toBe(true);
    });
  });

  describe('GET /v1/users/:userId/export', () => {
    it('exports user data (admin only)', async () => {
      // Create a user
      await request(app)
        .post('/analytics/v1/identify')
        .set('X-API-Key', ADMIN_KEY)
        .send({ userId: 'user_export', anonymousId: 'anon_exp', traits: { name: 'Export Me' } });

      const res = await request(app)
        .get('/analytics/v1/users/user_export/export')
        .set('X-API-Key', ADMIN_KEY);

      expect(res.status).toBe(200);
      expect(res.body.profile).not.toBeNull();
      expect(res.body.exportedAt).toBeTruthy();
    });
  });
});
