import { describe, it, expect } from 'vitest';
import { EventValidator } from '../core/event-validator';

describe('EventValidator', () => {
  const validator = new EventValidator();

  it('accepts a valid event', () => {
    const result = validator.validate({
      event: 'Sign Up',
      properties: { plan: 'free' },
      timestamp: '2025-06-15T10:00:00Z',
      anonymousId: 'anon_1',
      sessionId: 'sess_1',
    });
    expect(result.valid).toBe(true);
  });

  it('rejects events with empty name', () => {
    const result = validator.validate({
      event: '',
      properties: {},
      timestamp: '2025-06-15T10:00:00Z',
      anonymousId: 'anon_1',
      sessionId: 'sess_1',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('required');
  });

  it('rejects events with too many properties', () => {
    const props: Record<string, string> = {};
    for (let i = 0; i < 51; i++) props[`key${i}`] = 'value';

    const result = validator.validate({
      event: 'Test',
      properties: props,
      timestamp: '2025-06-15T10:00:00Z',
      anonymousId: 'anon_1',
      sessionId: 'sess_1',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Properties count');
  });

  it('rejects events with name too long', () => {
    const result = validator.validate({
      event: 'x'.repeat(257),
      properties: {},
      timestamp: '2025-06-15T10:00:00Z',
      anonymousId: 'anon_1',
      sessionId: 'sess_1',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('exceeds');
  });

  it('rejects events missing anonymousId', () => {
    const result = validator.validate({
      event: 'Test',
      properties: {},
      timestamp: '2025-06-15T10:00:00Z',
      anonymousId: '',
      sessionId: 'sess_1',
    });
    expect(result.valid).toBe(false);
  });

  it('respects blockedEventNames', () => {
    const v = new EventValidator({ blockedEventNames: ['Debug'] });
    const result = v.validate({
      event: 'Debug',
      properties: {},
      timestamp: '2025-06-15T10:00:00Z',
      anonymousId: 'anon_1',
      sessionId: 'sess_1',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('blocked');
  });
});
