import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AnalyticsCore } from '../core/analytics-core';
import { SQLiteAdapter } from '../adapters/sqlite';

describe('AnalyticsCore', () => {
  let adapter: SQLiteAdapter;
  let core: AnalyticsCore;

  beforeEach(async () => {
    adapter = new SQLiteAdapter({ filename: ':memory:' });
    await adapter.initialize();
    core = new AnalyticsCore({ adapter });
  });

  afterEach(async () => {
    await adapter.disconnect();
  });

  it('ingests events through the full pipeline', async () => {
    const result = await core.ingestEvents(
      [
        {
          event: 'Sign Up',
          properties: { plan: 'free' },
          timestamp: '2025-06-15T10:00:00Z',
          anonymousId: 'anon_1',
          sessionId: 'sess_1',
        },
        {
          event: 'Purchase',
          properties: { amount: 49.99 },
          timestamp: '2025-06-15T10:05:00Z',
          anonymousId: 'anon_1',
          sessionId: 'sess_1',
        },
      ],
      { ip: '192.168.1.100', userAgent: 'Mozilla/5.0 Chrome/120' },
    );

    expect(result.success).toBe(true);
    expect(result.inserted).toBe(2);
    expect(result.failed).toBe(0);
  });

  it('validates and rejects invalid events', async () => {
    const result = await core.ingestEvents(
      [
        {
          event: '',
          properties: {},
          timestamp: '2025-06-15T10:00:00Z',
          anonymousId: 'anon_1',
          sessionId: 'sess_1',
        },
      ],
      { ip: '127.0.0.1', userAgent: 'Test/1.0' },
    );

    expect(result.inserted).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]!.code).toBe('VALIDATION_ERROR');
  });

  it('anonymizes IP addresses by default', async () => {
    await core.ingestEvents(
      [
        {
          event: 'Test',
          properties: {},
          timestamp: '2025-06-15T10:00:00Z',
          anonymousId: 'anon_1',
          sessionId: 'sess_1',
        },
      ],
      { ip: '192.168.1.100', userAgent: 'Test/1.0' },
    );

    const events = await adapter.queryEventStream({
      type: 'event_stream',
      limit: 1,
    });

    // IP should be anonymized
    expect(events.events.length).toBe(1);
  });

  it('identifies a user and links anonymous ID', async () => {
    const result = await core.identifyUser('user_42', { name: 'Alice', plan: 'pro' }, 'anon_42');

    expect(result.isNewUser).toBe(true);

    const profile = await adapter.getUserProfile('user_42');
    expect(profile).not.toBeNull();
    expect(profile!.traits.name).toBe('Alice');
    expect(profile!.anonymousIds).toContain('anon_42');
  });

  it('executes trends queries', async () => {
    await core.ingestEvents(
      [
        { event: 'Sign Up', properties: {}, timestamp: '2025-06-15T10:00:00Z', anonymousId: 'a1', sessionId: 's1' },
        { event: 'Sign Up', properties: {}, timestamp: '2025-06-15T11:00:00Z', anonymousId: 'a2', sessionId: 's2' },
      ],
      { ip: '127.0.0.1', userAgent: 'Test/1.0' },
    );

    const result = await core.executeQuery({
      type: 'trends',
      events: [{ name: 'Sign Up', aggregation: 'total' }],
      interval: 'day',
      dateRange: { start: '2025-06-15', end: '2025-06-16' },
    });

    expect(result.type).toBe('trends');
    if (result.type === 'trends') {
      expect(result.series[0]!.total).toBe(2);
    }
  });

  it('returns metadata', async () => {
    await core.ingestEvents(
      [
        { event: 'Page View', properties: { page: '/home' }, timestamp: '2025-06-15T10:00:00Z', anonymousId: 'a1', sessionId: 's1' },
        { event: 'Sign Up', properties: { plan: 'free' }, timestamp: '2025-06-15T10:01:00Z', anonymousId: 'a1', sessionId: 's1' },
      ],
      { ip: '127.0.0.1', userAgent: 'Test/1.0' },
    );

    const meta = await core.getMetadata();
    expect(meta.eventNames).toContain('Page View');
    expect(meta.eventNames).toContain('Sign Up');
    expect(meta.eventCount).toBe(2);
  });

  it('deletes user data (GDPR)', async () => {
    await core.identifyUser('user_gdpr', { name: 'To Delete' }, 'anon_gdpr');
    await core.ingestEvents(
      [
        { event: 'Test', properties: {}, timestamp: '2025-06-15T10:00:00Z', userId: 'user_gdpr', anonymousId: 'anon_gdpr', sessionId: 's1' },
      ],
      { ip: '127.0.0.1', userAgent: 'Test/1.0' },
    );

    const result = await core.deleteUser('user_gdpr');
    expect(result.userProfile).toBe(true);

    const profile = await adapter.getUserProfile('user_gdpr');
    expect(profile).toBeNull();
  });

  it('exports user data (GDPR)', async () => {
    await core.identifyUser('user_export', { name: 'Exportable' }, 'anon_export');
    await core.ingestEvents(
      [
        { event: 'Action', properties: {}, timestamp: '2025-06-15T10:00:00Z', userId: 'user_export', anonymousId: 'anon_export', sessionId: 's1' },
      ],
      { ip: '127.0.0.1', userAgent: 'Test/1.0' },
    );

    const data = await core.exportUserData('user_export');
    expect(data.profile).not.toBeNull();
    expect(data.profile!.userId).toBe('user_export');
    expect(data.exportedAt).toBeTruthy();
  });

  it('scrubs PII fields when configured', async () => {
    const piiCore = new AnalyticsCore({
      adapter,
      privacy: {
        piiFields: ['email'],
        piiAction: 'hash',
      },
    });

    await piiCore.ingestEvents(
      [
        {
          event: 'Sign Up',
          properties: { email: 'alice@example.com', plan: 'pro' },
          timestamp: '2025-06-15T10:00:00Z',
          anonymousId: 'a1',
          sessionId: 's1',
        },
      ],
      { ip: '127.0.0.1', userAgent: 'Test/1.0' },
    );

    const events = await adapter.queryEventStream({ type: 'event_stream', limit: 10 });
    const props = events.events[0]!.properties;
    expect(props.email).toMatch(/^sha256:/);
    expect(props.plan).toBe('pro');
  });
});
