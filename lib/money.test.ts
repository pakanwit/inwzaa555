import { describe, it, expect } from 'vitest';
import { centsToBaht, formatBaht, parseBahtInput } from './money';

describe('centsToBaht', () => {
  it('converts integer cents to baht', () => {
    expect(centsToBaht(123400)).toBe(1234);
  });
  it('handles zero', () => {
    expect(centsToBaht(0)).toBe(0);
  });
});

describe('formatBaht', () => {
  it('formats whole baht with thousands separators and the ฿ symbol', () => {
    expect(formatBaht(150000)).toBe('฿1,500');
  });
  it('formats negative values with a leading minus inside the symbol', () => {
    expect(formatBaht(-200000)).toBe('-฿2,000');
  });
  it('formats zero as ฿0', () => {
    expect(formatBaht(0)).toBe('฿0');
  });
});

describe('parseBahtInput', () => {
  it('parses a whole baht string into cents', () => {
    expect(parseBahtInput('1234')).toBe(123400);
  });
  it('strips commas and spaces', () => {
    expect(parseBahtInput('  1,234 ')).toBe(123400);
  });
  it('returns null for non-numeric input', () => {
    expect(parseBahtInput('abc')).toBeNull();
  });
  it('returns null for empty input', () => {
    expect(parseBahtInput('')).toBeNull();
  });
});
