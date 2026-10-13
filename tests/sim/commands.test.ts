import { describe, expect, it } from 'vitest';
import { Stat, type GameEvent } from '@/contracts';
import { bn } from '@/core/BigNum';
import { catalog } from '@/content';
import { BALANCE } from '@/content/balance';
import { buildCost, upgradeCost } from '@/sim/upgrades';
import { balanceWith, newGame, seconds, tickUntil } from './helpers';

const RICH = 1e40;

describe('building and upgrading', () => {
  it('charges the build cost, which grows with every building of the same type', () => {
    const game = newGame({ money: 1000 });
    const def = catalog.buildings.textileMill!;
    expect(game.build('p0-0', 'textileMill')).toEqual({ ok: true });
    expect(game.money.toNumber()).toBeCloseTo(1000 - def.buildCost);
    expect(game.build('p0-1', 'textileMill')).toEqual({ ok: true });
    expect(game.money.toNumber()).toBeCloseTo(1000 - def.buildCost - def.buildCost * def.buildCostGrowth);
    const option = game.snapshot().island.buildOptions.find((entry) => entry.typeId === 'textileMill')!;
    expect(option.builtCount).toBe(2);
    expect(option.cost.eq(buildCost(def, 2))).toBe(true);
    expect(game.drainEvents().filter((event) => event.type === 'buildingBuilt')).toHaveLength(2);
  });

  it('rejects builds that break the rules', () => {
    const game = newGame();
    expect(game.build('p0-0', 'textileMill')).toEqual({ ok: false, reason: 'notEnoughMoney' });
    game.grant(RICH);
    expect(game.build('nowhere', 'textileMill')).toEqual({ ok: false, reason: 'notFound' });
    expect(game.build('p0-0', 'noSuchBuilding')).toEqual({ ok: false, reason: 'notFound' });
    expect(game.build('p2-0', 'textileMill')).toEqual({ ok: false, reason: 'plotOccupied' });
    expect(game.build('p0-0', 'furnitureFactory')).toEqual({ ok: false, reason: 'locked' });
    expect(game.island.buildings).toHaveLength(1);
  });

  it('refuses to build past the island limit', () => {
    const base = catalog.islands[catalog.startIsland]!;
    const game = newGame({
      catalog: { ...catalog, islands: { [base.id]: { ...base, maxBuildings: 2 } } },
      money: RICH,
    });
    expect(game.build('p0-0', 'textileMill')).toEqual({ ok: true });
    expect(game.build('p0-1', 'textileMill')).toEqual({ ok: false, reason: 'islandFull' });
  });

  it('caps speed and count tracks and lets amount tracks grow without end', () => {
    const game = newGame({ money: RICH });
    const building = game.island.buildings[0]!;
    const speed = catalog.upgradeTracks['building.speed']!;
    for (let i = 0; i < speed.maxLevel!; i += 1) {
      expect(game.upgradeBuilding(building.id, speed.id)).toEqual({ ok: true });
    }
    expect(game.upgradeBuilding(building.id, speed.id)).toEqual({ ok: false, reason: 'maxLevel' });
    expect(building.stats.number(Stat.cycleSpeed)).toBeCloseTo(1 + speed.effect.perLevel * speed.maxLevel!);

    const carriers = catalog.upgradeTracks['building.carriers']!;
    while (game.upgradeBuilding(building.id, carriers.id).ok);
    expect(building.carriers).toHaveLength(BALANCE.carriers.baseCount + carriers.maxLevel!);

    const level = catalog.upgradeTracks['building.level']!;
    expect(level.maxLevel).toBeNull();
    for (let i = 0; i < 60; i += 1) expect(game.upgradeBuilding(building.id, level.id)).toEqual({ ok: true });
    expect(building.stats.value(Stat.batchSize).log10()).toBeCloseTo(60 * Math.log10(level.effect.perLevel));

    const views = game.snapshot().island.buildings[0]!.upgrades;
    const speedView = views.find((view) => view.trackId === speed.id)!;
    expect(speedView).toMatchObject({ level: speed.maxLevel, maxLevel: speed.maxLevel, cost: null, next: null, affordable: false });
    const levelView = views.find((view) => view.trackId === level.id)!;
    expect(levelView.level).toBe(60);
    expect(levelView.cost!.eq(upgradeCost(level, 60, building.def.upgradeCostScale))).toBe(true);
    expect(levelView.next!.gt(levelView.current)).toBe(true);
  });

  it('pairs every capped track with an uncapped one', () => {
    for (const scope of ['building', 'inbound', 'sale'] as const) {
      const tracks = Object.values(catalog.upgradeTracks).filter((track) => track.scope === scope);
      expect(tracks.some((track) => track.maxLevel !== null), scope).toBe(true);
      expect(tracks.some((track) => track.maxLevel === null), scope).toBe(true);
    }
  });

  it('rejects upgrades that cannot be bought', () => {
    const game = newGame();
    const building = game.island.buildings[0]!;
    expect(game.upgradeBuilding(building.id, 'building.level')).toEqual({ ok: false, reason: 'notEnoughMoney' });
    expect(game.upgradeBuilding('nobody', 'building.level')).toEqual({ ok: false, reason: 'notFound' });
    expect(game.upgradeBuilding(building.id, 'sale.load')).toEqual({ ok: false, reason: 'notFound' });
    expect(game.upgradeChannel('sale.truck', 'sale.load')).toEqual({ ok: false, reason: 'notEnoughMoney' });
    expect(game.upgradeChannel('sale.nowhere', 'sale.load')).toEqual({ ok: false, reason: 'notFound' });
    expect(game.upgradeGlobal('global.price')).toEqual({ ok: false, reason: 'notEnoughMoney' });
    expect(game.upgradeGlobal('building.level')).toEqual({ ok: false, reason: 'notFound' });
    game.grant(RICH);
    expect(game.upgradeChannel('sale.ship', 'sale.load')).toEqual({ ok: false, reason: 'locked' });
    expect(game.drainEvents()).toEqual([]);
  });

  it('upgrades channels and the game-wide price', () => {
    const game = newGame({ money: RICH });
    const island = game.island;
    const truck = island.channel('sale.truck')!;
    const load = catalog.upgradeTracks['sale.load']!;
    const before = truck.stats.value(Stat.load);
    expect(game.upgradeChannel('sale.truck', load.id)).toEqual({ ok: true });
    expect(truck.stats.value(Stat.load).toNumber()).toBeCloseTo(before.toNumber() * load.effect.perLevel);

    // A sale channel has carriers of its own, with their own upgrades.
    const fleet = island.sales[0]!;
    expect(fleet.carriers).toHaveLength(BALANCE.saleCarriers.baseCount);
    expect(game.upgradeChannel('sale.truck', 'sale.carriers')).toEqual({ ok: true });
    expect(fleet.carriers).toHaveLength(BALANCE.saleCarriers.baseCount + 1);
    const carrierLoad = catalog.upgradeTracks['sale.carrierLoad']!;
    expect(game.upgradeChannel('sale.truck', carrierLoad.id)).toEqual({ ok: true });
    expect(fleet.carrierCapacity().toNumber()).toBeCloseTo(BALANCE.saleCarriers.baseLoad * carrierLoad.effect.perLevel);

    const interval = catalog.upgradeTracks['inbound.interval']!;
    expect(game.upgradeChannel('inbound.truck', interval.id)).toEqual({ ok: true });
    expect(island.inbound.stats.number(Stat.interval)).toBeLessThan(catalog.inboundChannels['inbound.truck']!.baseIntervalSec);
    while (game.upgradeChannel('inbound.truck', interval.id).ok);
    expect(island.inbound.levels.get(interval.id)).toBe(interval.maxLevel);

    const price = catalog.upgradeTracks['global.price']!;
    expect(game.priceMultiplier().toNumber()).toBe(1);
    expect(game.upgradeGlobal(price.id)).toEqual({ ok: true });
    expect(game.priceMultiplier().toNumber()).toBeCloseTo(price.effect.perLevel);
    expect(game.snapshot().globalUpgrades[0]).toMatchObject({ trackId: price.id, level: 1 });

    const upgraded = game.drainEvents().filter((event): event is Extract<GameEvent, { type: 'upgraded' }> => event.type === 'upgraded');
    expect(upgraded[0]).toEqual({ type: 'upgraded', scope: 'sale', targetId: 'sale.truck', trackId: load.id, level: 1 });
    expect(upgraded.at(-1)).toEqual({ type: 'upgraded', scope: 'global', targetId: null, trackId: price.id, level: 1 });
    expect(upgraded.some((event) => event.scope === 'inbound')).toBe(true);
  });

  it('sells for more after a price upgrade', () => {
    const firstSale = (upgrade: boolean): number => {
      const game = newGame({ balance: balanceWith({ specialCargo: { minIntervalSec: 1e7, maxIntervalSec: 1e7 } }) });
      if (upgrade) {
        game.grant(catalog.upgradeTracks['global.price']!.baseCost);
        expect(game.upgradeGlobal('global.price')).toEqual({ ok: true });
      }
      expect(game.money.isZero).toBe(true);
      tickUntil(game, () => !game.money.isZero, seconds(300));
      return game.money.toNumber();
    };
    expect(firstSale(true)).toBeCloseTo(firstSale(false) * catalog.upgradeTracks['global.price']!.effect.perLevel);
  });
});

describe('unlocks', () => {
  it('opens building types and channels for money, in order', () => {
    const game = newGame();
    const snapshot = game.snapshot();
    expect(snapshot.unlocks).toHaveLength(Object.keys(catalog.unlocks).length);
    expect(snapshot.unlocks.every((unlock) => !unlock.unlocked && !unlock.affordable)).toBe(true);
    expect(snapshot.unlocks.find((unlock) => unlock.id === 'unlock.channel.plane')!.available).toBe(false);
    expect(snapshot.island.facilities.find((facility) => facility.id === 'dock')).toMatchObject({ unlocked: false, nextArrivalSec: null });

    expect(game.unlock('unlock.building.furnitureFactory')).toEqual({ ok: false, reason: 'notEnoughMoney' });
    expect(game.unlock('unlock.nothing')).toEqual({ ok: false, reason: 'notFound' });
    game.grant(1e11);
    expect(game.unlock('unlock.channel.plane')).toEqual({ ok: false, reason: 'requirementsNotMet' });
    expect(game.unlock('unlock.channel.ship')).toEqual({ ok: true });
    expect(game.unlock('unlock.channel.ship')).toEqual({ ok: false, reason: 'alreadyUnlocked' });
    expect(game.unlock('unlock.channel.plane')).toEqual({ ok: true });

    const before = game.money;
    expect(game.unlock('unlock.building.furnitureFactory')).toEqual({ ok: true });
    expect(before.sub(game.money).toNumber()).toBeCloseTo(catalog.unlocks['unlock.building.furnitureFactory']!.cost);
    expect(game.build('p0-0', 'furnitureFactory')).toEqual({ ok: true });
    expect(game.upgradeChannel('sale.ship', 'sale.load')).toEqual({ ok: true });

    const after = game.snapshot();
    expect(after.unlocks.filter((unlock) => unlock.unlocked).map((unlock) => unlock.id).sort()).toEqual([
      'unlock.building.furnitureFactory',
      'unlock.channel.plane',
      'unlock.channel.ship',
    ]);
    expect(after.island.facilities.find((facility) => facility.id === 'dock')!.unlocked).toBe(true);
    expect(after.island.buildOptions.find((option) => option.typeId === 'furnitureFactory')!.unlocked).toBe(true);
    expect(game.drainEvents().filter((event) => event.type === 'unlocked')).toHaveLength(3);
  });

  it('starts using a newly unlocked sale channel', () => {
    const game = newGame({ money: RICH });
    game.unlock('unlock.channel.ship');
    game.drainEvents();
    let shipSale = false;
    tickUntil(
      game,
      () => {
        for (const event of game.drainEvents()) if (event.type === 'sale' && event.channelId === 'sale.ship') shipSale = true;
        return shipSale;
      },
      seconds(600),
    );
    expect(game.snapshot().island.vehicles.every((vehicle) => Number.isFinite(vehicle.x + vehicle.y + vehicle.z))).toBe(true);
  });
});

describe('demolishing', () => {
  it('refunds half of everything spent on the building and frees the plot', () => {
    const game = newGame({ money: 1e9 });
    const start = game.money;
    expect(game.build('p0-0', 'textileMill')).toEqual({ ok: true });
    const building = game.island.buildingAt('p0-0')!;
    for (const track of ['building.level', 'building.level', 'building.speed', 'building.carriers', 'building.carrierLoad']) {
      expect(game.upgradeBuilding(building.id, track)).toEqual({ ok: true });
    }
    const spent = start.sub(game.money);
    const scale = building.def.upgradeCostScale;
    const tracks = catalog.upgradeTracks;
    const expected =
      building.def.buildCost +
      upgradeCost(tracks['building.level']!, 0, scale).toNumber() +
      upgradeCost(tracks['building.level']!, 1, scale).toNumber() +
      upgradeCost(tracks['building.speed']!, 0, scale).toNumber() +
      upgradeCost(tracks['building.carriers']!, 0, scale).toNumber() +
      upgradeCost(tracks['building.carrierLoad']!, 0, scale).toNumber();
    expect(spent.toNumber()).toBeCloseTo(expected);
    expect(building.invested.toNumber()).toBeCloseTo(expected);
    const view = game.snapshot().island.buildings.find((entry) => entry.id === building.id)!;
    expect(view.refund.toNumber()).toBeCloseTo(expected / 2);

    game.drainEvents();
    const before = game.money;
    const earned = game.totalEarned;
    expect(game.demolish(building.id)).toEqual({ ok: true });
    expect(game.money.sub(before).toNumber()).toBeCloseTo(expected / 2);
    // A refund is not income.
    expect(game.totalEarned.eq(earned)).toBe(true);
    const [event] = game.drainEvents();
    expect(event).toMatchObject({ type: 'buildingDemolished', buildingId: building.id, plotId: 'p0-0' });
    expect((event as Extract<GameEvent, { type: 'buildingDemolished' }>).refund.toNumber()).toBeCloseTo(expected / 2);
    expect(game.island.buildingAt('p0-0')).toBeUndefined();
    expect(game.snapshot().island.plots.find((plot) => plot.id === 'p0-0')!.buildingId).toBeNull();
    expect(game.demolish(building.id)).toEqual({ ok: false, reason: 'notFound' });
    // The plot can be used again and the next one costs as if the first never existed.
    expect(game.build('p0-0', 'textileMill')).toEqual({ ok: true });
    expect(game.island.buildingAt('p0-0')!.invested.toNumber()).toBeCloseTo(building.def.buildCost);
  });

  it('keeps running when a building disappears while vehicles are on their way to it', () => {
    const game = newGame({ money: 1e6 });
    game.unlock('unlock.building.furnitureFactory');
    game.build('p2-1', 'textileMill');
    game.build('p2-2', 'furnitureFactory');
    const factory = game.island.buildingAt('p2-2')!;
    // Wait until something is driving to the factory, then pull it down.
    tickUntil(
      game,
      () => game.island.homes.some((home) => home.carriers.some((carrier) => carrier.phase === 'travel' && carrier.to === factory.site.index)),
      seconds(300),
    );
    expect(game.demolish(factory.id)).toEqual({ ok: true });
    game.tick(seconds(120));
    game.demolish(game.island.buildingAt('p2-0')!.id);
    game.tick(seconds(120));
    const snapshot = game.snapshot();
    expect(snapshot.island.buildings).toHaveLength(1);
    // No carrier is left with a stop at a building that is gone forever.
    for (const home of game.island.homes) {
      for (const carrier of home.carriers) {
        if (carrier.isIdle) expect(carrier.cargo.isEmpty).toBe(true);
      }
    }
    expect(game.money.gte(bn(0))).toBe(true);
  });
});
