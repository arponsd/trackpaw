import { describe, it, expect } from 'vitest';
import { now, nowMs } from '../utils/time';

describe('time utils', () => {
  it('now() returns ISO 8601 string', () => {
    const timestamp = now();
    expect(new Date(timestamp).toISOString()).toBe(timestamp);
  });

  it('nowMs() returns a number', () => {
    const ms = nowMs();
    expect(typeof ms).toBe('number');
    expect(ms).toBeGreaterThan(0);
  });
});
