import { describe, it, expect } from 'vitest';
import { sanitizeNumericValue } from '../src/core/utils.js';

describe('sanitizeNumericValue', () => {
  it('parses plain numbers correctly', () => {
    expect(sanitizeNumericValue('250000')).toBe(250000);
    expect(sanitizeNumericValue('6.5')).toBe(6.5);
    expect(sanitizeNumericValue('0')).toBe(0);
  });

  it('strips commas from formatted numbers', () => {
    expect(sanitizeNumericValue('250,000')).toBe(250000);
    expect(sanitizeNumericValue('1,234,567')).toBe(1234567);
    expect(sanitizeNumericValue('1,234,567.89')).toBe(1234567.89);
  });

  it('handles leading/trailing whitespace', () => {
    expect(sanitizeNumericValue(' 250000 ')).toBe(250000);
    expect(sanitizeNumericValue(' 250,000 ')).toBe(250000);
  });

  it('returns 0 for empty or invalid strings', () => {
    expect(sanitizeNumericValue('')).toBe(0);
    expect(sanitizeNumericValue('abc')).toBe(0);
    expect(sanitizeNumericValue('   ')).toBe(0);
  });

  it('fixes the parseFloat comma truncation bug', () => {
    // parseFloat("250,000") returns 250 - the exact bug we are fixing
    expect(parseFloat('250,000')).toBe(250);
    expect(sanitizeNumericValue('250,000')).toBe(250000);
  });

  it('handles negative values', () => {
    expect(sanitizeNumericValue('-1,000')).toBe(-1000);
  });
});
