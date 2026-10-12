import { describe, expect, it } from 'vitest';
import { formatDuration, formatNumber, suffixForGroup } from '@/core/format';

describe('formatNumber (AA notation)', () => {
  it('prints small values plainly', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(7)).toBe('7');
    expect(formatNumber(850)).toBe('850');
    expect(formatNumber(12.34)).toBe('12.3');
    expect(formatNumber(1.5)).toBe('1.50');
  });

  it('uses K, M, B, T and then aa, ab, ...', () => {
    expect(formatNumber(1000)).toBe('1.00K');
    expect(formatNumber(12345)).toBe('12.3K');
    expect(formatNumber(123456)).toBe('123K');
    expect(formatNumber('1.5e6')).toBe('1.50M');
    expect(formatNumber('2e9')).toBe('2.00B');
    expect(formatNumber('3e12')).toBe('3.00T');
    expect(formatNumber('1e15')).toBe('1.00aa');
    expect(formatNumber('1.23e19')).toBe('12.3ab');
    expect(formatNumber('1e93')).toBe('1.00ba');
  });

  it('rolls over instead of printing four digits', () => {
    expect(formatNumber(999.7)).toBe('1.00K');
    expect(formatNumber(999960)).toBe('1.00M');
  });

  it('continues past zz with three letters', () => {
    expect(suffixForGroup(5)).toBe('aa');
    expect(suffixForGroup(5 + 675)).toBe('zz');
    expect(suffixForGroup(5 + 676)).toBe('aaa');
  });

  it('formats negative values', () => {
    expect(formatNumber(-2500)).toBe('-2.50K');
  });
});

describe('formatDuration', () => {
  it('prints compact durations', () => {
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(125)).toBe('2m 5s');
    expect(formatDuration(3900)).toBe('1h 5m');
  });
});
