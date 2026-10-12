/**
 * Immutable arbitrary-magnitude number stored as mantissa * 10^exponent.
 * The mantissa is normalized to 1 <= |m| < 10 (or 0), which keeps roughly
 * 15 significant digits. That is enough for an idle game where only the
 * leading digits are ever shown.
 */
export type BigNumLike = BigNum | number | string;

const MAX_ALIGN_DIGITS = 17;

export class BigNum {
  static readonly ZERO = new BigNum(0, 0);
  static readonly ONE = new BigNum(1, 0);

  private constructor(
    readonly m: number,
    readonly e: number,
  ) {}

  static of(mantissa: number, exponent: number): BigNum {
    if (!Number.isFinite(mantissa) || Number.isNaN(exponent)) {
      throw new RangeError(`Invalid BigNum parts: ${mantissa}e${exponent}`);
    }
    if (mantissa === 0) return BigNum.ZERO;
    let shift = Math.floor(Math.log10(Math.abs(mantissa)));
    let m = mantissa / 10 ** shift;
    // Guard against floating point drift at the boundaries.
    if (Math.abs(m) >= 10) {
      m /= 10;
      shift += 1;
    } else if (Math.abs(m) < 1) {
      m *= 10;
      shift -= 1;
    }
    return new BigNum(m, exponent + shift);
  }

  static from(value: BigNumLike): BigNum {
    if (value instanceof BigNum) return value;
    if (typeof value === 'number') return BigNum.of(value, 0);
    return BigNum.parse(value);
  }

  /** Parses the output of `toString()` ("1.5e12") as well as plain decimals. */
  static parse(text: string): BigNum {
    const match = /^\s*(-?\d+(?:\.\d+)?)(?:[eE]([+-]?\d+))?\s*$/.exec(text);
    if (!match) throw new SyntaxError(`Cannot parse BigNum: "${text}"`);
    return BigNum.of(Number(match[1]), match[2] ? Number(match[2]) : 0);
  }

  get isZero(): boolean {
    return this.m === 0;
  }

  get sign(): -1 | 0 | 1 {
    return this.m === 0 ? 0 : this.m > 0 ? 1 : -1;
  }

  neg(): BigNum {
    return this.m === 0 ? this : new BigNum(-this.m, this.e);
  }

  add(other: BigNumLike): BigNum {
    const b = BigNum.from(other);
    if (this.m === 0) return b;
    if (b.m === 0) return this;
    const diff = this.e - b.e;
    if (diff > MAX_ALIGN_DIGITS) return this;
    if (diff < -MAX_ALIGN_DIGITS) return b;
    return diff >= 0
      ? BigNum.of(this.m + b.m / 10 ** diff, this.e)
      : BigNum.of(this.m / 10 ** -diff + b.m, b.e);
  }

  sub(other: BigNumLike): BigNum {
    return this.add(BigNum.from(other).neg());
  }

  mul(other: BigNumLike): BigNum {
    const b = BigNum.from(other);
    if (this.m === 0 || b.m === 0) return BigNum.ZERO;
    return BigNum.of(this.m * b.m, this.e + b.e);
  }

  div(other: BigNumLike): BigNum {
    const b = BigNum.from(other);
    if (b.m === 0) throw new RangeError('BigNum division by zero');
    if (this.m === 0) return BigNum.ZERO;
    return BigNum.of(this.m / b.m, this.e - b.e);
  }

  /** Raises a non-negative value to a real power. */
  pow(power: number): BigNum {
    if (power === 0) return BigNum.ONE;
    if (this.m === 0) return BigNum.ZERO;
    if (this.m < 0) throw new RangeError('BigNum.pow requires a non-negative base');
    const log = (Math.log10(this.m) + this.e) * power;
    const exponent = Math.floor(log);
    return BigNum.of(10 ** (log - exponent), exponent);
  }

  cmp(other: BigNumLike): -1 | 0 | 1 {
    const b = BigNum.from(other);
    if (this.sign !== b.sign) return this.sign > b.sign ? 1 : -1;
    if (this.m === 0) return 0;
    const positive = this.m > 0;
    if (this.e !== b.e) return this.e > b.e === positive ? 1 : -1;
    if (this.m === b.m) return 0;
    return this.m > b.m ? 1 : -1;
  }

  eq(other: BigNumLike): boolean {
    return this.cmp(other) === 0;
  }
  lt(other: BigNumLike): boolean {
    return this.cmp(other) < 0;
  }
  lte(other: BigNumLike): boolean {
    return this.cmp(other) <= 0;
  }
  gt(other: BigNumLike): boolean {
    return this.cmp(other) > 0;
  }
  gte(other: BigNumLike): boolean {
    return this.cmp(other) >= 0;
  }

  min(other: BigNumLike): BigNum {
    const b = BigNum.from(other);
    return this.lte(b) ? this : b;
  }

  max(other: BigNumLike): BigNum {
    const b = BigNum.from(other);
    return this.gte(b) ? this : b;
  }

  /** Rounds toward negative infinity. Values too large to hold a fraction are returned as is. */
  floor(): BigNum {
    if (this.e >= 15) return this;
    return BigNum.of(Math.floor(this.toNumber()), 0);
  }

  /** Converts to a JS number. Returns Infinity beyond the double range. */
  toNumber(): number {
    if (this.e > 308) return this.m > 0 ? Infinity : -Infinity;
    if (this.e < -320) return 0;
    return this.m * 10 ** this.e;
  }

  /** Base-10 logarithm as a JS number; -Infinity for zero. */
  log10(): number {
    if (this.m <= 0) return this.m === 0 ? -Infinity : NaN;
    return Math.log10(this.m) + this.e;
  }

  toString(): string {
    return this.m === 0 ? '0' : `${this.m}e${this.e}`;
  }

  toJSON(): string {
    return this.toString();
  }
}

export const bn = (value: BigNumLike): BigNum => BigNum.from(value);
