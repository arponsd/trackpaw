import { describe, it, expect } from 'vitest';
import { anonymizeIP } from '../privacy/ip-anonymizer';
import { PIIScrubber } from '../privacy/pii-scrubber';

describe('IP Anonymizer', () => {
  it('zeroes last octet of IPv4', () => {
    expect(anonymizeIP('192.168.1.234')).toBe('192.168.1.0');
    expect(anonymizeIP('10.0.0.1')).toBe('10.0.0.0');
  });

  it('handles empty/null IP', () => {
    expect(anonymizeIP('')).toBe('');
  });

  it('anonymizes IPv6', () => {
    const result = anonymizeIP('2001:0db8:85a3:0000:0000:8a2e:0370:7334');
    expect(result).not.toContain('7334');
  });
});

describe('PII Scrubber', () => {
  it('hashes configured fields', () => {
    const scrubber = new PIIScrubber(['email', 'phone'], 'hash');
    const result = scrubber.scrub({ email: 'alice@example.com', phone: '555-1234', plan: 'pro' });

    expect(result.email).toMatch(/^sha256:/);
    expect(result.phone).toMatch(/^sha256:/);
    expect(result.plan).toBe('pro');
  });

  it('removes configured fields', () => {
    const scrubber = new PIIScrubber(['email'], 'remove');
    const result = scrubber.scrub({ email: 'alice@example.com', plan: 'pro' });

    expect(result.email).toBeUndefined();
    expect(result.plan).toBe('pro');
  });

  it('returns properties unchanged when no PII fields configured', () => {
    const scrubber = new PIIScrubber([], 'hash');
    const input = { foo: 'bar', baz: 123 };
    expect(scrubber.scrub(input)).toEqual(input);
  });
});
