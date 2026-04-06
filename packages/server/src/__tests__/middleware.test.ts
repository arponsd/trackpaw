import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { rateLimiter } from '../middleware/rate-limiter';
import { errorHandler } from '../middleware/error-handler';
import { authMiddleware, requirePermission } from '../middleware/auth';

describe('Rate Limiter', () => {
  it('allows requests under the limit', async () => {
    const app = express();
    app.use(rateLimiter({ enabled: true, windowMs: 60000, maxRequests: 5 }));
    app.get('/test', (_req, res) => res.json({ ok: true }));

    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
  });

  it('blocks requests over the limit', async () => {
    const app = express();
    app.use(rateLimiter({ enabled: true, windowMs: 60000, maxRequests: 2 }));
    app.get('/test', (_req, res) => res.json({ ok: true }));

    await request(app).get('/test');
    await request(app).get('/test');
    const res = await request(app).get('/test');

    expect(res.status).toBe(429);
    expect(res.body.error).toBe('RATE_LIMITED');
    expect(res.body.retryAfter).toBeGreaterThan(0);
  });

  it('passes through when disabled', async () => {
    const app = express();
    app.use(rateLimiter({ enabled: false }));
    app.get('/test', (_req, res) => res.json({ ok: true }));

    for (let i = 0; i < 200; i++) {
      await request(app).get('/test');
    }
    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
  });
});

describe('Error Handler', () => {
  it('formats errors with standard shape', async () => {
    const app = express();
    app.get('/error', (_req, _res, next) => {
      const err: any = new Error('Something broke');
      err.status = 503;
      err.code = 'CUSTOM_ERROR';
      next(err);
    });
    app.use(errorHandler());

    const res = await request(app).get('/error');
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('CUSTOM_ERROR');
    expect(res.body.message).toBe('Something broke');
  });

  it('defaults to 500 for unspecified status', async () => {
    const app = express();
    app.get('/error', (_req, _res, next) => next(new Error('Unknown')));
    app.use(errorHandler());

    const res = await request(app).get('/error');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('INTERNAL_ERROR');
  });
});

describe('Auth Middleware', () => {
  it('supports query param api_key', async () => {
    const app = express();
    app.use(authMiddleware({ apiKey: 'test-key' }));
    app.get('/test', (req, res) => res.json({ permission: req.analyticsPermission }));

    const res = await request(app).get('/test?api_key=test-key');
    expect(res.status).toBe(200);
    expect(res.body.permission).toBe('admin');
  });

  it('resolves multi-key permissions correctly', async () => {
    const app = express();
    app.use(authMiddleware({ apiKeys: { write: ['w'], read: ['r'], admin: ['a'] } }));
    app.get('/test', (req, res) => res.json({ permission: req.analyticsPermission }));

    const r1 = await request(app).get('/test').set('X-API-Key', 'w');
    expect(r1.body.permission).toBe('write');

    const r2 = await request(app).get('/test').set('X-API-Key', 'r');
    expect(r2.body.permission).toBe('read');

    const r3 = await request(app).get('/test').set('X-API-Key', 'a');
    expect(r3.body.permission).toBe('admin');
  });

  it('requirePermission blocks insufficient level', async () => {
    const app = express();
    app.use(authMiddleware({ apiKeys: { write: ['w'], read: ['r'], admin: ['a'] } }));
    app.get('/admin', requirePermission('admin'), (_req, res) => res.json({ ok: true }));

    const res = await request(app).get('/admin').set('X-API-Key', 'r');
    expect(res.status).toBe(403);
  });
});
