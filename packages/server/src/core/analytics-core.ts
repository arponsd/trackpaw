import type {
  RawEvent,
  ValidatedEvent,
  AnalyticsQuery,
  QueryResult,
  UserProfile,
  MetadataResponse,
} from '@trackpaw/types';
import type { StorageAdapter, InsertResult } from '../adapters/types';
import { EventValidator, type ValidationConfig } from './event-validator';
import { EventEnricher, type RequestContext } from './event-enricher';
import { IdentityResolver } from './identity-resolver';
import { SessionResolver } from './session-resolver';
import { anonymizeIP } from '../privacy/ip-anonymizer';
import { PIIScrubber, type PIIAction } from '../privacy/pii-scrubber';

export interface AnalyticsCoreConfig {
  adapter: StorageAdapter;
  privacy?: {
    ipAnonymization?: boolean;
    piiFields?: string[];
    piiAction?: PIIAction;
  };
  validation?: Partial<ValidationConfig>;
  hooks?: {
    beforeIngest?: (events: RawEvent[]) => RawEvent[] | Promise<RawEvent[]>;
    afterIngest?: (events: ValidatedEvent[], result: InsertResult) => void;
    beforeQuery?: (query: AnalyticsQuery) => AnalyticsQuery;
    onError?: (error: Error, context: string) => void;
  };
}

export class AnalyticsCore {
  private adapter: StorageAdapter;
  private validator: EventValidator;
  private enricher: EventEnricher;
  private identityResolver: IdentityResolver;
  private sessionResolver: SessionResolver;
  private piiScrubber: PIIScrubber;
  private ipAnonymization: boolean;
  private hooks: AnalyticsCoreConfig['hooks'];

  constructor(private config: AnalyticsCoreConfig) {
    this.adapter = config.adapter;
    this.validator = new EventValidator(config.validation);
    this.enricher = new EventEnricher();
    this.identityResolver = new IdentityResolver(this.adapter);
    this.sessionResolver = new SessionResolver(this.adapter);
    this.piiScrubber = new PIIScrubber(
      config.privacy?.piiFields || [],
      config.privacy?.piiAction || 'hash',
    );
    this.ipAnonymization = config.privacy?.ipAnonymization ?? true;
    this.hooks = config.hooks;
  }

  /** Process and store a batch of raw events */
  async ingestEvents(
    rawEvents: RawEvent[],
    context: RequestContext,
  ): Promise<{
    success: boolean;
    inserted: number;
    failed: number;
    errors: Array<{ index: number; code: string; message: string }>;
  }> {
    const errors: Array<{ index: number; code: string; message: string }> = [];

    // 1. Run beforeIngest hook
    let events = rawEvents;
    if (this.hooks?.beforeIngest) {
      try {
        events = await this.hooks.beforeIngest(events);
      } catch (err) {
        this.hooks?.onError?.(err as Error, 'beforeIngest');
      }
    }

    // 2. Validate
    const validEvents: RawEvent[] = [];
    for (let i = 0; i < events.length; i++) {
      const result = this.validator.validate(events[i]!);
      if (result.valid) {
        validEvents.push(events[i]!);
      } else {
        errors.push({ index: i, code: 'VALIDATION_ERROR', message: result.error || 'Invalid event' });
      }
    }

    if (validEvents.length === 0) {
      return { success: false, inserted: 0, failed: errors.length, errors };
    }

    // 3. Enrich (add server-side context)
    const enrichedEvents: ValidatedEvent[] = validEvents.map((e) => {
      const enriched = this.enricher.enrich(e, context);

      // 4. Privacy: anonymize IP
      if (this.ipAnonymization && enriched.ipAddress) {
        enriched.ipAddress = anonymizeIP(enriched.ipAddress);
      }

      // 5. Privacy: scrub PII from properties
      enriched.properties = this.piiScrubber.scrub(enriched.properties);

      return enriched;
    });

    // 6. Resolve sessions
    try {
      await this.sessionResolver.resolve(enrichedEvents);
    } catch (err) {
      this.hooks?.onError?.(err as Error, 'sessionResolver');
    }

    // 7. Store events
    const insertResult = await this.adapter.insertEvents(enrichedEvents);

    // 8. Run afterIngest hook
    if (this.hooks?.afterIngest) {
      try {
        this.hooks.afterIngest(enrichedEvents, insertResult);
      } catch (err) {
        this.hooks?.onError?.(err as Error, 'afterIngest');
      }
    }

    return {
      success: true,
      inserted: insertResult.inserted,
      failed: insertResult.failed + errors.length,
      errors,
    };
  }

  /** Identify a user (link anonymous → identified) */
  async identifyUser(
    userId: string,
    traits: Record<string, any>,
    anonymousId: string,
  ): Promise<{ isNewUser: boolean }> {
    const scrubbed = this.piiScrubber.scrub(traits);
    return this.identityResolver.resolve(userId, scrubbed, anonymousId);
  }

  /** Execute an analytics query */
  async executeQuery(query: AnalyticsQuery): Promise<QueryResult> {
    let q = query;
    if (this.hooks?.beforeQuery) {
      q = this.hooks.beforeQuery(q);
    }

    switch (q.type) {
      case 'trends': return this.adapter.queryTrends(q);
      case 'funnel': return this.adapter.queryFunnel(q);
      case 'retention': return this.adapter.queryRetention(q);
      case 'event_stream': return this.adapter.queryEventStream(q);
      case 'user_list': return this.adapter.queryUserList(q);
      case 'segment': return this.adapter.querySegment(q);
      default:
        throw new Error(`Unknown query type: ${(q as any).type}`);
    }
  }

  /** Get analytics metadata */
  async getMetadata(): Promise<MetadataResponse> {
    const [eventNames, eventCount, userCount] = await Promise.all([
      this.adapter.getEventNames(),
      this.adapter.getEventCount(),
      this.adapter.getUserCount(),
    ]);

    const properties: Record<string, string[]> = {};
    for (const name of eventNames.slice(0, 20)) {
      const props = await this.adapter.getEventProperties(name);
      properties[name] = props.map((p) => p.key);
    }

    return {
      eventNames,
      eventCount,
      userCount,
      sessionCount: 0, // can be added later
      dateRange: { earliest: null, latest: null },
      properties,
    };
  }

  /** Delete all data for a user (GDPR) */
  async deleteUser(userId: string) {
    return this.adapter.deleteUser(userId);
  }

  /** Export all data for a user (GDPR) */
  async exportUserData(userId: string): Promise<{
    profile: UserProfile | null;
    events: any[];
    sessions: any[];
    exportedAt: string;
  }> {
    const profile = await this.adapter.getUserProfile(userId);
    const eventsResult = await this.adapter.queryEventStream({
      type: 'event_stream',
      filters: { userId },
      limit: 10000,
    });

    return {
      profile,
      events: eventsResult.events,
      sessions: [],
      exportedAt: new Date().toISOString(),
    };
  }

  /** Run retention cleanup */
  async runRetentionCleanup() {
    // Will use adapter's retention config
    return this.adapter.runRetentionCleanup({
      events: '365d',
      sessions: '365d',
      users: 'forever',
    });
  }

  /** Get the underlying adapter */
  getAdapter(): StorageAdapter {
    return this.adapter;
  }
}
