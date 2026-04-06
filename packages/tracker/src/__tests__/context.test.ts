import { describe, it, expect } from 'vitest';
import { detectBrowser, getScreenDimensions, getLocale, getTimezone } from '../context/browser';
import { getPageInfo } from '../context/page';
import { extractUTM } from '../context/utm';

describe('detectBrowser (Node.js, no navigator)', () => {
  it('returns empty strings when navigator is undefined', () => {
    const info = detectBrowser();
    // In Node.js test environment, navigator is not defined
    expect(info.deviceType).toBe('desktop');
    expect(typeof info.browser).toBe('string');
    expect(typeof info.os).toBe('string');
  });
});

describe('getScreenDimensions', () => {
  it('returns { width: 0, height: 0 } when screen is undefined', () => {
    const dims = getScreenDimensions();
    expect(dims).toEqual({ width: 0, height: 0 });
  });
});

describe('getLocale', () => {
  it('returns a string', () => {
    const locale = getLocale();
    expect(typeof locale).toBe('string');
    expect(locale.length).toBeGreaterThan(0);
  });
});

describe('getTimezone', () => {
  it('returns a timezone string', () => {
    const tz = getTimezone();
    expect(typeof tz).toBe('string');
    expect(tz.length).toBeGreaterThan(0);
  });
});

describe('getPageInfo (Node.js, no document)', () => {
  it('returns empty strings when document is undefined', () => {
    const info = getPageInfo();
    expect(info).toEqual({ url: '', path: '', title: '', referrer: '' });
  });
});

describe('extractUTM (Node.js, no location)', () => {
  it('returns empty object when location is undefined', () => {
    const utm = extractUTM();
    expect(utm).toEqual({});
  });
});
