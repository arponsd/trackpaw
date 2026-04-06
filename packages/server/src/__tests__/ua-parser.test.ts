import { describe, it, expect } from 'vitest';
import { parseUserAgent } from '../utils/ua-parser';

describe('parseUserAgent', () => {
  it('detects Chrome on Windows desktop', () => {
    const ua = parseUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    expect(ua.browser).toBe('Chrome');
    expect(ua.os).toBe('Windows');
    expect(ua.deviceType).toBe('desktop');
  });

  it('detects Safari on macOS', () => {
    const ua = parseUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15');
    expect(ua.browser).toBe('Safari');
    expect(ua.os).toBe('macOS');
    expect(ua.deviceType).toBe('desktop');
  });

  it('detects Firefox on Linux', () => {
    const ua = parseUserAgent('Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0');
    expect(ua.browser).toBe('Firefox');
    expect(ua.os).toBe('Linux');
    expect(ua.deviceType).toBe('desktop');
  });

  it('detects mobile Chrome on Android', () => {
    const ua = parseUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36');
    expect(ua.os).toBe('Android');
    expect(ua.deviceType).toBe('mobile');
  });

  it('detects iPad as tablet', () => {
    const ua = parseUserAgent('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15');
    expect(ua.os).toBe('iOS');
    expect(ua.deviceType).toBe('tablet');
  });

  it('detects iPhone as mobile', () => {
    const ua = parseUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15');
    expect(ua.os).toBe('iOS');
    expect(ua.deviceType).toBe('mobile');
  });

  it('detects Edge', () => {
    const ua = parseUserAgent('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0');
    expect(ua.browser).toBe('Edge');
  });

  it('detects Opera', () => {
    const ua = parseUserAgent('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0');
    expect(ua.browser).toBe('Opera');
  });

  it('handles empty user agent', () => {
    const ua = parseUserAgent('');
    expect(ua.browser).toBeNull();
    expect(ua.os).toBeNull();
    expect(ua.deviceType).toBeNull();
  });
});
