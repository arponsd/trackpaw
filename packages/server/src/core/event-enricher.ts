import type { RawEvent, ValidatedEvent } from '@trackpaw/types';
import { parseUserAgent } from '../utils/ua-parser';

let idCounter = 0;

function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  idCounter = (idCounter + 1) % 100000;
  return `${ts}-${rand}-${idCounter.toString(36)}`;
}

export interface RequestContext {
  ip: string;
  userAgent: string;
}

export class EventEnricher {
  enrich(event: RawEvent, context: RequestContext): ValidatedEvent {
    const ua = parseUserAgent(context.userAgent);
    const now = new Date().toISOString();

    return {
      id: generateId(),
      eventName: event.event,
      userId: event.userId || null,
      anonymousId: event.anonymousId,
      sessionId: event.sessionId,
      properties: event.properties || {},
      timestamp: event.timestamp || now,
      receivedAt: now,
      ipAddress: context.ip,
      userAgent: context.userAgent,
      pageUrl: event.context?.page?.url || null,
      pageTitle: event.context?.page?.title || null,
      referrer: event.context?.page?.referrer || null,
      deviceType: ua.deviceType,
      browser: ua.browser,
      os: ua.os,
      country: null, // geolocation is optional
    };
  }
}
