import type { AnalyticsQuery, QueryResult } from '@trackpaw/types';
import { createHash } from 'crypto';

export interface QueryCacheConfig {
  enabled: boolean;
  maxSize?: number;
  ttlSeconds?: number;
  excludeTypes?: string[];
}

interface CacheEntry {
  result: QueryResult;
  expiresAt: number;
}

export class QueryCache {
  private cache = new Map<string, CacheEntry>();
  private config: Required<QueryCacheConfig>;

  constructor(config: QueryCacheConfig) {
    this.config = {
      enabled: config.enabled,
      maxSize: config.maxSize ?? 100,
      ttlSeconds: config.ttlSeconds ?? 60,
      excludeTypes: config.excludeTypes ?? ['event_stream'],
    };
  }

  get(query: AnalyticsQuery): QueryResult | null {
    if (!this.config.enabled) return null;
    if (this.config.excludeTypes.includes(query.type)) return null;

    const key = this.buildKey(query);
    const entry = this.cache.get(key);

    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.result;
  }

  set(query: AnalyticsQuery, result: QueryResult): void {
    if (!this.config.enabled) return;
    if (this.config.excludeTypes.includes(query.type)) return;

    // Evict oldest if at capacity
    if (this.cache.size >= this.config.maxSize) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }

    this.cache.set(this.buildKey(query), {
      result,
      expiresAt: Date.now() + this.config.ttlSeconds * 1000,
    });
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  private buildKey(query: AnalyticsQuery): string {
    const json = JSON.stringify(query);
    return createHash('md5').update(json).digest('hex');
  }
}
