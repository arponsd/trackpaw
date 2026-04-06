/** Context about the page where the event occurred */
export interface PageContext {
  url: string;
  path: string;
  title: string;
  referrer: string;
}

/** UTM campaign parameters */
export interface UTMContext {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
}

/** Full context attached to every event by the tracker */
export interface EventContext {
  page: PageContext;
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  screenWidth: number;
  screenHeight: number;
  locale: string;
  timezone: string;
  utm: UTMContext;
}

/** SDK metadata attached to every event */
export interface SDKInfo {
  name: string;
  version: string;
}

/** Internal metadata for transport */
export interface EventMetadata {
  sentAt: string;
  ipAnonymization: boolean;
}

/** Event as it leaves the tracker SDK */
export interface TrackedEvent {
  event: string;
  properties: Record<string, any>;
  timestamp: string;
  userId: string | null;
  anonymousId: string;
  sessionId: string;
  context: EventContext;
  sdk: SDKInfo;
  superProperties: Record<string, any>;
  _metadata: EventMetadata;
}

/** Raw event as received by the server (before validation) */
export interface RawEvent {
  event: string;
  properties: Record<string, any>;
  timestamp: string;
  userId?: string | null;
  anonymousId: string;
  sessionId: string;
  context?: Partial<EventContext>;
}

/** Event after server-side validation and enrichment */
export interface ValidatedEvent {
  id: string;
  eventName: string;
  userId: string | null;
  anonymousId: string;
  sessionId: string;
  properties: Record<string, any>;
  timestamp: string;
  receivedAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  pageUrl: string | null;
  pageTitle: string | null;
  referrer: string | null;
  deviceType: string | null;
  browser: string | null;
  os: string | null;
  country: string | null;
}

/** Batch payload sent from tracker to server */
export interface EventBatchPayload {
  batch: RawEvent[];
  sentAt: string;
}
