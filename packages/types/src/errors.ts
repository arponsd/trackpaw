/** Error codes returned by the server */
export type AnalyticsErrorCode =
  | 'INVALID_API_KEY'
  | 'RATE_LIMITED'
  | 'VALIDATION_ERROR'
  | 'INVALID_QUERY'
  | 'USER_NOT_FOUND'
  | 'QUERY_TIMEOUT'
  | 'INTERNAL_ERROR'
  | 'ADAPTER_ERROR';

/** HTTP status codes mapped to error codes */
export const ERROR_STATUS_MAP: Record<AnalyticsErrorCode, number> = {
  INVALID_API_KEY: 401,
  RATE_LIMITED: 429,
  VALIDATION_ERROR: 400,
  INVALID_QUERY: 400,
  USER_NOT_FOUND: 404,
  QUERY_TIMEOUT: 408,
  INTERNAL_ERROR: 500,
  ADAPTER_ERROR: 500,
};

/** Standard error response shape */
export interface AnalyticsError {
  error: AnalyticsErrorCode;
  message: string;
  status: number;
  details?: any;
}

/** Ingestion response */
export interface IngestResponse {
  success: boolean;
  inserted: number;
  failed: number;
  errors: Array<{
    index: number;
    code: string;
    message: string;
  }>;
}

/** Identify response */
export interface IdentifyResponse {
  success: boolean;
  userId: string;
  isNewUser: boolean;
}

/** Delete user response */
export interface DeleteUserResponse {
  success: boolean;
  deleted: {
    events: number;
    sessions: number;
    userProfile: boolean;
  };
}

/** Health check response */
export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  version: string;
  adapter: string;
  uptime: number;
  database: {
    connected: boolean;
    latencyMs: number;
  };
}

/** Metadata response */
export interface MetadataResponse {
  eventNames: string[];
  eventCount: number;
  userCount: number;
  sessionCount: number;
  dateRange: {
    earliest: string | null;
    latest: string | null;
  };
  properties: Record<string, string[]>;
}
