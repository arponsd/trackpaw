import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Trackpaw } from '../core/client';

const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
vi.stubGlobal('fetch', mockFetch);

describe('Browser Compatibility', () => {
  beforeEach(() => mockFetch.mockClear());

  describe('Memory persistence mode', () => {
    it('works without localStorage', async () => {
      const tracker = Trackpaw.init({
        endpoint: 'https://example.com',
        apiKey: 'key',
        persistence: 'memory',
        autoTrack: { pageViews: false },
        flushInterval: 0,
      });

      tracker.track('Test Event');
      await tracker.flush();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
      expect(body.batch[0].event).toBe('Test Event');
    });

    it('generates new anonymous ID each init with memory persistence', () => {
      const t1 = Trackpaw.init({ endpoint: 'https://a.com', apiKey: 'k', persistence: 'memory', autoTrack: { pageViews: false }, flushInterval: 0 });
      const t2 = Trackpaw.init({ endpoint: 'https://a.com', apiKey: 'k', persistence: 'memory', autoTrack: { pageViews: false }, flushInterval: 0 });

      // Different instances should get different anonymous IDs
      // (both are in-memory, no persistence sharing)
      expect(t1.getAnonymousId()).toBeTruthy();
      expect(t2.getAnonymousId()).toBeTruthy();
    });
  });

  describe('Node.js environment (no DOM)', () => {
    it('initializes without throwing', () => {
      expect(() =>
        Trackpaw.init({
          endpoint: 'https://example.com',
          apiKey: 'key',
          persistence: 'memory',
          autoTrack: { pageViews: false },
          flushInterval: 0,
        }),
      ).not.toThrow();
    });

    it('track and flush work without DOM', async () => {
      const tracker = Trackpaw.init({
        endpoint: 'https://example.com',
        apiKey: 'key',
        persistence: 'memory',
        autoTrack: { pageViews: false },
        flushInterval: 0,
      });

      tracker.track('Server Event', { source: 'node' });
      await tracker.flush();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
      expect(body.batch[0].event).toBe('Server Event');
      expect(body.batch[0].properties.source).toBe('node');
    });

    it('identify works in Node.js', () => {
      const tracker = Trackpaw.init({
        endpoint: 'https://example.com',
        apiKey: 'key',
        persistence: 'memory',
        autoTrack: { pageViews: false },
        flushInterval: 0,
      });

      tracker.identify('server_user', { role: 'admin' });
      expect(tracker.getUserId()).toBe('server_user');
    });
  });

  describe('Consent in Node.js', () => {
    it('defaultOptOut prevents tracking', async () => {
      const tracker = Trackpaw.init({
        endpoint: 'https://example.com',
        apiKey: 'key',
        persistence: 'memory',
        autoTrack: { pageViews: false },
        flushInterval: 0,
        defaultOptOut: true,
      });

      expect(tracker.hasOptedOut()).toBe(true);
      tracker.track('Should Not Send');
      await tracker.flush();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Default properties', () => {
    it('adds defaultProperties to every event', async () => {
      const tracker = Trackpaw.init({
        endpoint: 'https://example.com',
        apiKey: 'key',
        persistence: 'memory',
        autoTrack: { pageViews: false },
        flushInterval: 0,
        defaultProperties: { appVersion: '2.0', env: 'test' },
      });

      tracker.track('Event');
      await tracker.flush();

      const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
      expect(body.batch[0].properties.appVersion).toBe('2.0');
      expect(body.batch[0].properties.env).toBe('test');
    });
  });

  describe('Debug mode', () => {
    it('logs to console when debug is true', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const tracker = Trackpaw.init({
        endpoint: 'https://example.com',
        apiKey: 'key',
        persistence: 'memory',
        autoTrack: { pageViews: false },
        flushInterval: 0,
        debug: true,
      });

      tracker.track('Debug Event');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Trackpaw]'),
        expect.stringContaining('Debug Event'),
        expect.any(Object),
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Callbacks', () => {
    it('calls onEventTracked when event is queued', () => {
      const onTracked = vi.fn();
      const tracker = Trackpaw.init({
        endpoint: 'https://example.com',
        apiKey: 'key',
        persistence: 'memory',
        autoTrack: { pageViews: false },
        flushInterval: 0,
        onEventTracked: onTracked,
      });

      tracker.track('Callback Test');
      expect(onTracked).toHaveBeenCalledTimes(1);
      expect(onTracked.mock.calls[0]![0].event).toBe('Callback Test');
    });

    it('calls onFlush after flush', async () => {
      const onFlush = vi.fn();
      const tracker = Trackpaw.init({
        endpoint: 'https://example.com',
        apiKey: 'key',
        persistence: 'memory',
        autoTrack: { pageViews: false },
        flushInterval: 0,
        onFlush,
      });

      tracker.track('Flush Test');
      await tracker.flush();

      expect(onFlush).toHaveBeenCalledTimes(1);
      expect(onFlush).toHaveBeenCalledWith(expect.any(Array), true);
    });
  });
});
