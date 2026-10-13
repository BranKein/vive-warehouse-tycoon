import type { ItemDef, ItemId, VehicleKind, VehicleOwner, VehicleState, VehicleView } from '@/contracts';
import { BigNum } from '@/core/BigNum';
import { TICKS_PER_SECOND } from '@/core/time';
import type { Balance } from '@/content/balance';
import { parseAmount } from './Inventory';
import { isPositive, ratio, subClamp } from './math';
import { poseAt, type Path, type Pose } from './RoadGraph';

/** What a vehicle carries. Mixed loads are allowed; capacity counts units, not weight. */
export class Cargo {
  readonly items = new Map<ItemId, BigNum>();

  add(item: ItemId, amount: BigNum): void {
    if (amount.isZero) return;
    this.items.set(item, (this.items.get(item) ?? BigNum.ZERO).add(amount));
  }

  amount(item: ItemId): BigNum {
    return this.items.get(item) ?? BigNum.ZERO;
  }

  take(item: ItemId, amount: BigNum): BigNum {
    const have = this.items.get(item);
    if (!have) return BigNum.ZERO;
    const taken = amount.cmp(have) >= 0 ? have : amount;
    const left = subClamp(have, taken);
    if (left.isZero) this.items.delete(item);
    else this.items.set(item, left);
    return taken;
  }

  clear(): void {
    this.items.clear();
  }

  get isEmpty(): boolean {
    return this.items.size === 0;
  }

  total(): BigNum {
    let total = BigNum.ZERO;
    for (const amount of this.items.values()) total = total.add(amount);
    return total;
  }

  /** Amount-weighted mean item weight; 0 when empty. Totals grow without limit, so only the mean is used. */
  averageWeight(items: Readonly<Record<ItemId, ItemDef>>): number {
    if (this.items.size === 0) return 0;
    let total = BigNum.ZERO;
    let weighted = BigNum.ZERO;
    for (const [item, amount] of this.items) {
      total = total.add(amount);
      weighted = weighted.add(amount.mul(items[item]?.weight ?? 1));
    }
    return isPositive(total) ? ratio(weighted, total) : 0;
  }

  view(): Array<{ item: ItemId; amount: BigNum }> {
    return [...this.items].map(([item, amount]) => ({ item, amount }));
  }

  toJSON(): Record<ItemId, string> {
    const out: Record<ItemId, string> = {};
    for (const [item, amount] of this.items) out[item] = amount.toString();
    return out;
  }

  restore(saved: unknown, known: (item: ItemId) => boolean): void {
    this.items.clear();
    if (!saved || typeof saved !== 'object') return;
    for (const [item, value] of Object.entries(saved as Record<string, unknown>)) {
      const amount = parseAmount(value);
      if (known(item) && !amount.isZero) this.items.set(item, amount);
    }
  }
}

/** Fraction of base speed left for a vehicle carrying cargo of the given mean weight. */
export function weightFactor(averageWeight: number, sensitivity: number, balance: Balance): number {
  if (averageWeight <= 1) return 1;
  const factor = 1 - sensitivity * balance.weight.slowPerWeight * (averageWeight - 1);
  return Math.max(balance.weight.minFactor, factor);
}

export function travelTicks(length: number, speed: number): number {
  return Math.max(1, Math.ceil((length / speed) * TICKS_PER_SECOND));
}

/** Anything that moves along a path and carries goods. Owners drive the state machine. */
export class Vehicle {
  readonly cargo = new Cargo();
  capacity = BigNum.ZERO;
  state: VehicleState = 'waiting';
  path: Path | null = null;
  legStart = 0;
  legEnd = 0;

  constructor(
    readonly id: string,
    readonly kind: VehicleKind,
    readonly model: string,
    readonly owner?: VehicleOwner,
  ) {}

  /** Starts moving along `path`; returns the tick of arrival. */
  travel(path: Path, speed: number, tick: number): number {
    this.path = path;
    this.state = 'moving';
    this.legStart = tick;
    this.legEnd = tick + travelTicks(path.length, speed);
    return this.legEnd;
  }

  pose(tick: number, parked: Pose): Pose {
    if (!this.path) return parked;
    if (this.state !== 'moving') return poseAt(this.path, 1);
    const span = this.legEnd - this.legStart;
    return poseAt(this.path, span <= 0 ? 1 : (tick - this.legStart) / span);
  }

  /** How far along its path it is. */
  private travelled(tick: number): number {
    if (!this.path) return 0;
    const span = this.legEnd - this.legStart;
    return this.path.length * (span <= 0 ? 1 : Math.min(1, Math.max(0, (tick - this.legStart) / span)));
  }

  view(tick: number, parked: Pose): VehicleView {
    const pose = this.pose(tick, parked);
    const loadRatio = this.capacity.isZero ? 0 : Math.min(1, ratio(this.cargo.total(), this.capacity));
    return {
      id: this.id,
      kind: this.kind,
      model: this.model,
      x: pose.x,
      y: pose.y,
      z: pose.z,
      heading: pose.heading,
      state: this.state,
      cargo: this.cargo.view(),
      loadRatio,
      capacity: this.capacity,
      ...(this.owner ? { owner: this.owner } : {}),
      ...(this.path && this.state === 'moving' ? { route: { points: this.path.points, travelled: this.travelled(tick) } } : {}),
    };
  }
}
