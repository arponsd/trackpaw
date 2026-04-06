import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { StorageAdapter, ValidatedEvent } from '../types';

function makeEvent(overrides: Partial<ValidatedEvent> = {}): ValidatedEvent {
  const id = `evt_${Math.random().toString(36).slice(2, 10)}`;
  return {
    id,
    eventName: 'Test Event',
    userId: null,
    anonymousId: 'anon_001',
    sessionId: 'sess_001',
    properties: {},
    timestamp: '2025-06-15T10:00:00.000Z',
    receivedAt: '2025-06-15T10:00:01.000Z',
    ipAddress: '127.0.0.1',
    userAgent: 'TestAgent/1.0',
    pageUrl: 'https://example.com/home',
    pageTitle: 'Home',
    referrer: null,
    deviceType: 'desktop',
    browser: 'Chrome',
    os: 'Windows',
    country: null,
    ...overrides,
  };
}

export function runAdapterConformanceTests(
  createAdapter: () => Promise<StorageAdapter>,
  cleanupAdapter: (adapter: StorageAdapter) => Promise<void>,
) {
  describe('StorageAdapter Conformance', () => {
    let adapter: StorageAdapter;

    beforeEach(async () => {
      adapter = await createAdapter();
    });

    afterEach(async () => {
      await cleanupAdapter(adapter);
    });

    // ─── Health Check ──────────────────────────────────

    it('healthCheck returns ok', async () => {
      const result = await adapter.healthCheck();
      expect(result.ok).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    // ─── Event Ingestion ───────────────────────────────

    it('insertEvents stores and returns correct count', async () => {
      const events = [makeEvent(), makeEvent({ eventName: 'Sign Up' })];
      const result = await adapter.insertEvents(events);
      expect(result.inserted).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('getEventCount returns correct count', async () => {
      await adapter.insertEvents([makeEvent(), makeEvent(), makeEvent()]);
      const count = await adapter.getEventCount();
      expect(count).toBe(3);
    });

    it('getEventNames returns distinct event names', async () => {
      await adapter.insertEvents([
        makeEvent({ eventName: 'Sign Up' }),
        makeEvent({ eventName: 'Purchase' }),
        makeEvent({ eventName: 'Sign Up' }),
      ]);
      const names = await adapter.getEventNames();
      expect(names).toContain('Sign Up');
      expect(names).toContain('Purchase');
    });

    it('getEventProperties returns property definitions', async () => {
      await adapter.insertEvents([
        makeEvent({ eventName: 'Purchase', properties: { amount: 49.99, plan: 'pro' } }),
        makeEvent({ eventName: 'Purchase', properties: { amount: 19.99, plan: 'free' } }),
      ]);

      const props = await adapter.getEventProperties('Purchase');
      const keys = props.map((p) => p.key);
      expect(keys).toContain('amount');
      expect(keys).toContain('plan');
    });

    // ─── User Management ───────────────────────────────

    it('upsertUser creates and updates user profiles', async () => {
      await adapter.upsertUser('user_1', { name: 'Alice' }, 'anon_001');

      const profile = await adapter.getUserProfile('user_1');
      expect(profile).not.toBeNull();
      expect(profile!.userId).toBe('user_1');
      expect(profile!.traits.name).toBe('Alice');
      expect(profile!.anonymousIds).toContain('anon_001');

      // Update traits
      await adapter.upsertUser('user_1', { plan: 'pro' }, 'anon_002');
      const updated = await adapter.getUserProfile('user_1');
      expect(updated!.traits.name).toBe('Alice');
      expect(updated!.traits.plan).toBe('pro');
      expect(updated!.anonymousIds).toContain('anon_001');
      expect(updated!.anonymousIds).toContain('anon_002');
    });

    it('getUsersByAnonymousId returns linked users', async () => {
      await adapter.upsertUser('user_1', { name: 'Alice' }, 'anon_100');
      const users = await adapter.getUsersByAnonymousId('anon_100');
      expect(users.length).toBe(1);
      expect(users[0]!.userId).toBe('user_1');
    });

    it('getUserProfile returns null for unknown user', async () => {
      const profile = await adapter.getUserProfile('nonexistent');
      expect(profile).toBeNull();
    });

    it('getUserCount returns correct count', async () => {
      await adapter.upsertUser('user_1', {});
      await adapter.upsertUser('user_2', {});
      const count = await adapter.getUserCount();
      expect(count).toBe(2);
    });

    // ─── GDPR Delete ───────────────────────────────────

    it('deleteUser removes all user data', async () => {
      // Create user and events
      await adapter.upsertUser('user_del', { name: 'ToDelete' }, 'anon_del');
      await adapter.insertEvents([
        makeEvent({ userId: 'user_del', anonymousId: 'anon_del', eventName: 'Page View' }),
        makeEvent({ userId: 'user_del', anonymousId: 'anon_del', eventName: 'Sign Up' }),
      ]);
      await adapter.upsertSession({
        sessionId: 'sess_del',
        userId: 'user_del',
        anonymousId: 'anon_del',
      });

      const result = await adapter.deleteUser('user_del');
      expect(result.events).toBeGreaterThanOrEqual(2);
      expect(result.userProfile).toBe(true);

      const profile = await adapter.getUserProfile('user_del');
      expect(profile).toBeNull();
    });

    // ─── Session Management ────────────────────────────

    it('upsertSession creates and updates sessions', async () => {
      await adapter.upsertSession({
        sessionId: 'sess_test',
        anonymousId: 'anon_001',
        startedAt: '2025-06-15T10:00:00Z',
        eventCount: 1,
        entryPage: '/home',
      });

      // Update session
      await adapter.upsertSession({
        sessionId: 'sess_test',
        anonymousId: 'anon_001',
        endedAt: '2025-06-15T10:05:00Z',
        eventCount: 3,
        exitPage: '/checkout',
      });
    });

    // ─── Trends Query ──────────────────────────────────

    it('queryTrends returns correct daily counts', async () => {
      await adapter.insertEvents([
        makeEvent({ eventName: 'Sign Up', timestamp: '2025-06-15T10:00:00Z' }),
        makeEvent({ eventName: 'Sign Up', timestamp: '2025-06-15T11:00:00Z' }),
        makeEvent({ eventName: 'Sign Up', timestamp: '2025-06-16T10:00:00Z' }),
      ]);

      const result = await adapter.queryTrends({
        type: 'trends',
        events: [{ name: 'Sign Up', aggregation: 'total' }],
        interval: 'day',
        dateRange: { start: '2025-06-15', end: '2025-06-17' },
      });

      expect(result.type).toBe('trends');
      expect(result.series.length).toBe(1);
      expect(result.series[0]!.event).toBe('Sign Up');
      expect(result.series[0]!.total).toBe(3);

      const dayData = result.series[0]!.data;
      const day15 = dayData.find((d) => d.date === '2025-06-15');
      const day16 = dayData.find((d) => d.date === '2025-06-16');
      expect(day15?.value).toBe(2);
      expect(day16?.value).toBe(1);
    });

    // ─── Funnel Query ──────────────────────────────────

    it('queryFunnel calculates conversion rates', async () => {
      // 3 users: user_a does all 3 steps, user_b does 2, user_c does 1
      await adapter.insertEvents([
        makeEvent({ eventName: 'Page View', anonymousId: 'a', timestamp: '2025-06-15T10:00:00Z' }),
        makeEvent({ eventName: 'Sign Up', anonymousId: 'a', timestamp: '2025-06-15T10:01:00Z' }),
        makeEvent({ eventName: 'Purchase', anonymousId: 'a', timestamp: '2025-06-15T10:02:00Z' }),
        makeEvent({ eventName: 'Page View', anonymousId: 'b', timestamp: '2025-06-15T10:00:00Z' }),
        makeEvent({ eventName: 'Sign Up', anonymousId: 'b', timestamp: '2025-06-15T10:01:00Z' }),
        makeEvent({ eventName: 'Page View', anonymousId: 'c', timestamp: '2025-06-15T10:00:00Z' }),
      ]);

      const result = await adapter.queryFunnel({
        type: 'funnel',
        steps: [{ event: 'Page View' }, { event: 'Sign Up' }, { event: 'Purchase' }],
        dateRange: { start: '2025-06-15', end: '2025-06-16' },
      });

      expect(result.type).toBe('funnel');
      expect(result.steps.length).toBe(3);
      expect(result.steps[0]!.count).toBe(3);
      expect(result.steps[1]!.count).toBe(2);
      expect(result.steps[2]!.count).toBe(1);
    });

    // ─── Retention Query ───────────────────────────────

    it('queryRetention builds correct cohort grid', async () => {
      // Cohort: users who signed up on day 1, returned (login) on day 2
      await adapter.insertEvents([
        makeEvent({ eventName: 'Sign Up', anonymousId: 'u1', timestamp: '2025-06-15T10:00:00Z' }),
        makeEvent({ eventName: 'Sign Up', anonymousId: 'u2', timestamp: '2025-06-15T11:00:00Z' }),
        makeEvent({ eventName: 'Login', anonymousId: 'u1', timestamp: '2025-06-16T10:00:00Z' }),
      ]);

      const result = await adapter.queryRetention({
        type: 'retention',
        startEvent: 'Sign Up',
        returnEvent: 'Login',
        dateRange: { start: '2025-06-15', end: '2025-06-17' },
        interval: 'day',
        periods: 2,
      });

      expect(result.type).toBe('retention');
      expect(result.cohorts.length).toBeGreaterThanOrEqual(1);

      const cohort = result.cohorts[0]!;
      expect(cohort.cohortSize).toBe(2);
    });

    // ─── Event Stream ──────────────────────────────────

    it('queryEventStream returns filtered events', async () => {
      await adapter.insertEvents([
        makeEvent({ eventName: 'Sign Up', anonymousId: 'u1', timestamp: '2025-06-15T10:00:00Z' }),
        makeEvent({ eventName: 'Purchase', anonymousId: 'u1', timestamp: '2025-06-15T11:00:00Z' }),
        makeEvent({ eventName: 'Sign Up', anonymousId: 'u2', timestamp: '2025-06-15T12:00:00Z' }),
      ]);

      const result = await adapter.queryEventStream({
        type: 'event_stream',
        filters: { eventNames: ['Sign Up'] },
        limit: 10,
      });

      expect(result.type).toBe('event_stream');
      expect(result.events.length).toBe(2);
      expect(result.events.every((e) => e.event === 'Sign Up')).toBe(true);
    });

    // ─── User List ─────────────────────────────────────

    it('queryUserList returns users sorted by last_seen', async () => {
      await adapter.upsertUser('user_a', { name: 'Alice' });
      await adapter.upsertUser('user_b', { name: 'Bob' });

      const result = await adapter.queryUserList({
        type: 'user_list',
        sortBy: 'last_seen',
        order: 'desc',
        limit: 10,
      });

      expect(result.type).toBe('user_list');
      expect(result.users.length).toBe(2);
    });

    // ─── Retention Cleanup ─────────────────────────────

    it('runRetentionCleanup deletes old data', async () => {
      // Insert old events
      const oldTimestamp = '2020-01-01T00:00:00Z';
      await adapter.insertEvents([
        makeEvent({ timestamp: oldTimestamp, eventName: 'Old Event' }),
      ]);
      await adapter.insertEvents([
        makeEvent({ timestamp: '2025-06-15T10:00:00Z', eventName: 'New Event' }),
      ]);

      const result = await adapter.runRetentionCleanup({
        events: '365d',
        sessions: '365d',
        users: 'forever',
      });

      expect(result.deletedEvents).toBeGreaterThanOrEqual(1);

      // New events should remain
      const count = await adapter.getEventCount();
      expect(count).toBe(1);
    });
  });
}
