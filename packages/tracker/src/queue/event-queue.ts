import type { ResolvedConfig } from '../core/config';
import { now } from '../utils/time';
import { QueuePersistence } from './persistence';

const RETRY_DELAYS = [1000, 2000, 4000, 8000, 16000];

export class EventQueue {
  private queue: any[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private persistence: QueuePersistence | null;
  private flushing = false;
  private url: string;

  constructor(private config: ResolvedConfig) {
    this.url = `${config.endpoint}/v1/events/batch`;

    this.persistence =
      config.persistence === 'localStorage' ? new QueuePersistence(config.persistencePrefix) : null;

    if (this.persistence) {
      const restored = this.persistence.load();
      if (restored.length > 0) this.queue.push(...restored);
    }

    if (config.flushInterval > 0) {
      this.flushTimer = setInterval(() => this.flush(), config.flushInterval);
    }
    this.bindUnload();
  }

  private bindUnload(): void {
    if (typeof document === 'undefined') return;
    const onHide = () => this.flushBeacon();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') onHide();
    });
    if (typeof window !== 'undefined') window.addEventListener('pagehide', onHide);
  }

  add(event: any): void {
    if (this.queue.length >= this.config.maxQueueSize) this.queue.shift();
    this.queue.push(event);
    this.persist();
    this.config.onEventTracked?.(event);
    if (this.queue.length >= this.config.flushQueueSize) this.flush();
  }

  async flush(): Promise<void> {
    if (this.flushing || this.queue.length === 0) return;
    this.flushing = true;

    const events = [...this.queue];
    const body = JSON.stringify({ batch: events, sentAt: now() });
    let success = false;

    for (let i = 0; i <= RETRY_DELAYS.length; i++) {
      try {
        const res = await fetch(this.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-API-Key': this.config.apiKey },
          body,
          keepalive: true,
        });
        if (res.ok) {
          success = true;
          break;
        }
        if (res.status >= 400 && res.status < 500) break; // don't retry 4xx
      } catch {
        // network error — retry
      }
      const delay = RETRY_DELAYS[i];
      if (delay !== undefined) await new Promise((r) => setTimeout(r, delay));
    }

    if (success) {
      this.queue.splice(0, events.length);
      this.persist();
    }
    this.config.onFlush?.(events, success);
    this.flushing = false;
  }

  private flushBeacon(): void {
    if (this.queue.length === 0) return;
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify({ batch: this.queue, sentAt: now() })], {
        type: 'application/json',
      });
      navigator.sendBeacon(this.url, blob);
    }
    this.queue.length = 0;
    this.persist();
  }

  private persist(): void {
    this.persistence?.save(this.queue);
  }

  size(): number {
    return this.queue.length;
  }

  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }
}
