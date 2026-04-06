/** User profile stored in the database */
export interface UserProfile {
  userId: string;
  anonymousIds: string[];
  traits: Record<string, any>;
  firstSeen: string;
  lastSeen: string;
  totalEvents: number;
  totalSessions: number;
  createdAt: string;
  updatedAt: string;
}

/** Session record stored in the database */
export interface SessionRecord {
  sessionId: string;
  userId: string | null;
  anonymousId: string;
  startedAt: string;
  endedAt: string | null;
  durationMs: number;
  eventCount: number;
  entryPage: string | null;
  exitPage: string | null;
  referrer: string | null;
  deviceType: string | null;
  browser: string | null;
  os: string | null;
  country: string | null;
  isBounce: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Data sent when updating a session */
export interface SessionUpdate {
  sessionId: string;
  userId?: string | null;
  anonymousId: string;
  startedAt?: string;
  endedAt?: string;
  eventCount?: number;
  entryPage?: string;
  exitPage?: string;
  referrer?: string;
  deviceType?: string;
  browser?: string;
  os?: string;
  country?: string;
}

/** Identify payload sent from tracker to server */
export interface IdentifyPayload {
  userId: string;
  anonymousId: string;
  traits: Record<string, any>;
}
