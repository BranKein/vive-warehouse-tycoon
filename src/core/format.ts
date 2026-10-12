import { BigNum, type BigNumLike } from './BigNum';

const NAMED_SUFFIXES = ['', 'K', 'M', 'B', 'T'];
const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

/**
 * Suffix for a power-of-1000 group in "AA notation":
 * 0 -> "", 1 -> K, 2 -> M, 3 -> B, 4 -> T, 5 -> aa, 6 -> ab, ... 680 -> zz, 681 -> aaa.
 */
export function suffixForGroup(group: number): string {
  if (group < NAMED_SUFFIXES.length) return NAMED_SUFFIXES[group] ?? '';
  let index = group - NAMED_SUFFIXES.length;
  let length = 2;
  let span = LETTERS.length ** length;
  while (index >= span) {
    index -= span;
    length += 1;
    span = LETTERS.length ** length;
  }
  let suffix = '';
  for (let i = 0; i < length; i += 1) {
    suffix = LETTERS.charAt(index % LETTERS.length) + suffix;
    index = Math.floor(index / LETTERS.length);
  }
  return suffix;
}

function threeSignificant(value: number): string {
  if (value >= 100) return value.toFixed(0);
  if (value >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

/** Formats a value with three significant digits and an AA-notation suffix. */
export function formatNumber(input: BigNumLike): string {
  const value = BigNum.from(input);
  if (value.isZero) return '0';
  if (value.sign < 0) return `-${formatNumber(value.neg())}`;
  if (value.e < 3) {
    const n = value.toNumber();
    if (n >= 999.5) return `1.00${suffixForGroup(1)}`;
    if (n >= 100 || Number.isInteger(n)) return String(Math.round(n));
    return n >= 10 ? n.toFixed(1) : n.toFixed(2);
  }
  let group = Math.floor(value.e / 3);
  let scaled = value.m * 10 ** (value.e - group * 3);
  // 999.6K must roll over to 1.00M rather than print as 1000K.
  if (scaled >= 999.5) {
    scaled /= 1000;
    group += 1;
  }
  return `${threeSignificant(scaled)}${suffixForGroup(group)}`;
}

/** Formats a duration given in seconds as a compact "1h 5m" / "45s" string. */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
