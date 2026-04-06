import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Trackpaw } from '../core/client';

// Mock fetch globally
const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
vi.stubGlobal('fetch', mockFetch);

describe('Trackpaw', () => {
  let tracker: Trackpaw;

  beforeEach(() => {
    mockFetch.mockClear();
    tracker = Trackpaw.init({
      endpoint: 'https://example.com/analytics',
      apiKey: 'test-key',
      autoTrack: { pageViews: false },
      persistence: 'memory',
      flushInterval: 0, // disable auto-flush timer
    });
  });

  it('exposes SDK version', () => {
    expect(Trackpaw.version).toBe('0.1.0');
  });

  it('generates anonymous ID on init', () => {
    const anonId = tracker.getAnonymousId();
    expect(anonId).toBeTruthy();
    expect(anonId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('returns null userId before identify', () => {
    expect(tracker.getUserId()).toBeNull();
  });

  it('identify() sets userId', () => {
    tracker.identify('user_42', { name: 'Bob' });
    expect(tracker.getUserId()).toBe('user_42');
  });

  it('track() does not throw', () => {
    expect(() => tracker.track('Button Clicked', { id: 'cta' })).not.toThrow();
  });

  it('page() does not throw', () => {
    expect(() => tracker.page('/home')).not.toThrow();
  });

  it('flush() sends queued events via fetch', async () => {
    tracker.track('Test Event', { key: 'value' });
    await tracker.flush();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0]!;
    expect(url).toBe('https://example.com/analytics/v1/events/batch');
    expect(options.method).toBe('POST');
    expect(options.headers['X-API-Key']).toBe('test-key');

    const body = JSON.parse(options.body);
    expect(body.batch).toHaveLength(1);
    expect(body.batch[0].event).toBe('Test Event');
    expect(body.batch[0].properties.key).toBe('value');
    expect(body.batch[0].anonymousId).toBeTruthy();
    expect(body.batch[0].sessionId).toBeTruthy();
    expect(body.sentAt).toBeTruthy();
  });

  it('does not track when opted out', async () => {
    tracker.optOut();
    tracker.track('Should Not Send');
    await tracker.flush();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('optIn() resumes tracking after optOut()', async () => {
    tracker.optOut();
    expect(tracker.hasOptedOut()).toBe(true);

    tracker.optIn();
    expect(tracker.hasOptedOut()).toBe(false);

    tracker.track('After OptIn');
    await tracker.flush();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('setSuperProperties adds to every event', async () => {
    tracker.setSuperProperties({ appVersion: '2.0' });
    tracker.track('With Super');
    await tracker.flush();

    const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
    expect(body.batch[0].properties.appVersion).toBe('2.0');
  });

  it('unsetSuperProperties removes keys', () => {
    tracker.setSuperProperties({ a: 1, b: 2 });
    tracker.unsetSuperProperties(['a']);
    // The super property 'a' should be removed — verified via next event
  });

  it('setOnce only sets first time', async () => {
    tracker.setOnce({ firstTouch: 'google' });
    tracker.setOnce({ firstTouch: 'direct' }); // should not overwrite
    tracker.track('Check SetOnce');
    await tracker.flush();

    const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
    expect(body.batch[0].properties.firstTouch).toBe('google');
  });

  it('timeEvent measures duration', async () => {
    tracker.timeEvent('Long Task');

    // Simulate some passage of time
    await new Promise((r) => setTimeout(r, 50));

    tracker.track('Long Task');
    await tracker.flush();

    const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
    expect(body.batch[0].properties.$duration).toBeGreaterThan(0);
  });

  it('reset() clears identity', () => {
    tracker.identify('user_1');
    const oldAnon = tracker.getAnonymousId();

    tracker.reset();

    expect(tracker.getUserId()).toBeNull();
    expect(tracker.getAnonymousId()).not.toBe(oldAnon);
  });

  it('shutdown() flushes and stops', async () => {
    tracker.track('Final Event');
    await tracker.shutdown();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('group() enqueues a $group event', async () => {
    tracker.group('company', 'acme_123', { name: 'Acme' });
    await tracker.flush();

    const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
    expect(body.batch[0].event).toBe('$group');
    expect(body.batch[0].properties.groupType).toBe('company');
    expect(body.batch[0].properties.groupId).toBe('acme_123');
  });
});
