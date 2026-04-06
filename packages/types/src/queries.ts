// ─── Shared Filter Types ───────────────────────────────────────────

export interface PropertyFilter {
  key: string;
  operator:
    | 'eq'
    | 'neq'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'contains'
    | 'not_contains'
    | 'is_set'
    | 'is_not_set'
    | 'in'
    | 'not_in';
  value?: any;
  values?: any[];
}

export interface DateRange {
  preset?: '24h' | '7d' | '14d' | '30d' | '90d' | '365d';
  start?: string;
  end?: string;
}

export type GlobalFilter = PropertyFilter;

// ─── Trends ────────────────────────────────────────────────────────

export interface TrendsEventDefinition {
  name: string;
  filters?: PropertyFilter[];
  aggregation?:
    | 'total'
    | 'unique_users'
    | 'unique_sessions'
    | 'avg_per_user'
    | 'property_sum'
    | 'property_avg';
  propertyKey?: string;
}

export interface TrendsQuery {
  type: 'trends';
  events: TrendsEventDefinition[];
  interval: 'hour' | 'day' | 'week' | 'month';
  dateRange: DateRange;
  filters?: GlobalFilter[];
  groupBy?: string;
}

export interface TrendsDataPoint {
  date: string;
  value: number;
}

export interface TrendsSeries {
  event: string;
  groupValue?: string;
  data: TrendsDataPoint[];
  total: number;
}

export interface TrendsResult {
  type: 'trends';
  series: TrendsSeries[];
  dateRange: { start: string; end: string };
  queryTimeMs: number;
}

// ─── Funnel ────────────────────────────────────────────────────────

export interface FunnelStep {
  event: string;
  filters?: PropertyFilter[];
}

export interface FunnelQuery {
  type: 'funnel';
  steps: FunnelStep[];
  dateRange: DateRange;
  conversionWindow?: number;
  groupBy?: string;
  countType?: 'unique_users' | 'total';
}

export interface FunnelStepResult {
  event: string;
  count: number;
  conversionRate: number;
  overallRate: number;
  dropoff: number;
  medianTimeBetween?: number;
}

export interface FunnelResult {
  type: 'funnel';
  steps: FunnelStepResult[];
  groupedResults?: Record<string, FunnelStepResult[]>;
  queryTimeMs: number;
}

// ─── Retention ─────────────────────────────────────────────────────

export interface RetentionQuery {
  type: 'retention';
  startEvent: string;
  returnEvent: string;
  dateRange: DateRange;
  interval: 'day' | 'week' | 'month';
  periods: number;
  filters?: GlobalFilter[];
}

export interface RetentionPeriod {
  period: number;
  count: number;
  percentage: number;
}

export interface RetentionCohort {
  date: string;
  cohortSize: number;
  retention: RetentionPeriod[];
}

export interface RetentionResult {
  type: 'retention';
  cohorts: RetentionCohort[];
  queryTimeMs: number;
}

// ─── Event Stream ──────────────────────────────────────────────────

export interface EventStreamQuery {
  type: 'event_stream';
  filters?: {
    eventNames?: string[];
    userId?: string;
    anonymousId?: string;
    sessionId?: string;
    properties?: PropertyFilter[];
    dateRange?: DateRange;
  };
  limit?: number;
  offset?: number;
  orderBy?: 'timestamp_asc' | 'timestamp_desc';
}

export interface EventStreamItem {
  id: string;
  event: string;
  userId: string | null;
  anonymousId: string;
  sessionId: string;
  properties: Record<string, any>;
  timestamp: string;
  context: {
    browser: string | null;
    os: string | null;
    deviceType: string | null;
  };
}

export interface EventStreamResult {
  type: 'event_stream';
  events: EventStreamItem[];
  total: number;
  limit: number;
  offset: number;
}

// ─── User List ─────────────────────────────────────────────────────

export interface UserListQuery {
  type: 'user_list';
  search?: string;
  sortBy?: 'last_seen' | 'first_seen' | 'total_events' | 'total_sessions';
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface UserListItem {
  userId: string;
  traits: Record<string, any>;
  firstSeen: string;
  lastSeen: string;
  totalEvents: number;
  totalSessions: number;
}

export interface UserListResult {
  type: 'user_list';
  users: UserListItem[];
  total: number;
  limit: number;
  offset: number;
}

// ─── Segment ───────────────────────────────────────────────────────

export interface SegmentCondition {
  event: string;
  operator: 'did' | 'did_not';
  count?: { operator: 'gte' | 'lte' | 'eq'; value: number };
  dateRange?: DateRange;
  properties?: PropertyFilter[];
}

export interface SegmentQuery {
  type: 'segment';
  conditions: SegmentCondition[];
  combinator: 'and' | 'or';
  output: 'count' | 'user_list';
  limit?: number;
}

export interface SegmentResult {
  type: 'segment';
  count: number;
  users?: UserListItem[];
  queryTimeMs: number;
}

// ─── Union Query Type ──────────────────────────────────────────────

export type AnalyticsQuery =
  | TrendsQuery
  | FunnelQuery
  | RetentionQuery
  | EventStreamQuery
  | UserListQuery
  | SegmentQuery;

export type QueryResult =
  | TrendsResult
  | FunnelResult
  | RetentionResult
  | EventStreamResult
  | UserListResult
  | SegmentResult;
