import { describe, it, expect } from 'vitest';
import { SafeStorage, SafeSessionStorage } from '../utils/storage';
import { IdentityManager } from '../identity/identity';

function createIdentity(sessionTimeout = 1800000) {
  const storage = new SafeStorage('test_id_');
  const sessionStorage = new SafeSessionStorage('test_id_');
  return new IdentityManager(storage, sessionStorage, sessionTimeout);
}

describe('IdentityManager', () => {
  it('generates an anonymous ID on creation', () => {
    const id = createIdentity();
    const anonId = id.getAnonymousId();
    expect(anonId).toBeTruthy();
    expect(anonId.length).toBeGreaterThan(0);
  });

  it('returns null userId before identify', () => {
    const id = createIdentity();
    expect(id.getUserId()).toBeNull();
  });

  it('stores userId after identify', () => {
    const id = createIdentity();
    id.identify('user_123', { name: 'Alice' });
    expect(id.getUserId()).toBe('user_123');
    expect(id.getTraits()).toEqual({ name: 'Alice' });
  });

  it('merges traits on subsequent identify calls', () => {
    const id = createIdentity();
    id.identify('user_123', { name: 'Alice' });
    id.identify('user_123', { plan: 'pro' });
    expect(id.getTraits()).toEqual({ name: 'Alice', plan: 'pro' });
  });

  it('generates a session ID', () => {
    const id = createIdentity();
    const sessionId = id.getSessionId();
    expect(sessionId).toBeTruthy();
    expect(sessionId.length).toBeGreaterThan(0);
  });

  it('reset clears all identity data', () => {
    const id = createIdentity();
    id.identify('user_123', { name: 'Alice' });
    const oldAnon = id.getAnonymousId();

    id.reset();

    expect(id.getUserId()).toBeNull();
    expect(id.getTraits()).toEqual({});
    expect(id.getAnonymousId()).not.toBe(oldAnon);
  });
});
