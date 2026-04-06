import { Router, json, type Request, type Response, type NextFunction } from 'express';
import type { AnalyticsCore } from '../core/analytics-core';
import type { AnalyticsQuery, RawEvent } from '@trackpaw/types';
import { authMiddleware, requirePermission, type AuthConfig } from '../middleware/auth';
import { rateLimiter, type RateLimitConfig } from '../middleware/rate-limiter';
import { errorHandler } from '../middleware/error-handler';
import { QueryValidator } from '../query-engine/query-validator';
import { QueryCache, type QueryCacheConfig } from '../query-engine/query-cache';
import cors from 'cors';

/** Safely extract a string param from Express route params (handles string | string[]) */
function param(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] || '' : val || '';
}

export interface ExpressRouterConfig {
  core: AnalyticsCore;
  auth: AuthConfig;
  rateLimit?: RateLimitConfig;
  cors?: { origin: string | string[] | boolean; credentials?: boolean };
  queryCache?: QueryCacheConfig;
  maxEventsPerBatch?: number;
}

export function createExpressRouter(config: ExpressRouterConfig): Router {
  const router = Router();
  const { core } = config;
  const queryValidator = new QueryValidator();
  const queryCache = config.queryCache
    ? new QueryCache(config.queryCache)
    : null;
  const maxBatch = config.maxEventsPerBatch ?? 100;

  // ─── Global middleware ──────────────────────────────

  if (config.cors) {
    router.use(cors(config.cors));
  }

  router.use(json({ limit: '1mb' }));
  router.use(rateLimiter(config.rateLimit));

  // ─── Health (no auth) ───────────────────────────────

  router.get('/v1/health', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const adapter = core.getAdapter();
      const health = await adapter.healthCheck();
      const uptime = process.uptime();

      res.json({
        status: health.ok ? 'ok' : 'error',
        version: '0.1.0',
        adapter: adapter.engine,
        uptime: Math.floor(uptime),
        database: {
          connected: health.ok,
          latencyMs: health.latencyMs,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── Auth required for everything below ─────────────

  router.use('/v1/events', authMiddleware(config.auth));
  router.use('/v1/identify', authMiddleware(config.auth));
  router.use('/v1/query', authMiddleware(config.auth));
  router.use('/v1/users', authMiddleware(config.auth));
  router.use('/v1/metadata', authMiddleware(config.auth));

  // ─── POST /v1/events/batch ──────────────────────────

  router.post(
    '/v1/events/batch',
    requirePermission('write', 'admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { batch, sentAt } = req.body as { batch?: RawEvent[]; sentAt?: string };

        if (!batch || !Array.isArray(batch)) {
          res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: 'Request body must contain a "batch" array',
            status: 400,
          });
          return;
        }

        if (batch.length > maxBatch) {
          res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: `Batch size exceeds maximum of ${maxBatch}`,
            status: 400,
          });
          return;
        }

        const result = await core.ingestEvents(batch, {
          ip: req.ip || req.socket.remoteAddress || 'unknown',
          userAgent: req.headers['user-agent'] || '',
        });

        res.status(result.success ? 200 : 400).json({
          success: result.success,
          inserted: result.inserted,
          failed: result.failed,
          errors: result.errors,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  // ─── POST /v1/identify ──────────────────────────────

  router.post(
    '/v1/identify',
    requirePermission('write', 'admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { userId, anonymousId, traits } = req.body;

        if (!userId || !anonymousId) {
          res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: 'userId and anonymousId are required',
            status: 400,
          });
          return;
        }

        const result = await core.identifyUser(userId, traits || {}, anonymousId);

        res.json({
          success: true,
          userId,
          isNewUser: result.isNewUser,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  // ─── POST /v1/query ─────────────────────────────────

  router.post(
    '/v1/query',
    requirePermission('read', 'admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const query = req.body as AnalyticsQuery;

        const validation = queryValidator.validate(query);
        if (!validation.valid) {
          res.status(400).json({
            error: 'INVALID_QUERY',
            message: validation.error,
            status: 400,
          });
          return;
        }

        // Check cache
        if (queryCache) {
          const cached = queryCache.get(query);
          if (cached) {
            res.json(cached);
            return;
          }
        }

        const startTime = Date.now();
        const result = await core.executeQuery(query);

        // Add query timing
        (result as any).queryTimeMs = Date.now() - startTime;

        // Cache result
        queryCache?.set(query, result);

        res.json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  // ─── GET /v1/events/stream ──────────────────────────

  router.get(
    '/v1/events/stream',
    requirePermission('read', 'admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await core.executeQuery({
          type: 'event_stream',
          filters: {
            eventNames: req.query.event
              ? String(req.query.event).split(',')
              : undefined,
            userId: req.query.user_id as string | undefined,
            sessionId: req.query.session_id as string | undefined,
            dateRange:
              req.query.from || req.query.to
                ? {
                    start: req.query.from as string | undefined,
                    end: req.query.to as string | undefined,
                  }
                : undefined,
          },
          limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
          offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
          orderBy: req.query.order === 'asc' ? 'timestamp_asc' : 'timestamp_desc',
        });

        res.json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  // ─── GET /v1/users ──────────────────────────────────

  router.get(
    '/v1/users',
    requirePermission('read', 'admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await core.executeQuery({
          type: 'user_list',
          search: req.query.search as string | undefined,
          sortBy: (req.query.sort as any) || 'last_seen',
          order: (req.query.order as any) || 'desc',
          limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
          offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
        });

        res.json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  // ─── GET /v1/users/:userId ──────────────────────────

  router.get(
    '/v1/users/:userId',
    requirePermission('read', 'admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const profile = await core.getAdapter().getUserProfile(param(req, 'userId'));

        if (!profile) {
          res.status(404).json({
            error: 'USER_NOT_FOUND',
            message: `User ${param(req, 'userId')} not found`,
            status: 404,
          });
          return;
        }

        // Get recent events
        const eventsResult = await core.executeQuery({
          type: 'event_stream',
          filters: { userId: param(req, 'userId') },
          limit: 10,
          orderBy: 'timestamp_desc',
        });

        res.json({
          userId: profile.userId,
          traits: profile.traits,
          firstSeen: profile.firstSeen,
          lastSeen: profile.lastSeen,
          totalEvents: profile.totalEvents,
          totalSessions: profile.totalSessions,
          recentEvents: (eventsResult as any).events || [],
        });
      } catch (err) {
        next(err);
      }
    },
  );

  // ─── DELETE /v1/users/:userId ───────────────────────

  router.delete(
    '/v1/users/:userId',
    requirePermission('admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await core.deleteUser(param(req, 'userId'));

        res.json({
          success: true,
          deleted: {
            events: result.events,
            sessions: result.sessions,
            userProfile: result.userProfile,
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  // ─── GET /v1/users/:userId/export ───────────────────

  router.get(
    '/v1/users/:userId/export',
    requirePermission('admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const data = await core.exportUserData(param(req, 'userId'));

        res.setHeader('Content-Disposition', `attachment; filename=user_${param(req, 'userId')}.json`);
        res.json(data);
      } catch (err) {
        next(err);
      }
    },
  );

  // ─── GET /v1/metadata ───────────────────────────────

  router.get(
    '/v1/metadata',
    requirePermission('read', 'admin'),
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const meta = await core.getMetadata();
        res.json(meta);
      } catch (err) {
        next(err);
      }
    },
  );

  // ─── GET /v1/metadata/events/:eventName/properties ──

  router.get(
    '/v1/metadata/events/:eventName/properties',
    requirePermission('read', 'admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const props = await core.getAdapter().getEventProperties(param(req, 'eventName'));

        res.json({
          eventName: param(req, 'eventName'),
          properties: props,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  // ─── Error handler ──────────────────────────────────

  router.use(errorHandler());

  return router;
}
