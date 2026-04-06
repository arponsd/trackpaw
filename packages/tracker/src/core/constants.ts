export const SDK_NAME = '@trackpaw/tracker';
export const SDK_VERSION = '0.1.0';

export const DEFAULT_FLUSH_INTERVAL = 5000; // 5 seconds
export const DEFAULT_FLUSH_QUEUE_SIZE = 10;
export const DEFAULT_MAX_QUEUE_SIZE = 1000;
export const DEFAULT_SESSION_TIMEOUT = 1800000; // 30 minutes
export const DEFAULT_PERSISTENCE_PREFIX = 'tp_';

export const STORAGE_KEYS = {
  ANONYMOUS_ID: 'anonymous_id',
  USER_ID: 'user_id',
  SESSION_ID: 'session_id',
  SESSION_LAST_ACTIVITY: 'session_last_activity',
  QUEUE: 'queue',
  OPT_OUT: 'opt_out',
  SUPER_PROPERTIES: 'super_props',
  SET_ONCE_PROPERTIES: 'set_once_props',
  USER_TRAITS: 'user_traits',
} as const;
