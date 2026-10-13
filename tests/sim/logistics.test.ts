import { describe, expect, it } from 'vitest';
import type { GameEvent, ItemDef, ItemId } from '@/contracts';
import { BigNum, bn } from '@/core/BigNum';
import { catalog } from '@/content';
import { BALANCE } from '@/content/balance';
import { Dispatcher, type DispatchContext, type SaleHome } from '@/sim/Dispatcher';
import { Slot } from '@/sim/Inventory';
import type { CarrierHome, Consumer, PickupSource, Site } from '@/sim/nodes';
import { Cargo, travelTicks, weightFactor } from '@/sim/Vehicle';
import { EXPORT_CHANNEL, newGame, SECOND_ISLAND, seconds, tickUntil, twoIslandCatalog } from './helpers';

const site = (index: number): Site => ({ index, id: `s${index}`, x: 0, z: 0, dock: { x: 0, y: 0, z: 0 }, heading: 0, road: index });

/** A node whose carriers fetch: a building with input slots, or (with `unlocked`) a sale channel. */
class FakeHome implements CarrierHome {
  readonly site = site(0);
  readonly carriers = [];
  readonly slots: Slot[] = [];
  constructor(
    private readonly capacity: number,
    readonly id = 'home',
  ) {}
  /** An input slot with room for `missing` more. */
  wants(item: ItemId, missing: number): this {
    const slot = new Slot(item);
    slot.capacity = bn(missing);
    this.slots.push(slot);
    return this;
  }
  carrierCapacity = (): BigNum => bn(this.capacity);
  pullSlots = (): readonly Slot[] => this.slots;
  returnCargo(): void {}
  deliver(): void {}
  cancelDelivery(): void {}
  pickup = (): BigNum => BigNum.ZERO;
  cancelPickup(): void {}
}

class FakeSaleHome extends FakeHome implements SaleHome {
  readonly unlocked = true;
  readonly reserved = new Map<ItemId, number>();
  constructor(capacity: number) {
    super(capacity, 'sale');
  }
  reserveDelivery(item: ItemId, amount: BigNum): void {
    this.reserved.set(item, (this.reserved.get(item) ?? 0) + amount.toNumber());
  }
}

class FakeSource implements PickupSource {
  readonly stock = new Map<ItemId, number>();
  pickupUrgency = 0;
  constructor(
    readonly id: string,
    readonly site: Site,
  ) {}
  has(item: ItemId, amount: number): this {
    this.stock.set(item, amount);
    return this;
  }
  availableForPickup = (item: ItemId): BigNum => bn(this.stock.get(item) ?? 0);
  reservePickup(item: ItemId, amount: BigNum): void {
    this.stock.set(item, (this.stock.get(item) ?? 0) - amount.toNumber());
  }
  deliver(): void {}
  cancelDelivery(): void {}
  pickup = (): BigNum => BigNum.ZERO;
  cancelPickup(): void {}
}

/** A building still waiting for `wants` of every item. */
const consumer = (wants: number): Consumer => ({
  id: 'consumer',
  site: site(8),
  demand: () => bn(wants),
  reserveDelivery() {},
  readyExcept: () => true,
  productValue: 1,
  deliver() {},
  cancelDelivery() {},
  pickup: () => BigNum.ZERO,
  cancelPickup() {},
});

function dispatcher(sources: FakeSource[], options: { sale?: SaleHome; consumers?: Consumer[] } = {}) {
  const ctx: DispatchContext = {
    balance: BALANCE,
    items: catalog.items,
    homes: [],
    consumersOf: () => options.consumers ?? [],
    sourcesOf: (item) => sources.filter((source) => source.stock.has(item)),
    chooseSale: (_item: ItemDef) => options.sale ?? null,
    distance: (_from, to) => to,
  };
  return new Dispatcher(ctx);
}

/** The pickups of a round as [node, item, amount], in the order they are visited. */
const loads = (stops: ReturnType<Dispatcher['plan']>): Array<[string, string, number]> =>
  (stops ?? [])
    .filter((stop) => stop.action === 'load')
    .flatMap((stop) => stop.items.map((entry): [string, string, number] => [stop.node, entry.item, entry.amount.toNumber()]));

describe('demand-based dispatch', () => {
  it('fetches what a building is missing and brings it home', () => {
    const home = new FakeHome(10).wants('lumber', 6);
    const mill = new FakeSource('mill', site(1)).has('lumber', 50);
    const stops = dispatcher([mill]).plan(home);
    expect(loads(stops)).toEqual([['mill', 'lumber', 6]]);
    expect(stops!.at(-1)).toMatchObject({ node: 'home', action: 'unload' });
    // Both ends know about the trip: the stock is spoken for and the slot expects it.
    expect(mill.stock.get('lumber')).toBe(44);
    expect(home.slots[0]!.incoming.toNumber()).toBe(6);
    expect(home.slots[0]!.demand().isZero).toBe(true);
  });

  it('splits the load between ingredients in proportion to what is missing', () => {
    const home = new FakeHome(10).wants('lumber', 30).wants('fabric', 10);
    const yard = new FakeSource('yard', site(1)).has('lumber', 99).has('fabric', 99);
    const drops = loads(dispatcher([yard]).plan(home));
    expect(drops[0]![2]).toBeCloseTo(7.5);
    expect(drops[1]![2]).toBeCloseTo(2.5);
  });

  it('gives room an ingredient cannot use to the others', () => {
    const home = new FakeHome(10).wants('lumber', 30).wants('fabric', 10);
    const yard = new FakeSource('yard', site(1)).has('lumber', 99);
    expect(loads(dispatcher([yard]).plan(home))).toEqual([['yard', 'lumber', 10]]);
  });

  it('goes to the nearest source first, and on to the next when that is not enough', () => {
    const home = new FakeHome(10).wants('lumber', 10);
    const far = new FakeSource('far', site(5)).has('lumber', 50);
    const near = new FakeSource('near', site(2)).has('lumber', 4);
    const drops = loads(dispatcher([far, near]).plan(home));
    expect(drops.map((drop) => drop[0])).toEqual(['near', 'far']);
    expect(drops[0]![2]).toBeCloseTo(4);
    expect(drops[1]![2]).toBeCloseTo(6);
  });

  it('empties the source that most needs it before a nearer one', () => {
    const home = new FakeHome(10).wants('slag', 10);
    const near = new FakeSource('near', site(1)).has('slag', 50);
    const clogged = new FakeSource('clogged', site(6)).has('slag', 50);
    clogged.pickupUrgency = 0.9;
    expect(loads(dispatcher([near, clogged]).plan(home))).toEqual([['clogged', 'slag', 10]]);
  });

  it('lets a sale channel fetch only what no building is waiting for, dearest first', () => {
    const sale = new FakeSaleHome(10);
    const mill = new FakeSource('mill', site(1)).has('lumber', 9).has('sawdust', 9);
    // A building still wants 5 of each, so 4 of each is left to sell.
    const stops = dispatcher([mill], { sale, consumers: [consumer(5)] }).plan(sale);
    expect(loads(stops)).toEqual([
      ['mill', 'lumber', 4],
      ['mill', 'sawdust', 4],
    ]);
    expect(catalog.items.lumber!.basePrice).toBeGreaterThan(catalog.items.sawdust!.basePrice);
    expect(sale.reserved.get('lumber')).toBe(4);
    expect(stops!.at(-1)).toMatchObject({ node: 'sale', action: 'unload' });
  });

  it('never sells waste or raw material, and leaves goods alone that go to another channel', () => {
    const sale = new FakeSaleHome(10);
    const yard = new FakeSource('yard', site(1)).has('slag', 10).has('wood', 10);
    expect(dispatcher([yard], { sale }).plan(sale)).toBeNull();
    const mill = new FakeSource('mill', site(1)).has('lumber', 10);
    expect(dispatcher([mill], { sale: new FakeSaleHome(10) }).plan(sale)).toBeNull();
    expect(mill.stock.get('lumber')).toBe(10);
  });

  it('does nothing when there is no stock', () => {
    expect(dispatcher([]).plan(new FakeHome(10).wants('lumber', 10))).toBeNull();
    expect(dispatcher([new FakeSource('mill', site(1))]).plan(new FakeHome(10))).toBeNull();
  });

  it('sends goods to the best paying open channel until it backs up', () => {
    const game = newGame({ money: 1e12 });
    const island = game.island;
    const lumber = catalog.items.lumber!;
    expect(island.chooseSale(lumber)?.id).toBe('sale.truck');
    expect(game.unlock('unlock.channel.ship')).toEqual({ ok: true });
    const ship = island.channel('sale.ship')!;
    expect(island.chooseSale(lumber)).toBe(ship);
    const shipLoad = catalog.saleChannels['sale.ship']!.baseLoad;
    ship.stock.slot('lumber').add(bn(shipLoad * BALANCE.channels.backlogLoads));
    expect(island.chooseSale(lumber)?.id).toBe('sale.truck');
  });
});

describe('vehicles', () => {
  it('moves stock only when the carrier has arrived and finished unloading', () => {
    const game = newGame();
    const island = game.island;
    const sawmill = island.buildings[0]!;
    // The sawmill's own carrier goes to the inbound yard for the wood.
    const carrier = sawmill.carriers[0]!;
    const wood = (): number => sawmill.inputs.amount('wood').toNumber();
    const seen = { travelWithCargo: 0, handlingAtDock: 0 };
    let previous = { phase: carrier.phase, at: carrier.at, cargo: 0 };

    tickUntil(
      game,
      () => {
        if (wood() > 0 || sawmill.cycle) return true;
        const cargo = carrier.cargo.amount('wood').toNumber();
        if (carrier.phase === 'travel' && cargo > 0) {
          seen.travelWithCargo += 1;
          // On the road: not yet in the building.
          expect(wood()).toBe(0);
        }
        if (carrier.phase === 'handle' && carrier.at === sawmill.site.index) seen.handlingAtDock += 1;
        previous = { phase: carrier.phase, at: carrier.at, cargo };
        return false;
      },
      seconds(120),
    );
    expect(seen.travelWithCargo).toBeGreaterThan(10);
    // It spends the whole handling time at the dock before anything changes hands.
    expect(seen.handlingAtDock).toBe(seconds(BALANCE.carriers.handlingSec));
    // The tick before the wood appeared, the carrier stood at the sawmill's dock with the wood still on board.
    expect(previous.phase).toBe('handle');
    expect(previous.at).toBe(sawmill.site.index);
    expect(previous.cargo).toBeGreaterThan(0);
    expect(wood()).toBeCloseTo(previous.cargo);
    expect(carrier.cargo.amount('wood').isZero).toBe(true);
  });

  it('pays only when the sale vehicle has left the island', () => {
    const game = newGame();
    const truckYard = game.island.channel('sale.truck')!;
    if (!('vehicle' in truckYard)) throw new Error('expected a sale channel');
    const events: GameEvent[] = [];
    let previous: { phase: string; value: number } | null = null;
    let sawStockWaiting = false;
    let sawLoadedTruck = false;

    tickUntil(
      game,
      () => {
        events.push(...game.drainEvents());
        if (!game.money.isZero) return true;
        if (truckYard.stock.hasAny) sawStockWaiting = true;
        const vehicle = truckYard.vehicle;
        if (vehicle) {
          let value = 0;
          for (const [item, amount] of vehicle.cargo.items) value += amount.toNumber() * catalog.items[item]!.basePrice;
          if (value > 0) sawLoadedTruck = true;
          previous = { phase: vehicle.phase, value };
        } else {
          previous = null;
        }
        return false;
      },
      seconds(300),
    );
    // Goods waited in the yard and rode on the truck without earning anything yet.
    expect(sawStockWaiting).toBe(true);
    expect(sawLoadedTruck).toBe(true);
    expect(previous).not.toBeNull();
    expect(previous!.phase).toBe('out');
    expect(truckYard.vehicle).toBeNull();
    const sales = events.filter((event) => event.type === 'sale');
    expect(sales).toHaveLength(1);
    const sale = sales[0] as Extract<GameEvent, { type: 'sale' }>;
    expect(sale.channelId).toBe('sale.truck');
    expect(sale.amount.toNumber()).toBeCloseTo(previous!.value * catalog.saleChannels['sale.truck']!.priceMultiplier);
    expect(game.money.eq(sale.amount)).toBe(true);
    expect(game.totalEarned.eq(sale.amount)).toBe(true);
  });

  it('pays island exports the better price less fee and losses', () => {
    const twoIslands = twoIslandCatalog();
    const game = newGame({ catalog: twoIslands });
    expect(game.switchIsland(SECOND_ISLAND)).toEqual({ ok: true });
    game.drainEvents();
    const berth = game.island.channel(EXPORT_CHANNEL)!;
    if (!('vehicle' in berth)) throw new Error('expected a sale channel');
    let gross = 0;
    let sale: Extract<GameEvent, { type: 'sale' }> | undefined;
    tickUntil(
      game,
      () => {
        for (const event of game.drainEvents()) if (event.type === 'sale' && event.channelId === EXPORT_CHANNEL) sale = event;
        if (sale) return true;
        const vehicle = berth.vehicle;
        if (vehicle && vehicle.phase === 'out') {
          gross = 0;
          for (const [item, amount] of vehicle.cargo.items) gross += amount.toNumber() * twoIslands.items[item]!.basePrice;
        }
        return false;
      },
      seconds(300),
    );
    const def = twoIslands.saleChannels[EXPORT_CHANNEL]!;
    expect(gross).toBeGreaterThan(0);
    expect(sale!.amount.toNumber()).toBeCloseTo(gross * def.priceMultiplier * (1 - def.feeRate!) * (1 - def.lossRate!));
  });

  it('slows down with the mean weight of the cargo, down to a floor', () => {
    expect(weightFactor(0, 1, BALANCE)).toBe(1);
    expect(weightFactor(1, 1, BALANCE)).toBe(1);
    expect(weightFactor(3, 1, BALANCE)).toBeCloseTo(1 - 2 * BALANCE.weight.slowPerWeight);
    expect(weightFactor(3, 0.5, BALANCE)).toBeCloseTo(1 - BALANCE.weight.slowPerWeight);
    expect(weightFactor(5, 0, BALANCE)).toBe(1);
    expect(weightFactor(500, 1, BALANCE)).toBe(BALANCE.weight.minFactor);

    // The amount does not matter, only the mix.
    const light = new Cargo();
    light.add('cotton', bn('1e40'));
    const mixed = new Cargo();
    mixed.add('cotton', bn(10));
    mixed.add('ironOre', bn(30));
    expect(light.averageWeight(catalog.items)).toBe(catalog.items.cotton!.weight);
    expect(mixed.averageWeight(catalog.items)).toBeCloseTo(4);
    expect(travelTicks(100, 10 * weightFactor(4, 1, BALANCE))).toBeGreaterThan(travelTicks(100, 10));
  });

  it('makes a carrier with heavy cargo take longer over the same road', () => {
    const trip = (raw: string, building: string): number => {
      const game = newGame({
        catalog: {
          ...catalog,
          islands: {
            [catalog.startIsland]: {
              ...catalog.islands[catalog.startIsland]!,
              start: { money: 0, buildings: [{ plot: 'p2-0', type: building }] },
            },
          },
        },
      });
      const carrier = game.island.buildings[0]!.carriers[0]!;
      tickUntil(game, () => carrier.phase === 'travel' && !carrier.cargo.amount(raw).isZero, seconds(120));
      return carrier.legEnd - carrier.legStart;
    };
    expect(trip('ironOre', 'steelMill')).toBeGreaterThan(trip('cotton', 'textileMill'));
  });
});
