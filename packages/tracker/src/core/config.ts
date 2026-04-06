import {
  DEFAULT_FLUSH_INTERVAL,
  DEFAULT_FLUSH_QUEUE_SIZE,
  DEFAULT_MAX_QUEUE_SIZE,
  DEFAULT_SESSION_TIMEOUT,
  DEFAULT_PERSISTENCE_PREFIX,
} from './constants';

export interface AutoTrackConfig {
  pageViews: boolean;
  clicks: boolean;
  forms: boolean;
  outboundLinks: boolean;
}

export interface TrackerInitConfig {
  endpoint: string;
  apiKey: string;
  flushInterval?: number;
  flushQueueSize?: number;
  maxQueueSize?: number;
  persistence?: 'localStorage' | 'memory' | 'cookie';
  persistencePrefix?: string;
  sessionTimeout?: number;
  autoTrack?: Partial<AutoTrackConfig>;
  ipAnonymization?: boolean;
  respectDoNotTrack?: boolean;
  defaultProperties?: Record<string, any>;
  defaultOptOut?: boolean;
  debug?: boolean;
  onEventTracked?: (event: any) => void;
  onFlush?: (events: any[], success: boolean) => void;
  onError?: (error: Error) => void;
}

export interface ResolvedConfig {
  endpoint: string;
  apiKey: string;
  flushInterval: number;
  flushQueueSize: number;
  maxQueueSize: number;
  persistence: 'localStorage' | 'memory' | 'cookie';
  persistencePrefix: string;
  sessionTimeout: number;
  autoTrack: AutoTrackConfig;
  ipAnonymization: boolean;
  respectDoNotTrack: boolean;
  defaultProperties: Record<string, any>;
  defaultOptOut: boolean;
  debug: boolean;
  onEventTracked?: (event: any) => void;
  onFlush?: (events: any[], success: boolean) => void;
  onError?: (error: Error) => void;
}

export function resolveConfig(init: TrackerInitConfig): ResolvedConfig {
  return {
    endpoint: init.endpoint.replace(/\/+$/, ''),
    apiKey: init.apiKey,
    flushInterval: init.flushInterval ?? DEFAULT_FLUSH_INTERVAL,
    flushQueueSize: init.flushQueueSize ?? DEFAULT_FLUSH_QUEUE_SIZE,
    maxQueueSize: init.maxQueueSize ?? DEFAULT_MAX_QUEUE_SIZE,
    persistence: init.persistence ?? 'localStorage',
    persistencePrefix: init.persistencePrefix ?? DEFAULT_PERSISTENCE_PREFIX,
    sessionTimeout: init.sessionTimeout ?? DEFAULT_SESSION_TIMEOUT,
    autoTrack: {
      pageViews: init.autoTrack?.pageViews ?? true,
      clicks: init.autoTrack?.clicks ?? false,
      forms: init.autoTrack?.forms ?? false,
      outboundLinks: init.autoTrack?.outboundLinks ?? false,
    },
    ipAnonymization: init.ipAnonymization ?? true,
    respectDoNotTrack: init.respectDoNotTrack ?? false,
    defaultProperties: init.defaultProperties ?? {},
    defaultOptOut: init.defaultOptOut ?? false,
    debug: init.debug ?? false,
    onEventTracked: init.onEventTracked,
    onFlush: init.onFlush,
    onError: init.onError,
  };
}
