import { uuid } from '../utils/uuid';
import { nowMs } from '../utils/time';
import { SafeSessionStorage } from '../utils/storage';
import { STORAGE_KEYS } from '../core/constants';

export class SessionManager {
  private id: string;
  private lastActivity: number;
  private timeout: number;

  constructor(
    private storage: SafeSessionStorage,
    timeout: number,
  ) {
    this.timeout = timeout;
    this.lastActivity = this.loadLastActivity();

    const stored = this.storage.get(STORAGE_KEYS.SESSION_ID);
    if (stored && !this.isExpired()) {
      this.id = stored;
    } else {
      this.id = this.newSession();
    }
  }

  private loadLastActivity(): number {
    const stored = this.storage.get(STORAGE_KEYS.SESSION_LAST_ACTIVITY);
    return stored ? parseInt(stored, 10) : nowMs();
  }

  private isExpired(): boolean {
    return nowMs() - this.lastActivity > this.timeout;
  }

  private newSession(): string {
    const id = uuid();
    this.storage.set(STORAGE_KEYS.SESSION_ID, id);
    this.touch();
    return id;
  }

  /** Record activity and rotate session if expired */
  touch(): void {
    if (this.isExpired()) {
      this.id = this.newSession();
      return;
    }
    this.lastActivity = nowMs();
    this.storage.set(STORAGE_KEYS.SESSION_LAST_ACTIVITY, String(this.lastActivity));
  }

  get(): string {
    this.touch();
    return this.id;
  }

  reset(): void {
    this.id = this.newSession();
  }
}
