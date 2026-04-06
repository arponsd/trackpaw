import { describe, it, expect } from 'vitest';
import { formatNumber, formatPercent, formatDuration, formatDate } from '../utils/formatters';

describe('formatNumber', () => {
  it('formats small numbers as-is', () => {
    expect(formatNumber(42)).toBe('42');
    expect(formatNumber(999)).toBe('999');
  });

  it('formats thousands with K', () => {
    expect(formatNumber(1234)).toBe('1.2K');
    expect(formatNumber(56789)).toBe('56.8K');
  });

  it('formats millions with M', () => {
    expect(formatNumber(1_500_000)).toBe('1.5M');
  });
});

describe('formatPercent', () => {
  it('formats percentage', () => {
    expect(formatPercent(45.67)).toBe('45.7%');
    expect(formatPercent(100)).toBe('100.0%');
  });
});

describe('formatDuration', () => {
  it('formats seconds', () => {
    expect(formatDuration(30)).toBe('30s');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(125)).toBe('2m 5s');
  });

  it('formats hours and minutes', () => {
    expect(formatDuration(3661)).toBe('1h 1m');
  });
});

describe('formatDate', () => {
  it('formats short date', () => {
    const result = formatDate('2025-06-15T10:00:00Z', 'short');
    expect(result).toBeTruthy();
  });
});
