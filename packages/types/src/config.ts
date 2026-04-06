import type { RawEvent, ValidatedEvent } from './events';
import type { AnalyticsQuery, QueryResult } from './queries';
import type { StorageAdapter, InsertResult } from './adapter';

// ─── Tracker Config ────────────────────────────────────────────────

export interface AutoTrackConfig {
  pageViews?: boolean;
  clicks?: boolean;
  forms?: boolean;
  outboundLinks?: boolean;
}

export interface TrackerConfig {
  endpoint: string;
  apiKey: string;
  flushInterval?: number;
  flushQueueSize?: number;
  maxQueueSize?: number;
  persistence?: 'localStorage' | 'memory' | 'cookie';
  persistencePrefix?: string;
  sessionTimeout?: number;
  autoTrack?: AutoTrackConfig;
  ipAnonymization?: boolean;
  respectDoNotTrack?: boolean;
  defaultProperties?: Record<string, any>;
  defaultOptOut?: boolean;
  debug?: boolean;
  onEventTracked?: (event: any) => void;
  onFlush?: (events: any[], success: boolean) => void;
  onError?: (error: Error) => void;
}

// ─── Server Config ─────────────────────────────────────────────────

export interface APIKeyConfig {
  write: string[];
  read: string[];
  admin: string[];
}

export interface RateLimitConfig {
  enabled?: boolean;
  windowMs?: number;
  maxRequests?: number;
  maxEventsPerBatch?: number;
  keyGenerator?: (req: any) => string;
}

export interface CORSConfig {
  origin: string | string[] | boolean;
  credentials?: boolean;
}

export interface PrivacyConfig {
  ipAnonymization?: boolean;
  piiFields?: string[];
  piiAction?: 'hash' | 'remove';
}

export interface ValidationConfig {
  maxEventNameLength?: number;
  maxPropertiesCount?: number;
  maxPropertyValueLength?: number;
  allowedEventNames?: string[];
  blockedEventNames?: string[];
}

export interface ServerHooks {
  beforeIngest?: (events: RawEvent[]) => RawEvent[] | Promise<RawEvent[]>;
  afterIngest?: (events: ValidatedEvent[], result: InsertResult) => void;
  beforeQuery?: (query: AnalyticsQuery) => AnalyticsQuery;
  onError?: (error: Error, context: string) => void;
}

export interface QueryCacheConfig {
  enabled: boolean;
  maxSize?: number;
  ttlSeconds?: number;
  excludeTypes?: string[];
}

export interface Logger {
  debug(msg: string, data?: any): void;
  info(msg: string, data?: any): void;
  warn(msg: string, data?: any): void;
  error(msg: string, data?: any): void;
}

export interface AnalyticsServerConfig {
  adapter: StorageAdapter;
  apiKey?: string;
  apiKeys?: APIKeyConfig;
  rateLimit?: RateLimitConfig;
  cors?: CORSConfig;
  privacy?: PrivacyConfig;
  validation?: ValidationConfig;
  hooks?: ServerHooks;
  queryCache?: QueryCacheConfig;
  logger?: Logger;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

// ─── Dashboard Config ──────────────────────────────────────────────

export interface DashboardFeatures {
  trends?: boolean;
  funnels?: boolean;
  retention?: boolean;
  eventStream?: boolean;
  userProfiles?: boolean;
  settings?: boolean;
}

export interface DashboardConfig {
  endpoint: string;
  apiKey: string;
  theme?: 'light' | 'dark' | 'system';
  accentColor?: string;
  borderRadius?: string;
  fontFamily?: string;
  features?: DashboardFeatures;
  defaultDateRange?: '24h' | '7d' | '14d' | '30d' | '90d';
  autoRefreshInterval?: number;
  basePath?: string;
  embedded?: boolean;
  locale?: string;
  timezone?: string;
  onError?: (error: Error) => void;
  onNavigate?: (path: string) => void;
}
