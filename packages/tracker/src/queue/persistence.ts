import { SafeStorage } from '../utils/storage';
import { STORAGE_KEYS } from '../core/constants';

export class QueuePersistence {
  private storage: SafeStorage;

  constructor(prefix: string) {
    this.storage = new SafeStorage(prefix);
  }

  save(queue: any[]): void {
    try {
      this.storage.set(STORAGE_KEYS.QUEUE, JSON.stringify(queue));
    } catch {
      // quota exceeded or other error — silently ignore
    }
  }

  load(): any[] {
    try {
      const raw = this.storage.get(STORAGE_KEYS.QUEUE);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  clear(): void {
    this.storage.remove(STORAGE_KEYS.QUEUE);
  }
}
