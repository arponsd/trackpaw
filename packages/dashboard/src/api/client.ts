import type {
  TrendsQuery, TrendsResult, FunnelQuery, FunnelResult,
  RetentionQuery, RetentionResult, EventStreamResult,
  UserListResult, UserProfile, MetadataResponse, PropertyDefinition,
} from '@trackpaw/types';

export class AnalyticsAPIClient {
  constructor(
    private endpoint: string,
    private apiKey: string,
  ) {
    this.endpoint = endpoint.replace(/\/+$/, '');
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${this.endpoint}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        ...options?.headers,
      },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || `API error: ${res.status}`);
    }

    return res.json();
  }

  async queryTrends(query: Omit<TrendsQuery, 'type'>): Promise<TrendsResult> {
    return this.request('/v1/query', {
      method: 'POST',
      body: JSON.stringify({ type: 'trends', ...query }),
    });
  }

  async queryFunnel(query: Omit<FunnelQuery, 'type'>): Promise<FunnelResult> {
    return this.request('/v1/query', {
      method: 'POST',
      body: JSON.stringify({ type: 'funnel', ...query }),
    });
  }

  async queryRetention(query: Omit<RetentionQuery, 'type'>): Promise<RetentionResult> {
    return this.request('/v1/query', {
      method: 'POST',
      body: JSON.stringify({ type: 'retention', ...query }),
    });
  }

  async getEventStream(params?: {
    event?: string; userId?: string; sessionId?: string;
    limit?: number; offset?: number; from?: string; to?: string; order?: string;
  }): Promise<EventStreamResult> {
    const qs = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) qs.set(k, String(v));
      }
    }
    const query = qs.toString();
    return this.request(`/v1/events/stream${query ? `?${query}` : ''}`);
  }

  async getUserList(params?: {
    search?: string; sort?: string; order?: string; limit?: number; offset?: number;
  }): Promise<UserListResult> {
    const qs = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) qs.set(k, String(v));
      }
    }
    const query = qs.toString();
    return this.request(`/v1/users${query ? `?${query}` : ''}`);
  }

  async getUserProfile(userId: string): Promise<UserProfile & { recentEvents?: any[] }> {
    return this.request(`/v1/users/${encodeURIComponent(userId)}`);
  }

  async getMetadata(): Promise<MetadataResponse> {
    return this.request('/v1/metadata');
  }

  async getEventProperties(eventName: string): Promise<{ eventName: string; properties: PropertyDefinition[] }> {
    return this.request(`/v1/metadata/events/${encodeURIComponent(eventName)}/properties`);
  }

  async healthCheck(): Promise<{ status: string; adapter: string; database: { connected: boolean } }> {
    return this.request('/v1/health');
  }
}
