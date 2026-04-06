// Events
export type {
  PageContext,
  UTMContext,
  EventContext,
  SDKInfo,
  EventMetadata,
  TrackedEvent,
  RawEvent,
  ValidatedEvent,
  EventBatchPayload,
} from './events';

// Users & Sessions
export type {
  UserProfile,
  SessionRecord,
  SessionUpdate,
  IdentifyPayload,
} from './users';

// Queries
export type {
  PropertyFilter,
  DateRange,
  GlobalFilter,
  TrendsEventDefinition,
  TrendsQuery,
  TrendsDataPoint,
  TrendsSeries,
  TrendsResult,
  FunnelStep,
  FunnelQuery,
  FunnelStepResult,
  FunnelResult,
  RetentionQuery,
  RetentionPeriod,
  RetentionCohort,
  RetentionResult,
  EventStreamQuery,
  EventStreamItem,
  EventStreamResult,
  UserListQuery,
  UserListItem,
  UserListResult,
  SegmentCondition,
  SegmentQuery,
  SegmentResult,
  AnalyticsQuery,
  QueryResult,
} from './queries';

// Adapter
export type {
  DatabaseEngine,
  InsertResult,
  DeleteResult,
  MigrationResult,
  CleanupResult,
  RetentionPolicy,
  PropertyDefinition,
  HealthCheckResult,
  StorageAdapter,
} from './adapter';

// Config
export type {
  AutoTrackConfig,
  TrackerConfig,
  APIKeyConfig,
  RateLimitConfig,
  CORSConfig,
  PrivacyConfig,
  ValidationConfig,
  ServerHooks,
  QueryCacheConfig,
  Logger,
  AnalyticsServerConfig,
  DashboardFeatures,
  DashboardConfig,
} from './config';

// Errors & Responses
export type { AnalyticsErrorCode, AnalyticsError } from './errors';
export { ERROR_STATUS_MAP } from './errors';
export type {
  IngestResponse,
  IdentifyResponse,
  DeleteUserResponse,
  HealthResponse,
  MetadataResponse,
} from './errors';
