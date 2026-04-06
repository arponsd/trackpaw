import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AnalyticsCore } from '../core/analytics-core';
import { SQLiteAdapter } from '../adapters/sqlite';

describe('Performance Benchmarks', () => {
  let adapter: SQLiteAdapter;
  let core: AnalyticsCore;

  beforeAll(async () => {
    adapter = new SQLiteAdapter({ filename: ':memory:' });
    await adapter.initialize();
    core = new AnalyticsCore({ adapter });
  });

  afterAll(async () => {
    await adapter.disconnect();
  });

  it('ingests 1000 events in under 2 seconds (SQLite)', async () => {
    const batch = Array.from({ length: 1000 }, (_, i) => ({
      event: i % 3 === 0 ? 'Sign Up' : i % 3 === 1 ? 'Purchase' : 'Page View',
      properties: { index: i, plan: i % 2 === 0 ? 'free' : 'pro' },
      timestamp: new Date(Date.now() - (1000 - i) * 60000).toISOString(),
      anonymousId: `anon_${i % 50}`,
      sessionId: `sess_${i % 100}`,
      userId: i % 5 === 0 ? `user_${i % 10}` : undefined,
    }));

    const start = Date.now();
    const result = await core.ingestEvents(batch, {
      ip: '127.0.0.1',
      userAgent: 'BenchmarkAgent/1.0',
    });
    const elapsed = Date.now() - start;

    console.log(`Ingested ${result.inserted} events in ${elapsed}ms (${Math.round(result.inserted / (elapsed / 1000))} events/sec)`);

    expect(result.inserted).toBe(1000);
    expect(elapsed).toBeLessThan(2000);
  });

  it('queries trends in under 500ms with 1000 events', async () => {
    const start = Date.now();
    const result = await core.executeQuery({
      type: 'trends',
      events: [{ name: 'Sign Up', aggregation: 'total' }],
      interval: 'day',
      dateRange: { preset: '30d' },
    });
    const elapsed = Date.now() - start;

    console.log(`Trends query: ${elapsed}ms`);

    expect(result.type).toBe('trends');
    expect(elapsed).toBeLessThan(500);
  });

  it('queries funnel in under 500ms with 1000 events', async () => {
    const start = Date.now();
    const result = await core.executeQuery({
      type: 'funnel',
      steps: [{ event: 'Page View' }, { event: 'Sign Up' }, { event: 'Purchase' }],
      dateRange: { preset: '30d' },
    });
    const elapsed = Date.now() - start;

    console.log(`Funnel query: ${elapsed}ms`);

    expect(result.type).toBe('funnel');
    expect(elapsed).toBeLessThan(500);
  });

  it('queries retention in under 500ms with 1000 events', async () => {
    const start = Date.now();
    const result = await core.executeQuery({
      type: 'retention',
      startEvent: 'Sign Up',
      returnEvent: 'Purchase',
      dateRange: { preset: '30d' },
      interval: 'day',
      periods: 7,
    });
    const elapsed = Date.now() - start;

    console.log(`Retention query: ${elapsed}ms`);

    expect(result.type).toBe('retention');
    expect(elapsed).toBeLessThan(500);
  });

  it('queries event stream in under 200ms', async () => {
    const start = Date.now();
    const result = await core.executeQuery({
      type: 'event_stream',
      limit: 50,
      orderBy: 'timestamp_desc',
    });
    const elapsed = Date.now() - start;

    console.log(`Event stream query: ${elapsed}ms`);

    expect(result.type).toBe('event_stream');
    expect(elapsed).toBeLessThan(200);
  });

  it('queries user segment in under 500ms', async () => {
    const start = Date.now();
    const result = await core.executeQuery({
      type: 'segment',
      conditions: [
        { event: 'Sign Up', operator: 'did' },
        { event: 'Purchase', operator: 'did' },
      ],
      combinator: 'and',
      output: 'count',
    });
    const elapsed = Date.now() - start;

    console.log(`Segment query: ${elapsed}ms`);

    expect(result.type).toBe('segment');
    expect(elapsed).toBeLessThan(500);
  });
});
