import { BigNum } from '@/core/BigNum';

/** Amounts at or below this are treated as nothing; keeps float dust from driving the logistics. */
export const EPSILON = BigNum.of(1, -9);
const RELATIVE_DUST = 1e-11;

export const isPositive = (value: BigNum): boolean => value.cmp(EPSILON) > 0;

/** a - b, never negative; a remainder that is only rounding noise becomes exactly zero. */
export function subClamp(a: BigNum, b: BigNum): BigNum {
  const result = a.sub(b);
  if (result.sign <= 0) return BigNum.ZERO;
  if (result.e < a.e - 10 && result.cmp(a.mul(RELATIVE_DUST)) < 0) return BigNum.ZERO;
  return result;
}

/** a / b as a plain number, for ratios shown on screen and for scoring. */
export function ratio(a: BigNum, b: BigNum): number {
  if (b.isZero) return a.isZero ? 0 : Infinity;
  return a.div(b).toNumber();
}

export const minOf = (a: BigNum, b: BigNum): BigNum => (a.cmp(b) <= 0 ? a : b);
