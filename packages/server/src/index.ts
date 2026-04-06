// Factory
export {
  createAnalyticsServer,
  type AnalyticsServerConfig,
  type AnalyticsServerInstance,
} from './core/create-server';

// Core
export { AnalyticsCore, type AnalyticsCoreConfig } from './core/analytics-core';
export { EventValidator, type ValidationConfig, type ValidationResult } from './core/event-validator';
export { EventEnricher, type RequestContext } from './core/event-enricher';
export { IdentityResolver } from './core/identity-resolver';
export { SessionResolver } from './core/session-resolver';

// Adapters
export { SQLiteAdapter, type SQLiteAdapterConfig } from './adapters/sqlite';
export { PostgresAdapter, type PostgresAdapterConfig } from './adapters/postgres';
export { MySQLAdapter, type MySQLAdapterConfig } from './adapters/mysql';
export { ClickHouseAdapter, type ClickHouseAdapterConfig } from './adapters/clickhouse';
export type {
  StorageAdapter,
  DatabaseEngine,
  InsertResult,
  DeleteResult,
  MigrationResult,
  CleanupResult,
  RetentionPolicy,
  PropertyDefinition,
  HealthCheckResult,
} from './adapters/types';

// Query Engine
export { QueryValidator, type QueryValidationResult } from './query-engine/query-validator';
export { QueryCache, type QueryCacheConfig } from './query-engine/query-cache';

// Middleware
export { authMiddleware, requirePermission, type AuthConfig, type Permission } from './middleware/auth';
export { rateLimiter, type RateLimitConfig } from './middleware/rate-limiter';
export { errorHandler } from './middleware/error-handler';

// Framework
export { createExpressRouter, type ExpressRouterConfig } from './framework/express';

// Privacy
export { anonymizeIP } from './privacy/ip-anonymizer';
export { PIIScrubber, type PIIAction } from './privacy/pii-scrubber';

// Utils
export { parseUserAgent } from './utils/ua-parser';

// Re-export query types from shared types
export type {
  TrendsQuery,
  TrendsResult,
  FunnelQuery,
  FunnelResult,
  RetentionQuery,
  RetentionResult,
  EventStreamQuery,
  EventStreamResult,
  UserListQuery,
  UserListResult,
  SegmentQuery,
  SegmentResult,
  AnalyticsQuery,
  QueryResult,
  PropertyFilter,
  DateRange,
  RawEvent,
  ValidatedEvent,
  UserProfile,
} from '@trackpaw/types';
