// Re-export the canonical adapter interface from shared types
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
} from '@trackpaw/types';

export type {
  ValidatedEvent,
  UserProfile,
  SessionUpdate,
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
  DateRange,
  PropertyFilter,
} from '@trackpaw/types';

/** Adapter configuration for retention */
export interface RetentionConfig {
  events: string;
  sessions: string;
  users: string;
}

/** Parse a retention string like '90d' or '365d' to milliseconds. 'forever' returns Infinity */
export function parseRetention(value: string): number {
  if (value === 'forever') return Infinity;
  const match = value.match(/^(\d+)d$/);
  if (!match) throw new Error(`Invalid retention value: ${value}`);
  return parseInt(match[1]!, 10) * 24 * 60 * 60 * 1000;
}
