import { SafeStorage } from '../utils/storage';
import { STORAGE_KEYS } from '../core/constants';

export class ConsentManager {
  private optedOut: boolean;

  constructor(
    private storage: SafeStorage,
    defaultOptOut: boolean,
    respectDoNotTrack: boolean,
  ) {
    const stored = this.storage.get(STORAGE_KEYS.OPT_OUT);

    if (stored !== null) {
      this.optedOut = stored === 'true';
    } else if (respectDoNotTrack && this.isDNTEnabled()) {
      this.optedOut = true;
    } else {
      this.optedOut = defaultOptOut;
    }
  }

  private isDNTEnabled(): boolean {
    if (typeof navigator === 'undefined') return false;
    return navigator.doNotTrack === '1' || (navigator as any).globalPrivacyControl === true;
  }

  optOut(): void {
    this.optedOut = true;
    this.storage.set(STORAGE_KEYS.OPT_OUT, 'true');
  }

  optIn(): void {
    this.optedOut = false;
    this.storage.set(STORAGE_KEYS.OPT_OUT, 'false');
  }

  hasOptedOut(): boolean {
    return this.optedOut;
  }
}
