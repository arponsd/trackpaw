import type { Router } from 'express';
import type { StorageAdapter, HealthCheckResult } from '../adapters/types';
import type { RateLimitConfig } from '../middleware/rate-limiter';
import type { QueryCacheConfig } from '../query-engine/query-cache';
import type { PIIAction } from '../privacy/pii-scrubber';
import type { ValidationConfig } from './event-validator';
import type { RawEvent, ValidatedEvent, AnalyticsQuery, InsertResult } from '@trackpaw/types';
import { AnalyticsCore } from './analytics-core';
import { createExpressRouter } from '../framework/express';

export interface AnalyticsServerConfig {
  adapter: StorageAdapter;

  // Authentication
  apiKey?: string;
  apiKeys?: {
    write: string[];
    read: string[];
    admin: string[];
  };

  // Rate limiting
  rateLimit?: RateLimitConfig;

  // CORS
  cors?: {
    origin: string | string[] | boolean;
    credentials?: boolean;
  };

  // Privacy
  privacy?: {
    ipAnonymization?: boolean;
    piiFields?: string[];
    piiAction?: PIIAction;
  };

  // Event validation
  validation?: Partial<ValidationConfig>;

  // Hooks
  hooks?: {
    beforeIngest?: (events: RawEvent[]) => RawEvent[] | Promise<RawEvent[]>;
    afterIngest?: (events: ValidatedEvent[], result: InsertResult) => void;
    beforeQuery?: (query: AnalyticsQuery) => AnalyticsQuery;
    onError?: (error: Error, context: string) => void;
  };

  // Query cache
  queryCache?: QueryCacheConfig;

  // Limits
  maxEventsPerBatch?: number;
}

export interface AnalyticsServerInstance {
  /** Express router — mount with `app.use('/analytics', analytics.router)` */
  router: Router;
  /** Direct access to the core analytics engine */
  core: AnalyticsCore;
  /** Run database migrations */
  migrate(): Promise<void>;
  /** Check database health */
  healthCheck(): Promise<HealthCheckResult>;
  /** Gracefully shut down */
  shutdown(): Promise<void>;
}

export function createAnalyticsServer(config: AnalyticsServerConfig): AnalyticsServerInstance {
  const core = new AnalyticsCore({
    adapter: config.adapter,
    privacy: config.privacy,
    validation: config.validation,
    hooks: config.hooks,
  });

  const router = createExpressRouter({
    core,
    auth: {
      apiKey: config.apiKey,
      apiKeys: config.apiKeys,
    },
    rateLimit: config.rateLimit,
    cors: config.cors,
    queryCache: config.queryCache,
    maxEventsPerBatch: config.maxEventsPerBatch,
  });

  return {
    router,
    core,
    async migrate() {
      await config.adapter.initialize();
    },
    async healthCheck() {
      return config.adapter.healthCheck();
    },
    async shutdown() {
      await config.adapter.disconnect();
    },
  };
}
