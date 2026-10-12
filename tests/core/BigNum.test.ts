import { describe, expect, it } from 'vitest';
import { BigNum, bn } from '@/core/BigNum';

describe('BigNum', () => {
  it('normalizes mantissa and exponent', () => {
    const v = bn(12345);
    expect(v.m).toBeCloseTo(1.2345);
    expect(v.e).toBe(4);
    expect(bn(0)).toBe(BigNum.ZERO);
    expect(bn(0.05).e).toBe(-2);
  });

  it('adds and subtracts across magnitudes', () => {
    expect(bn(1500).add(2500).toNumber()).toBeCloseTo(4000);
    expect(bn(1000).sub(1).toNumber()).toBeCloseTo(999);
    expect(bn('1e30').add(1).eq('1e30')).toBe(true);
    expect(bn(5).sub(5).isZero).toBe(true);
    expect(bn(3).sub(10).toNumber()).toBeCloseTo(-7);
  });

  it('multiplies, divides and raises to powers beyond the double range', () => {
    const huge = bn('1e200').mul('1e200');
    expect(huge.e).toBe(400);
    expect(huge.div('1e399').toNumber()).toBeCloseTo(10);
    expect(bn(1.15).pow(10000).e).toBe(606);
    expect(bn(2).pow(10).toNumber()).toBeCloseTo(1024);
    expect(bn(7).pow(0)).toBe(BigNum.ONE);
  });

  it('compares values including negatives and zero', () => {
    expect(bn(5).gt(3)).toBe(true);
    expect(bn('1e400').gt('9.9e399')).toBe(true);
    expect(bn(-5).lt(-3)).toBe(true);
    expect(bn(-1).lt(0)).toBe(true);
    expect(bn(0).lt('1e-5')).toBe(true);
    expect(bn(2).min(7).toNumber()).toBe(2);
    expect(bn(2).max(7).toNumber()).toBe(7);
  });

  it('floors small values and leaves huge values alone', () => {
    expect(bn(12.9).floor().toNumber()).toBe(12);
    expect(bn('1.5e40').floor().eq('1.5e40')).toBe(true);
  });

  it('round-trips through its string form', () => {
    for (const text of ['0', '1e0', '1.5e12', '9.99e-3', '2.5e1000']) {
      expect(BigNum.parse(BigNum.parse(text).toString()).eq(BigNum.parse(text))).toBe(true);
    }
    expect(JSON.stringify({ v: bn(1500) })).toBe('{"v":"1.5e3"}');
    expect(() => BigNum.parse('abc')).toThrow();
  });
});
