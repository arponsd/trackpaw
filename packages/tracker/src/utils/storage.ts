class StorageWrapper {
  private mem: Map<string, string> = new Map();
  private useMem: boolean;

  constructor(
    private prefix: string,
    private store: Storage | null,
  ) {
    this.useMem = !this.test();
  }

  private test(): boolean {
    if (!this.store) return false;
    try {
      this.store.setItem('__t', '1');
      this.store.removeItem('__t');
      return true;
    } catch {
      return false;
    }
  }

  private k(name: string): string {
    return this.prefix + name;
  }

  get(name: string): string | null {
    const k = this.k(name);
    if (this.useMem) return this.mem.get(k) ?? null;
    try {
      return this.store!.getItem(k);
    } catch {
      return this.mem.get(k) ?? null;
    }
  }

  set(name: string, value: string): void {
    const k = this.k(name);
    if (this.useMem) {
      this.mem.set(k, value);
      return;
    }
    try {
      this.store!.setItem(k, value);
    } catch {
      this.mem.set(k, value);
    }
  }

  remove(name: string): void {
    const k = this.k(name);
    this.mem.delete(k);
    if (!this.useMem) {
      try {
        this.store!.removeItem(k);
      } catch {
        /* ignore */
      }
    }
  }

  clear(): void {
    this.mem.clear();
    if (!this.useMem) {
      try {
        const toRemove: string[] = [];
        for (let i = 0; i < this.store!.length; i++) {
          const key = this.store!.key(i);
          if (key?.startsWith(this.prefix)) toRemove.push(key);
        }
        toRemove.forEach((k) => this.store!.removeItem(k));
      } catch {
        /* ignore */
      }
    }
  }
}

function getGlobal(name: 'localStorage' | 'sessionStorage'): Storage | null {
  try {
    return typeof globalThis !== 'undefined' ? (globalThis as any)[name] ?? null : null;
  } catch {
    return null;
  }
}

export class SafeStorage extends StorageWrapper {
  constructor(prefix: string = 'tp_') {
    super(prefix, getGlobal('localStorage'));
  }
}

export class SafeSessionStorage extends StorageWrapper {
  constructor(prefix: string = 'tp_') {
    super(prefix, getGlobal('sessionStorage'));
  }
}
