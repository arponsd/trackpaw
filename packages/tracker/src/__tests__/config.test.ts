import { describe, it, expect } from 'vitest';
import { resolveConfig } from '../core/config';

describe('resolveConfig', () => {
  it('fills defaults for missing optional fields', () => {
    const config = resolveConfig({
      endpoint: 'https://example.com/analytics/',
      apiKey: 'test-key',
    });

    expect(config.endpoint).toBe('https://example.com/analytics');
    expect(config.apiKey).toBe('test-key');
    expect(config.flushInterval).toBe(5000);
    expect(config.flushQueueSize).toBe(10);
    expect(config.maxQueueSize).toBe(1000);
    expect(config.persistence).toBe('localStorage');
    expect(config.persistencePrefix).toBe('tp_');
    expect(config.sessionTimeout).toBe(1800000);
    expect(config.autoTrack.pageViews).toBe(true);
    expect(config.autoTrack.clicks).toBe(false);
    expect(config.autoTrack.forms).toBe(false);
    expect(config.autoTrack.outboundLinks).toBe(false);
    expect(config.ipAnonymization).toBe(true);
    expect(config.respectDoNotTrack).toBe(false);
    expect(config.debug).toBe(false);
  });

  it('strips trailing slash from endpoint', () => {
    const config = resolveConfig({
      endpoint: 'https://example.com/analytics///',
      apiKey: 'key',
    });
    expect(config.endpoint).toBe('https://example.com/analytics');
  });

  it('respects provided overrides', () => {
    const config = resolveConfig({
      endpoint: 'https://example.com',
      apiKey: 'key',
      flushInterval: 10000,
      persistence: 'memory',
      autoTrack: { pageViews: false, clicks: true },
      debug: true,
    });

    expect(config.flushInterval).toBe(10000);
    expect(config.persistence).toBe('memory');
    expect(config.autoTrack.pageViews).toBe(false);
    expect(config.autoTrack.clicks).toBe(true);
    expect(config.debug).toBe(true);
  });
});
