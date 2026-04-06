import type { ValidatedEvent } from '@trackpaw/types';
import type { StorageAdapter } from '../adapters/types';

export class SessionResolver {
  constructor(private adapter: StorageAdapter) {}

  async resolve(events: ValidatedEvent[]): Promise<void> {
    // Group events by session
    const sessions = new Map<
      string,
      { userId: string | null; anonymousId: string; timestamps: string[]; pages: string[] }
    >();

    for (const event of events) {
      if (!sessions.has(event.sessionId)) {
        sessions.set(event.sessionId, {
          userId: event.userId,
          anonymousId: event.anonymousId,
          timestamps: [],
          pages: [],
        });
      }
      const session = sessions.get(event.sessionId)!;
      session.timestamps.push(event.timestamp);
      if (event.pageUrl) session.pages.push(event.pageUrl);
      if (event.userId) session.userId = event.userId;
    }

    for (const [sessionId, data] of sessions) {
      data.timestamps.sort();
      await this.adapter.upsertSession({
        sessionId,
        userId: data.userId,
        anonymousId: data.anonymousId,
        startedAt: data.timestamps[0],
        endedAt: data.timestamps[data.timestamps.length - 1],
        eventCount: data.timestamps.length,
        entryPage: data.pages[0],
        exitPage: data.pages[data.pages.length - 1],
      });
    }
  }
}
