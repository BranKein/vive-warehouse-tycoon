import { describe, expect, it } from 'vitest';
import type { GameEvent, ItemDef, ItemId } from '@/contracts';
import { BigNum, bn } from '@/core/BigNum';
import { catalog } from '@/content';
import { BALANCE } from '@/content/balance';
import { Dispatcher, type DispatchContext, type SaleTarget } from '@/sim/Dispatcher';
import { Slot } from '@/sim/Inventory';
import type { CarrierHome, Consumer, Site } from '@/sim/nodes';
import { Cargo, travelTicks, weightFactor } from '@/sim/Vehicle';
import { EXPORT_CHANNEL, newGame, SECOND_ISLAND, seconds, tickUntil, twoIslandCatalog } from './helpers';

const site = (index: number): Site => ({ index, id: `s${index}`, x: 0, z: 0, dock: { x: 0, y: 0, z: 0 }, heading: 0, road: index });

class FakeHome implements CarrierHome {
  readonly id = 'home';
  readonly site = site(0);
  readonly carriers = [];
  readonly slots: Slot[] = [];
  constructor(private readonly capacity: number) {}
  stock(item: ItemId, amount: number): this {
    const slot = new Slot(item);
    slot.add(bn(amount));
    this.slots.push(slot);
    return this;
  }
  carrierCapacity = (): BigNum => bn(this.capacity);
  pushSlots = (): readonly Slot[] => this.slots;
  pullSlots = (): readonly Slot[] => [];
  stockTaken(): void {}
  returnCargo(): void {}
  deliver(): void {}
  cancelDelivery(): void {}
  pickup = (): BigNum => BigNum.ZERO;
  cancelPickup(): void {}
}

class FakeConsumer implements Consumer {
  readonly reserved = new Map<ItemId, number>();
  constructor(
    readonly id: string,
    readonly site: Site,
    private readonly wants: number,
    private readonly ready: boolean,
    readonly productValue: number,
  ) {}
  demand = (item: ItemId): BigNum => bn(Math.max(0, this.wants - (this.reserved.get(item) ?? 0)));
  reserveDelivery(item: ItemId, amount: BigNum): void {
    this.reserved.set(item, (this.reserved.get(item) ?? 0) + amount.toNumber());
  }
  readyExcept = (): boolean => this.ready;
  deliver(): void {}
  cancelDelivery(): void {}
  pickup = (): BigNum => BigNum.ZERO;
  cancelPickup(): void {}
}

function dispatcher(home: FakeHome, consumers: FakeConsumer[], distances: Record<string, number>, sale: FakeConsumer | null = null) {
  const ctx: DispatchContext = {
    balance: BALANCE,
    items: catalog.items,
    homes: [home],
    consumersOf: () => consumers,
    sourcesOf: () => [],
    chooseSale: (_item: ItemDef) => sale as SaleTarget | null,
    distance: (_from, to) => distances[`s${to}`] ?? 0,
  };
  return new Dispatcher(ctx);
}

const unloads = (stops: ReturnType<Dispatcher['plan']>): Array<[string, number]> =>
  (stops ?? []).filter((stop) => stop.action === 'unload').map((stop) => [stop.node, stop.items[0]!.amount.toNumber()]);

describe('demand-based dispatch', () => {
  it('shares one load between the requests, so a low-priority building is not starved', () => {
    const home = new FakeHome(10).stock('lumber', 10);
    const rich = new FakeConsumer('rich', site(1), 10, true, 500);
    const cheap = new FakeConsumer('cheap', site(2), 10, true, 5);
    const stops = dispatcher(home, [rich, cheap], { s1: 1, s2: 2 }).plan(home);
    expect(unloads(stops)).toEqual([
      ['rich', 5],
      ['cheap', 5],
    ]);
    expect(cheap.reserved.get('lumber')).toBe(5);
    // The goods left the home stock when the trip was planned.
    expect(home.slots[0]!.amount.isZero).toBe(true);
    expect(stops![0]).toMatchObject({ node: 'home', action: 'load', preloaded: true });
  });

  /** `small` leaves part of its share unused; the test checks who gets that rest. */
  const restGoesTo = (a: FakeConsumer, b: FakeConsumer, distances: Record<string, number>): string => {
    const home = new FakeHome(9).stock('lumber', 30);
    const small = new FakeConsumer('small', site(9), 1, true, 0);
    const drops = new Map(unloads(dispatcher(home, [a, b, small], distances).plan(home)));
    expect(drops.get('small')).toBe(1);
    return drops.get(a.id)! > drops.get(b.id)! ? a.id : b.id;
  };

  it('gives the rest to a building that can start at once before a more valuable or nearer one', () => {
    const waiting = new FakeConsumer('waiting', site(1), 10, false, 500);
    const ready = new FakeConsumer('ready', site(2), 10, true, 5);
    expect(restGoesTo(waiting, ready, { s1: 1, s2: 99 })).toBe('ready');
  });

  it('then prefers the more valuable product, then the nearer building', () => {
    const cheapNear = new FakeConsumer('cheapNear', site(1), 10, true, 5);
    const rich = new FakeConsumer('rich', site(2), 10, true, 50);
    expect(restGoesTo(cheapNear, rich, { s1: 1, s2: 99 })).toBe('rich');

    const far = new FakeConsumer('far', site(3), 10, true, 5);
    const near = new FakeConsumer('near', site(4), 10, true, 5);
    expect(restGoesTo(far, near, { s3: 80, s4: 10 })).toBe('near');
  });

  it('takes turns when more buildings ask than one round can visit', () => {
    const home = new FakeHome(8).stock('lumber', 1000);
    const consumers = Array.from(
      { length: BALANCE.carriers.maxStops + 2 },
      (_, index) => new FakeConsumer(`c${index}`, site(index + 1), 1000, true, 100 - index),
    );
    const planner = dispatcher(home, consumers, {});
    planner.plan(home);
    planner.plan(home);
    for (const consumer of consumers) expect(consumer.reserved.get('lumber') ?? 0, consumer.id).toBeGreaterThan(0);
  });

  it('splits one load over several requests and sells what nobody asked for', () => {
    const home = new FakeHome(10).stock('lumber', 10);
    const first = new FakeConsumer('first', site(1), 3, true, 50);
    const second = new FakeConsumer('second', site(2), 4, true, 20);
    const sale = new FakeConsumer('sale', site(3), 0, false, 0);
    const stops = dispatcher(home, [first, second], { s1: 5, s2: 10, s3: 20 }, sale).plan(home);
    const drops = unloads(stops);
    expect(drops.map((drop) => drop[0])).toEqual(['first', 'second', 'sale']);
    expect(drops[0]![1]).toBeCloseTo(3);
    expect(drops[1]![1]).toBeCloseTo(4);
    expect(drops[2]![1]).toBeCloseTo(3);
    expect(sale.reserved.get('lumber')).toBeCloseTo(3);
  });

  it('never sends waste or raw material to a sale channel', () => {
    const sale = new FakeConsumer('sale', site(3), 0, false, 0);
    const home = new FakeHome(10).stock('slag', 10).stock('wood', 10);
    expect(dispatcher(home, [], {}, sale).plan(home)).toBeNull();
    expect(home.slots[0]!.amount.toNumber()).toBe(10);
  });

  it('does nothing when there is no stock', () => {
    const home = new FakeHome(10);
    expect(dispatcher(home, [], {}).plan(home)).toBeNull();
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
    const carrier = island.inbound.carriers[0]!;
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
          // On the road: gone from the yard, not yet in the building.
          expect(island.inbound.stock.amount('wood').toNumber()).toBe(0);
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
    // Its reservation is settled.
    expect(sawmill.inputs.get('wood')!.incoming.isZero).toBe(true);
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
      const carrier = game.island.inbound.carriers[0]!;
      tickUntil(game, () => carrier.phase === 'travel' && !carrier.cargo.amount(raw).isZero, seconds(120));
      return carrier.legEnd - carrier.legStart;
    };
    expect(trip('ironOre', 'steelMill')).toBeGreaterThan(trip('cotton', 'textileMill'));
  });
});
