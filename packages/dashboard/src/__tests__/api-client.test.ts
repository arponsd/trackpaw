import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalyticsAPIClient } from '../api/client';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('AnalyticsAPIClient', () => {
  let client: AnalyticsAPIClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new AnalyticsAPIClient('https://api.example.com/analytics', 'test-key');
  });

  it('sends trends query with correct headers', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ type: 'trends', series: [], dateRange: {}, queryTimeMs: 10 }),
    });

    await client.queryTrends({
      events: [{ name: 'Sign Up' }],
      interval: 'day',
      dateRange: { preset: '7d' },
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0]!;
    expect(url).toBe('https://api.example.com/analytics/v1/query');
    expect(opts.headers['X-API-Key']).toBe('test-key');
    expect(opts.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(opts.body);
    expect(body.type).toBe('trends');
    expect(body.events[0].name).toBe('Sign Up');
  });

  it('fetches metadata', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ eventNames: ['A'], eventCount: 100, userCount: 10 }),
    });

    const result = await client.getMetadata();
    expect(result.eventNames).toEqual(['A']);
    expect(mockFetch.mock.calls[0]![0]).toBe('https://api.example.com/analytics/v1/metadata');
  });

  it('throws on API error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ message: 'Invalid API key' }),
    });

    await expect(client.getMetadata()).rejects.toThrow('Invalid API key');
  });

  it('builds event stream URL with params', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ events: [], total: 0, limit: 50, offset: 0 }),
    });

    await client.getEventStream({ event: 'Sign Up', limit: 10 });

    const url = mockFetch.mock.calls[0]![0] as string;
    expect(url).toContain('event=Sign+Up');
    expect(url).toContain('limit=10');
  });

  it('strips trailing slash from endpoint', async () => {
    const c = new AnalyticsAPIClient('https://api.example.com/', 'key');
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    await c.healthCheck();

    const url = mockFetch.mock.calls[0]![0] as string;
    expect(url).toBe('https://api.example.com/v1/health');
  });
});
