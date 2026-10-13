/**
 * Demand-driven dispatch. Nobody configures routes: whenever a node has an
 * idle carrier, the dispatcher plans one round for it from what is in stock
 * and what other nodes are asking for.
 */
import type { ItemDef, ItemId, JsonValue } from '@/contracts';
import { BigNum } from '@/core/BigNum';
import type { Balance } from '@/content/balance';
import type { Stop, StopItem } from './Carrier';
import type { Slot } from './Inventory';
import { isPositive, minOf, subClamp } from './math';
import type { CarrierHome, Consumer, LogisticsNode, PickupSource } from './nodes';

/** A place that takes goods nobody asked for and turns them into money. */
export interface SaleTarget extends LogisticsNode {
  reserveDelivery(item: ItemId, amount: BigNum): void;
}

export interface DispatchContext {
  readonly balance: Balance;
  readonly items: Readonly<Record<ItemId, ItemDef>>;
  readonly homes: readonly CarrierHome[];
  consumersOf(item: ItemId): readonly Consumer[];
  sourcesOf(item: ItemId): readonly PickupSource[];
  /** Best open sale channel for the item right now, or null when it cannot be sold. */
  chooseSale(item: ItemDef): SaleTarget | null;
  distance(from: number, to: number): number;
}

interface Request {
  consumer: Consumer;
  slot: Slot;
  demand: BigNum;
  ready: boolean;
  value: number;
  distance: number;
}

interface Drop {
  node: LogisticsNode;
  distance: number;
  items: StopItem[];
}

function addItem(items: StopItem[], item: ItemId, amount: BigNum): void {
  const existing = items.find((entry) => entry.item === item);
  if (existing) existing.amount = existing.amount.add(amount);
  else items.push({ item, amount });
}

export class Dispatcher {
  /** Round in which each consumer last got a delivery; only used to take turns. */
  private readonly lastVisit = new Map<string, number>();
  private round = 0;

  constructor(private readonly ctx: DispatchContext) {}

  toJSON(): JsonValue {
    return { round: this.round, lastVisit: Object.fromEntries(this.lastVisit) };
  }

  restore(saved: unknown): void {
    if (!saved || typeof saved !== 'object') return;
    const data = saved as Record<string, unknown>;
    this.round = Number(data.round) || 0;
    this.lastVisit.clear();
    const visits = (data.lastVisit && typeof data.lastVisit === 'object' ? data.lastVisit : {}) as Record<string, unknown>;
    for (const [id, round] of Object.entries(visits)) this.lastVisit.set(id, Number(round) || 0);
  }

  /** Plans a round for an idle carrier of `home`, reserving everything it will move. Null = nothing to do. */
  plan(home: CarrierHome): Stop[] | null {
    return this.planCollection(home) ?? this.planDelivery(home);
  }

  /**
   * Delivery round: share the load between the requests, hand out the rest
   * in priority order (can start at once -> more valuable product ->
   * nearer), then take what nobody asked for to a sale channel with the
   * room that is left.
   */
  private planDelivery(home: CarrierHome): Stop[] | null {
    const stock = home.pushSlots().filter((slot) => slot.hasStock);
    if (stock.length === 0) return null;
    const { ctx } = this;
    const from = home.site.index;

    const requests: Request[] = [];
    for (const slot of stock) {
      for (const consumer of ctx.consumersOf(slot.item)) {
        if (consumer === (home as LogisticsNode)) continue;
        const demand = consumer.demand(slot.item);
        if (!isPositive(demand)) continue;
        requests.push({
          consumer,
          slot,
          demand,
          ready: consumer.readyExcept(slot.item),
          value: consumer.productValue,
          distance: ctx.distance(from, consumer.site.index),
        });
      }
    }
    requests.sort(
      (a, b) => Number(b.ready) - Number(a.ready) || b.value - a.value || a.distance - b.distance,
    );

    let room = home.carrierCapacity();
    const left = new Map<Slot, BigNum>();
    for (const slot of stock) left.set(slot, slot.amount);
    const drops = new Map<string, Drop>();
    const loaded: StopItem[] = [];
    const maxStops = ctx.balance.carriers.maxStops;

    const assign = (node: LogisticsNode, slot: Slot, wanted: BigNum, distance: number): BigNum => {
      const amount = minOf(minOf(wanted, left.get(slot)!), room);
      if (!isPositive(amount)) return BigNum.ZERO;
      let drop = drops.get(node.id);
      if (!drop) {
        drop = { node, distance, items: [] };
        drops.set(node.id, drop);
      }
      addItem(drop.items, slot.item, amount);
      addItem(loaded, slot.item, amount);
      left.set(slot, subClamp(left.get(slot)!, amount));
      room = subClamp(room, amount);
      return amount;
    };

    // One round visits at most `maxStops` consumers. When more are asking,
    // the ones that have waited longest go first, so nobody is skipped forever.
    const asking = [...new Set(requests.map((request) => request.consumer.id))];
    if (asking.length > maxStops) {
      asking.sort((x, y) => (this.lastVisit.get(x) ?? 0) - (this.lastVisit.get(y) ?? 0));
    }
    const visiting = new Set(asking.slice(0, maxStops));
    const served = requests.filter((request) => visiting.has(request.consumer.id));
    const give = (request: Request, wanted: BigNum): void => {
      const given = assign(request.consumer, request.slot, wanted, request.distance);
      if (given.isZero) return;
      request.consumer.reserveDelivery(request.slot.item, given);
      request.demand = subClamp(request.demand, given);
    };
    // Everyone first gets an equal share of the carrier. Without it the top
    // request takes the whole load trip after trip and the rest never work.
    // What is left then goes out in priority order.
    if (served.length > 1) {
      const share = room.div(served.length);
      for (const request of served) give(request, minOf(request.demand, share));
    }
    for (const request of served) {
      if (!isPositive(room)) break;
      give(request, request.demand);
    }
    this.round += 1;
    for (const id of drops.keys()) this.lastVisit.set(id, this.round);

    if (isPositive(room)) {
      // Most valuable leftovers first; they earn the most per carrier trip.
      const sellable = stock
        .filter((slot) => ctx.items[slot.item]?.sellable && isPositive(left.get(slot)!))
        .sort((a, b) => ctx.items[b.item]!.basePrice - ctx.items[a.item]!.basePrice);
      for (const slot of sellable) {
        if (!isPositive(room)) break;
        const target = ctx.chooseSale(ctx.items[slot.item]!);
        if (!target) continue;
        if (drops.size > maxStops && !drops.has(target.id)) continue;
        const given = assign(target, slot, left.get(slot)!, ctx.distance(from, target.site.index));
        if (!given.isZero) target.reserveDelivery(slot.item, given);
      }
    }

    if (drops.size === 0) return null;
    for (const entry of loaded) home.pushSlots().find((slot) => slot.item === entry.item)!.take(entry.amount);
    home.stockTaken();
    const unloads = [...drops.values()].sort((a, b) => a.distance - b.distance);
    return [
      { node: home.id, action: 'load', items: loaded, preloaded: true },
      ...unloads.map((drop): Stop => ({ node: drop.node.id, action: 'unload', items: drop.items })),
    ];
  }

  /**
   * Collection round for nodes that fetch their own inputs (waste disposal):
   * visit the sources that need it most, then bring everything home.
   */
  private planCollection(home: CarrierHome): Stop[] | null {
    const slots = home.pullSlots();
    if (slots.length === 0) return null;
    const { ctx } = this;
    const from = home.site.index;
    let room = home.carrierCapacity();
    const pickups = new Map<string, Drop>();
    const unload: StopItem[] = [];
    const maxStops = ctx.balance.carriers.maxStops;

    for (const slot of slots) {
      let wanted = minOf(slot.demand(), room);
      if (!isPositive(wanted)) continue;
      const sources = ctx
        .sourcesOf(slot.item)
        .filter((source) => source !== (home as LogisticsNode) && isPositive(source.availableForPickup(slot.item)))
        .map((source) => ({ source, distance: ctx.distance(from, source.site.index) }))
        .sort((a, b) => b.source.pickupUrgency - a.source.pickupUrgency || a.distance - b.distance);
      for (const { source, distance } of sources) {
        if (!isPositive(wanted)) break;
        if (pickups.size >= maxStops && !pickups.has(source.id)) continue;
        const amount = minOf(source.availableForPickup(slot.item), wanted);
        if (!isPositive(amount)) continue;
        let pickup = pickups.get(source.id);
        if (!pickup) {
          pickup = { node: source, distance, items: [] };
          pickups.set(source.id, pickup);
        }
        addItem(pickup.items, slot.item, amount);
        addItem(unload, slot.item, amount);
        source.reservePickup(slot.item, amount);
        slot.incoming = slot.incoming.add(amount);
        wanted = subClamp(wanted, amount);
        room = subClamp(room, amount);
      }
    }

    if (pickups.size === 0) return null;
    const loads = [...pickups.values()].sort((a, b) => a.distance - b.distance);
    return [
      ...loads.map((pickup): Stop => ({ node: pickup.node.id, action: 'load', items: pickup.items })),
      { node: home.id, action: 'unload', items: unload },
    ];
  }
}
