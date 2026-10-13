/**
 * Demand-driven dispatch. Nobody configures routes, and carriers only ever
 * fetch: whenever a node has an idle carrier, the dispatcher plans one round
 * that collects what the node wants from wherever it lies and brings it home.
 * Buildings fetch their ingredients, sale channels fetch what is left over.
 */
import type { ItemDef, ItemId } from '@/contracts';
import { BigNum } from '@/core/BigNum';
import type { Balance } from '@/content/balance';
import type { Stop, StopItem } from './Carrier';
import { isPositive, minOf, subClamp } from './math';
import type { CarrierHome, Consumer, LogisticsNode, PickupSource } from './nodes';

/** A carrier home that sells: its carriers collect goods no building is waiting for. */
export interface SaleHome extends CarrierHome {
  readonly unlocked: boolean;
  reserveDelivery(item: ItemId, amount: BigNum): void;
}

export interface DispatchContext {
  readonly balance: Balance;
  readonly items: Readonly<Record<ItemId, ItemDef>>;
  readonly homes: readonly CarrierHome[];
  consumersOf(item: ItemId): readonly Consumer[];
  sourcesOf(item: ItemId): readonly PickupSource[];
  /** Best open sale channel for the item right now, or null when it cannot be sold. */
  chooseSale(item: ItemDef): SaleHome | null;
  distance(from: number, to: number): number;
}

interface Pickup {
  node: LogisticsNode;
  distance: number;
  items: StopItem[];
}

function addItem(items: StopItem[], item: ItemId, amount: BigNum): void {
  const existing = items.find((entry) => entry.item === item);
  if (existing) existing.amount = existing.amount.add(amount);
  else items.push({ item, amount });
}

const isSaleHome = (home: CarrierHome): home is SaleHome => 'unlocked' in home;

/** Collects the pickups of one round and keeps count of the room left on the carrier. */
class Round {
  readonly pickups = new Map<string, Pickup>();
  readonly unload: StopItem[] = [];
  room: BigNum;

  constructor(
    private readonly home: CarrierHome,
    private readonly maxStops: number,
  ) {
    this.room = home.carrierCapacity();
  }

  canVisit(source: LogisticsNode): boolean {
    return this.pickups.size < this.maxStops || this.pickups.has(source.id);
  }

  /** Reserves up to `wanted` of the item at the source; returns what was reserved. */
  take(source: PickupSource, item: ItemId, wanted: BigNum, distance: number): BigNum {
    if (!this.canVisit(source)) return BigNum.ZERO;
    const amount = minOf(minOf(source.availableForPickup(item), wanted), this.room);
    if (!isPositive(amount)) return BigNum.ZERO;
    let pickup = this.pickups.get(source.id);
    if (!pickup) {
      pickup = { node: source, distance, items: [] };
      this.pickups.set(source.id, pickup);
    }
    addItem(pickup.items, item, amount);
    addItem(this.unload, item, amount);
    source.reservePickup(item, amount);
    this.room = subClamp(this.room, amount);
    return amount;
  }

  stops(): Stop[] | null {
    if (this.pickups.size === 0) return null;
    const loads = [...this.pickups.values()].sort((a, b) => a.distance - b.distance);
    return [
      ...loads.map((pickup): Stop => ({ node: pickup.node.id, action: 'load', items: pickup.items })),
      { node: this.home.id, action: 'unload', items: this.unload },
    ];
  }
}

export class Dispatcher {
  constructor(private readonly ctx: DispatchContext) {}

  /** Plans a round for an idle carrier of `home`, reserving everything it will move. Null = nothing to do. */
  plan(home: CarrierHome): Stop[] | null {
    return isSaleHome(home) ? this.planSale(home) : this.planInputs(home);
  }

  /**
   * A building fetches its ingredients. The carrier's room is split between
   * the ingredients in proportion to what is missing, so a recipe with
   * several inputs gets all of them instead of a full load of the first one.
   * Sources that most need emptying come first, then nearer ones.
   */
  private planInputs(home: CarrierHome): Stop[] | null {
    const { ctx } = this;
    const from = home.site.index;
    const round = new Round(home, ctx.balance.carriers.maxStops);

    const wants = home
      .pullSlots()
      .map((slot) => ({ slot, missing: slot.demand() }))
      .filter((want) => isPositive(want.missing));
    if (wants.length === 0) return null;
    let total = BigNum.ZERO;
    for (const want of wants) total = total.add(want.missing);
    const share = total.cmp(round.room) > 0 ? round.room.div(total) : BigNum.ONE;

    const fetch = (want: (typeof wants)[number], limit: BigNum): void => {
      let wanted = limit;
      const sources = ctx
        .sourcesOf(want.slot.item)
        .filter((source) => source !== (home as LogisticsNode) && isPositive(source.availableForPickup(want.slot.item)))
        .map((source) => ({ source, distance: ctx.distance(from, source.site.index) }))
        .sort((a, b) => b.source.pickupUrgency - a.source.pickupUrgency || a.distance - b.distance);
      for (const { source, distance } of sources) {
        if (!isPositive(wanted) || !isPositive(round.room)) break;
        const amount = round.take(source, want.slot.item, wanted, distance);
        if (amount.isZero) continue;
        want.slot.incoming = want.slot.incoming.add(amount);
        want.missing = subClamp(want.missing, amount);
        wanted = subClamp(wanted, amount);
      }
    };

    for (const want of wants) fetch(want, want.missing.mul(share));
    // Room an ingredient could not use (nothing in stock anywhere) goes to the others.
    for (const want of wants) fetch(want, want.missing);
    return round.stops();
  }

  /**
   * A sale channel fetches what no building is waiting for: stock beyond
   * the unmet demand for that item, dearest goods first. It only takes items
   * for which it is the channel of choice right now.
   */
  private planSale(home: SaleHome): Stop[] | null {
    if (!home.unlocked) return null;
    const { ctx } = this;
    const from = home.site.index;
    const round = new Round(home, ctx.balance.carriers.maxStops);

    const offers: Array<{ source: PickupSource; item: ItemDef; surplus: BigNum; distance: number }> = [];
    for (const item of Object.values(ctx.items)) {
      if (!item.sellable || ctx.chooseSale(item) !== home) continue;
      let unmet = BigNum.ZERO;
      for (const consumer of ctx.consumersOf(item.id)) unmet = unmet.add(consumer.demand(item.id));
      for (const source of ctx.sourcesOf(item.id)) {
        const surplus = subClamp(source.availableForPickup(item.id), unmet);
        if (!isPositive(surplus)) continue;
        offers.push({ source, item, surplus, distance: ctx.distance(from, source.site.index) });
      }
    }
    offers.sort((a, b) => b.item.basePrice - a.item.basePrice || a.distance - b.distance);

    for (const offer of offers) {
      if (!isPositive(round.room)) break;
      const amount = round.take(offer.source, offer.item.id, offer.surplus, offer.distance);
      if (!amount.isZero) home.reserveDelivery(offer.item.id, amount);
    }
    return round.stops();
  }
}
