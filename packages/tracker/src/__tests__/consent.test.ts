import { describe, it, expect } from 'vitest';
import { SafeStorage } from '../utils/storage';
import { ConsentManager } from '../consent/consent';

function createConsent(defaultOptOut = false, respectDNT = false) {
  const storage = new SafeStorage('test_consent_');
  return new ConsentManager(storage, defaultOptOut, respectDNT);
}

describe('ConsentManager', () => {
  it('defaults to opted in', () => {
    const consent = createConsent(false);
    expect(consent.hasOptedOut()).toBe(false);
  });

  it('respects defaultOptOut=true', () => {
    const consent = createConsent(true);
    expect(consent.hasOptedOut()).toBe(true);
  });

  it('optOut() sets opted out', () => {
    const consent = createConsent(false);
    consent.optOut();
    expect(consent.hasOptedOut()).toBe(true);
  });

  it('optIn() reverses optOut', () => {
    const consent = createConsent(false);
    consent.optOut();
    consent.optIn();
    expect(consent.hasOptedOut()).toBe(false);
  });
});
