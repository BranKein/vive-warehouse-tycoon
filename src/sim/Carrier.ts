import type { ContentCatalog, ItemId, JsonValue, VehicleView } from '@/contracts';
import { BigNum } from '@/core/BigNum';
import { secondsToTicks } from '@/core/time';
import type { Balance } from '@/content/balance';
import { parseAmount } from './Inventory';
import { minOf } from './math';
import type { CarrierHome, LogisticsNode, Site } from './nodes';
import type { Path } from './RoadGraph';
import { Vehicle, weightFactor } from './Vehicle';

export type StopAction = 'load' | 'unload';

export interface StopItem {
  item: ItemId;
  amount: BigNum;
}

/** One halt of a delivery round. */
export interface Stop {
  /** Node id; the node may be gone (demolished) by the time the carrier gets there. */
  node: string;
  action: StopAction;
  items: StopItem[];
  /** The goods were already put on the carrier when the trip was planned (loading at home). */
  preloaded?: boolean;
}

/** What a carrier needs from the island it drives on. */
export interface CarrierContext {
  readonly catalog: ContentCatalog;
  readonly balance: Balance;
  readonly sites: readonly Site[];
  node(id: string): LogisticsNode | undefined;
  pathBetween(from: number, to: number): Path;
  markDirty(): void;
}

type Phase = 'idle' | 'travel' | 'handle' | 'return';

/**
 * A small vehicle owned by a node. It works through a list of stops (load
 * here, unload there) and then drives home. The same round handles a plain
 * delivery, a multi-drop delivery and a collection run.
 */
export class Carrier extends Vehicle {
  phase: Phase = 'idle';
  stops: Stop[] = [];
  stopIndex = 0;
  /** Site the carrier is at, or left last. */
  at: number;
  /** Site it is driving to. */
  to: number;
  /** Tick at which it needs attention again; Infinity while idle. */
  wake = Infinity;

  constructor(
    id: string,
    readonly home: CarrierHome,
    model: string,
  ) {
    super(id, 'carrier', model);
    this.at = home.site.index;
    this.to = home.site.index;
  }

  get isIdle(): boolean {
    return this.phase === 'idle';
  }

  /** Site of the stop being handled right now, or -1. */
  get handlingSite(): number {
    return this.phase === 'handle' ? this.at : -1;
  }

  start(stops: Stop[], capacity: BigNum, tick: number, ctx: CarrierContext): void {
    this.stops = stops;
    this.stopIndex = 0;
    this.capacity = capacity;
    this.proceed(tick, ctx);
  }

  advance(tick: number, ctx: CarrierContext): void {
    if (this.phase === 'travel') {
      this.at = this.to;
      this.beginHandling(tick, ctx);
    } else if (this.phase === 'handle') {
      this.performStop(ctx);
      this.stopIndex += 1;
      this.proceed(tick, ctx);
    } else if (this.phase === 'return') {
      this.at = this.to;
      this.finish(ctx);
    }
  }

  /** Releases every reservation this carrier still holds (its home is going away). */
  cancel(ctx: CarrierContext): void {
    for (let i = this.stopIndex; i < this.stops.length; i += 1) {
      const stop = this.stops[i]!;
      const node = ctx.node(stop.node);
      if (!node) continue;
      for (const entry of stop.items) {
        if (stop.action === 'unload') node.cancelDelivery(entry.item, entry.amount);
        else if (!stop.preloaded) node.cancelPickup(entry.item, entry.amount);
      }
    }
    this.stops = [];
    this.stopIndex = 0;
    this.cargo.clear();
    this.phase = 'idle';
    this.wake = Infinity;
  }

  private proceed(tick: number, ctx: CarrierContext): void {
    while (this.stopIndex < this.stops.length) {
      const node = ctx.node(this.stops[this.stopIndex]!.node);
      if (!node) {
        // The destination was demolished on the way; skip it and keep the cargo.
        this.stopIndex += 1;
        continue;
      }
      if (node.site.index === this.at) this.beginHandling(tick, ctx);
      else this.drive(node.site.index, 'travel', tick, ctx);
      return;
    }
    const home = this.home.site.index;
    if (home === this.at) this.finish(ctx);
    else this.drive(home, 'return', tick, ctx);
  }

  private drive(to: number, phase: Phase, tick: number, ctx: CarrierContext): void {
    this.to = to;
    this.phase = phase;
    const { carriers, weight } = ctx.balance;
    const factor = weightFactor(this.cargo.averageWeight(ctx.catalog.items), weight.carrierSensitivity, ctx.balance);
    this.wake = this.travel(ctx.pathBetween(this.at, to), carriers.speed * factor, tick);
  }

  private beginHandling(tick: number, ctx: CarrierContext): void {
    const stop = this.stops[this.stopIndex];
    this.phase = 'handle';
    this.state = stop?.action === 'load' ? 'loading' : 'unloading';
    this.wake = tick + secondsToTicks(ctx.balance.carriers.handlingSec);
  }

  private performStop(ctx: CarrierContext): void {
    const stop = this.stops[this.stopIndex];
    const node = stop ? ctx.node(stop.node) : undefined;
    if (!stop || !node || stop.preloaded) return;
    for (const entry of stop.items) {
      if (stop.action === 'load') {
        this.cargo.add(entry.item, node.pickup(entry.item, entry.amount));
      } else {
        const delivered = this.cargo.take(entry.item, minOf(entry.amount, this.cargo.amount(entry.item)));
        node.deliver(entry.item, delivered, entry.amount);
      }
    }
    ctx.markDirty();
  }

  private finish(ctx: CarrierContext): void {
    for (const [item, amount] of this.cargo.items) this.home.returnCargo(item, amount);
    this.cargo.clear();
    this.stops = [];
    this.stopIndex = 0;
    this.phase = 'idle';
    this.state = 'waiting';
    this.path = null;
    this.wake = Infinity;
    ctx.markDirty();
  }

  viewAt(tick: number, ctx: CarrierContext): VehicleView {
    const site = ctx.sites[this.at]!;
    return this.view(tick, { x: site.dock.x, y: site.dock.y, z: site.dock.z, heading: site.heading });
  }

  toJSON(): JsonValue {
    return {
      phase: this.phase,
      state: this.state,
      at: this.at,
      to: this.to,
      wake: this.wake === Infinity ? null : this.wake,
      legStart: this.legStart,
      legEnd: this.legEnd,
      capacity: this.capacity.toString(),
      cargo: this.cargo.toJSON(),
      stopIndex: this.stopIndex,
      stops: this.stops.map((stop) => ({
        node: stop.node,
        action: stop.action,
        preloaded: stop.preloaded === true,
        items: stop.items.map((entry) => [entry.item, entry.amount.toString()]),
      })),
    };
  }

  restore(saved: unknown, ctx: CarrierContext): void {
    if (!saved || typeof saved !== 'object') return;
    const data = saved as Record<string, unknown>;
    const known = (item: ItemId): boolean => item in ctx.catalog.items;
    const phase = data.phase;
    if (phase !== 'travel' && phase !== 'handle' && phase !== 'return') return;
    const siteCount = ctx.sites.length;
    const at = Number(data.at);
    const to = Number(data.to);
    if (!(at >= 0 && at < siteCount && to >= 0 && to < siteCount)) return;
    this.phase = phase;
    this.at = at;
    this.to = to;
    this.wake = typeof data.wake === 'number' ? data.wake : Infinity;
    this.legStart = Number(data.legStart) || 0;
    this.legEnd = Number(data.legEnd) || 0;
    this.capacity = parseAmount(data.capacity);
    this.cargo.restore(data.cargo, known);
    this.stopIndex = Math.max(0, Number(data.stopIndex) || 0);
    this.stops = [];
    for (const raw of Array.isArray(data.stops) ? data.stops : []) {
      const stop = raw as Record<string, unknown>;
      const items: StopItem[] = [];
      for (const pair of Array.isArray(stop.items) ? stop.items : []) {
        if (Array.isArray(pair) && typeof pair[0] === 'string' && known(pair[0])) {
          items.push({ item: pair[0], amount: parseAmount(pair[1]) });
        }
      }
      this.stops.push({
        node: String(stop.node),
        action: stop.action === 'load' ? 'load' : 'unload',
        items,
        ...(stop.preloaded === true ? { preloaded: true } : {}),
      });
    }
    if (phase === 'handle') {
      const stop = this.stops[this.stopIndex];
      this.state = stop && stop.action === 'load' ? 'loading' : 'unloading';
      this.path = null;
    } else {
      this.state = 'moving';
      this.path = ctx.pathBetween(at, to);
    }
  }
}
