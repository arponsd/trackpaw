import { describe, it, expect } from 'vitest';
import { SafeStorage } from '../utils/storage';

describe('SafeStorage', () => {
  it('falls back to memory when localStorage is unavailable', () => {
    const storage = new SafeStorage('test_');

    storage.set('key1', 'value1');
    expect(storage.get('key1')).toBe('value1');

    storage.remove('key1');
    expect(storage.get('key1')).toBeNull();
  });

  it('returns null for missing keys', () => {
    const storage = new SafeStorage('test_');
    expect(storage.get('nonexistent')).toBeNull();
  });

  it('clears all prefixed keys', () => {
    const storage = new SafeStorage('test_');
    storage.set('a', '1');
    storage.set('b', '2');
    storage.clear();
    expect(storage.get('a')).toBeNull();
    expect(storage.get('b')).toBeNull();
  });
});
