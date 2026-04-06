import type { ValidatedEvent } from './events';
import type { UserProfile, SessionUpdate } from './users';
import type {
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
} from './queries';

/** Database engine identifier */
export type DatabaseEngine = 'postgres' | 'mysql' | 'sqlite' | 'clickhouse' | 'custom';

/** Result from inserting events */
export interface InsertResult {
  inserted: number;
  failed: number;
}

/** Result from deleting a user */
export interface DeleteResult {
  events: number;
  sessions: number;
  userProfile: boolean;
}

/** Result from running a migration */
export interface MigrationResult {
  name: string;
  appliedAt: string;
}

/** Result from running retention cleanup */
export interface CleanupResult {
  deletedEvents: number;
  deletedSessions: number;
}

/** Retention policy configuration */
export interface RetentionPolicy {
  events: string;
  sessions: string;
  users: string;
}

/** Property definition returned by metadata queries */
export interface PropertyDefinition {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  sampleValues: any[];
}

/** Health check result */
export interface HealthCheckResult {
  ok: boolean;
  latencyMs: number;
}

/** The adapter interface that all database implementations must fulfill */
export interface StorageAdapter {
  readonly engine: DatabaseEngine;

  // Connection & Setup
  initialize(): Promise<void>;
  disconnect(): Promise<void>;
  healthCheck(): Promise<HealthCheckResult>;
  runMigrations(): Promise<MigrationResult[]>;

  // Event Ingestion
  insertEvents(events: ValidatedEvent[]): Promise<InsertResult>;

  // User Management
  upsertUser(userId: string, traits: Record<string, any>, anonymousId?: string): Promise<void>;
  getUserProfile(userId: string): Promise<UserProfile | null>;
  getUsersByAnonymousId(anonymousId: string): Promise<UserProfile[]>;
  deleteUser(userId: string): Promise<DeleteResult>;

  // Session Management
  upsertSession(session: SessionUpdate): Promise<void>;

  // Query Engine Interface
  queryTrends(query: TrendsQuery): Promise<TrendsResult>;
  queryFunnel(query: FunnelQuery): Promise<FunnelResult>;
  queryRetention(query: RetentionQuery): Promise<RetentionResult>;
  queryEventStream(query: EventStreamQuery): Promise<EventStreamResult>;
  queryUserList(query: UserListQuery): Promise<UserListResult>;
  querySegment(query: SegmentQuery): Promise<SegmentResult>;

  // Metadata
  getEventNames(options?: { limit?: number; search?: string }): Promise<string[]>;
  getEventProperties(eventName: string): Promise<PropertyDefinition[]>;
  getEventCount(range?: DateRange): Promise<number>;
  getUserCount(range?: DateRange): Promise<number>;

  // Maintenance
  runRetentionCleanup(policy: RetentionPolicy): Promise<CleanupResult>;
}
