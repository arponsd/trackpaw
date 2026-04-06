import { describe, it, expect } from 'vitest';
import { QueryValidator } from '../query-engine/query-validator';
import { QueryCache } from '../query-engine/query-cache';

describe('QueryValidator', () => {
  const validator = new QueryValidator();

  it('accepts valid trends query', () => {
    const result = validator.validate({
      type: 'trends',
      events: [{ name: 'Sign Up' }],
      interval: 'day',
      dateRange: { preset: '30d' },
    });
    expect(result.valid).toBe(true);
  });

  it('rejects trends without events', () => {
    const result = validator.validate({
      type: 'trends',
      events: [],
      interval: 'day',
      dateRange: { preset: '7d' },
    });
    expect(result.valid).toBe(false);
  });

  it('rejects funnel with < 2 steps', () => {
    const result = validator.validate({
      type: 'funnel',
      steps: [{ event: 'One' }],
      dateRange: { preset: '7d' },
    });
    expect(result.valid).toBe(false);
  });

  it('rejects funnel with > 10 steps', () => {
    const steps = Array.from({ length: 11 }, (_, i) => ({ event: `Step ${i}` }));
    const result = validator.validate({
      type: 'funnel',
      steps,
      dateRange: { preset: '7d' },
    });
    expect(result.valid).toBe(false);
  });

  it('rejects retention with periods > 52', () => {
    const result = validator.validate({
      type: 'retention',
      startEvent: 'A',
      returnEvent: 'B',
      interval: 'week',
      periods: 53,
      dateRange: { preset: '90d' },
    });
    expect(result.valid).toBe(false);
  });

  it('rejects date range exceeding 365 days', () => {
    const result = validator.validate({
      type: 'trends',
      events: [{ name: 'Test' }],
      interval: 'day',
      dateRange: { start: '2023-01-01', end: '2025-01-01' },
    });
    expect(result.valid).toBe(false);
  });

  it('rejects invalid date range preset', () => {
    const result = validator.validate({
      type: 'trends',
      events: [{ name: 'Test' }],
      interval: 'day',
      dateRange: { preset: '999d' as any },
    });
    expect(result.valid).toBe(false);
  });

  it('accepts valid segment query', () => {
    const result = validator.validate({
      type: 'segment',
      conditions: [{ event: 'Sign Up', operator: 'did' }],
      combinator: 'and',
      output: 'count',
    });
    expect(result.valid).toBe(true);
  });
});

describe('QueryCache', () => {
  it('caches and retrieves results', () => {
    const cache = new QueryCache({ enabled: true, ttlSeconds: 60 });
    const query = { type: 'trends' as const, events: [{ name: 'Test' }], interval: 'day' as const, dateRange: { preset: '7d' as const } };
    const result = { type: 'trends' as const, series: [], dateRange: { start: '', end: '' }, queryTimeMs: 10 };

    cache.set(query, result);
    expect(cache.get(query)).toEqual(result);
  });

  it('returns null for cache miss', () => {
    const cache = new QueryCache({ enabled: true });
    const query = { type: 'trends' as const, events: [{ name: 'Missing' }], interval: 'day' as const, dateRange: { preset: '7d' as const } };
    expect(cache.get(query)).toBeNull();
  });

  it('excludes event_stream by default', () => {
    const cache = new QueryCache({ enabled: true });
    const query = { type: 'event_stream' as const };
    cache.set(query, { type: 'event_stream', events: [], total: 0, limit: 50, offset: 0 });
    expect(cache.get(query)).toBeNull();
  });

  it('returns null when disabled', () => {
    const cache = new QueryCache({ enabled: false });
    const query = { type: 'trends' as const, events: [{ name: 'Test' }], interval: 'day' as const, dateRange: { preset: '7d' as const } };
    cache.set(query, { type: 'trends', series: [], dateRange: { start: '', end: '' }, queryTimeMs: 0 });
    expect(cache.get(query)).toBeNull();
  });

  it('evicts when at capacity', () => {
    const cache = new QueryCache({ enabled: true, maxSize: 2 });
    const q1 = { type: 'trends' as const, events: [{ name: 'A' }], interval: 'day' as const, dateRange: { preset: '7d' as const } };
    const q2 = { type: 'trends' as const, events: [{ name: 'B' }], interval: 'day' as const, dateRange: { preset: '7d' as const } };
    const q3 = { type: 'trends' as const, events: [{ name: 'C' }], interval: 'day' as const, dateRange: { preset: '7d' as const } };
    const r = { type: 'trends' as const, series: [], dateRange: { start: '', end: '' }, queryTimeMs: 0 };

    cache.set(q1, r);
    cache.set(q2, r);
    cache.set(q3, r); // should evict q1

    expect(cache.get(q1)).toBeNull();
    expect(cache.get(q3)).not.toBeNull();
  });
});
