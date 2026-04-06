import { uuid } from '../utils/uuid';
import { SafeStorage } from '../utils/storage';
import { STORAGE_KEYS } from '../core/constants';

export class AnonymousIdManager {
  private id: string;

  constructor(private storage: SafeStorage) {
    this.id = this.storage.get(STORAGE_KEYS.ANONYMOUS_ID) || this.generate();
  }

  private generate(): string {
    const id = uuid();
    this.storage.set(STORAGE_KEYS.ANONYMOUS_ID, id);
    return id;
  }

  get(): string {
    return this.id;
  }

  reset(): void {
    this.id = this.generate();
  }
}
