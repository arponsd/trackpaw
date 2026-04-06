import { SafeStorage, SafeSessionStorage } from '../utils/storage';
import { STORAGE_KEYS } from '../core/constants';
import { AnonymousIdManager } from './anonymous-id';
import { SessionManager } from './session';

export class IdentityManager {
  private anonymousIdManager: AnonymousIdManager;
  private sessionManager: SessionManager;
  private userId: string | null;
  private traits: Record<string, any>;

  constructor(
    private storage: SafeStorage,
    sessionStorage: SafeSessionStorage,
    sessionTimeout: number,
  ) {
    this.anonymousIdManager = new AnonymousIdManager(storage);
    this.sessionManager = new SessionManager(sessionStorage, sessionTimeout);
    this.userId = this.storage.get(STORAGE_KEYS.USER_ID);

    const storedTraits = this.storage.get(STORAGE_KEYS.USER_TRAITS);
    this.traits = storedTraits ? JSON.parse(storedTraits) : {};
  }

  getAnonymousId(): string {
    return this.anonymousIdManager.get();
  }

  getUserId(): string | null {
    return this.userId;
  }

  getSessionId(): string {
    return this.sessionManager.get();
  }

  getTraits(): Record<string, any> {
    return { ...this.traits };
  }

  identify(userId: string, traits?: Record<string, any>): void {
    this.userId = userId;
    this.storage.set(STORAGE_KEYS.USER_ID, userId);

    if (traits) {
      this.traits = { ...this.traits, ...traits };
      this.storage.set(STORAGE_KEYS.USER_TRAITS, JSON.stringify(this.traits));
    }
  }

  setTraits(traits: Record<string, any>): void {
    this.traits = { ...this.traits, ...traits };
    this.storage.set(STORAGE_KEYS.USER_TRAITS, JSON.stringify(this.traits));
  }

  /** Record activity to keep the session alive */
  touch(): void {
    this.sessionManager.touch();
  }

  reset(): void {
    this.userId = null;
    this.traits = {};
    this.anonymousIdManager.reset();
    this.sessionManager.reset();
    this.storage.remove(STORAGE_KEYS.USER_ID);
    this.storage.remove(STORAGE_KEYS.USER_TRAITS);
  }
}
