import { describe, expect, it } from 'vitest';
import type { GameEvent, SaveData } from '@/contracts';
import { catalog } from '@/content';
import { CURRENT_SAVE_VERSION, isSaveData, migrate } from '@/save/migrations';
import { createGame, SAVE_VERSION, type Game } from '@/sim';
import { balanceWith, catalogWith, newGame, SECOND_ISLAND, seconds, START_ISLAND, stored, tickUntil, twoIslandCatalog } from './helpers';

const drain = <T extends GameEvent['type']>(game: Game, type: T): Array<Extract<GameEvent, { type: T }>> =>
  game.drainEvents().filter((event): event is Extract<GameEvent, { type: T }> => event.type === type);

describe('auto mode', () => {
  it('saves up and buys buildings and upgrades on its own', () => {
    const game = newGame();
    game.setAutoPilot(true);
    expect(game.snapshot().autoPilot).toMatchObject({ enabled: true });
    const events: GameEvent[] = [];
    let sawTarget = false;
    for (let minute = 0; minute < 30; minute += 1) {
      game.tick(seconds(60));
      events.push(...game.drainEvents());
      const view = game.snapshot().autoPilot;
      if (view.target) {
        sawTarget = true;
        expect(view.target.key.startsWith('auto.target.')).toBe(true);
        expect(view.targetCost).not.toBeNull();
      }
    }
    expect(sawTarget).toBe(true);
    expect(events.some((event) => event.type === 'buildingBuilt')).toBe(true);
    expect(events.some((event) => event.type === 'upgraded')).toBe(true);
    expect(game.island.buildings.length).toBeGreaterThan(1);
    expect(game.totalEarned.toNumber()).toBeGreaterThan(0);
  });

  it('always goes for the cheapest thing on offer', () => {
    const game = newGame();
    game.setAutoPilot(true);
    for (let second = 0; second < 600; second += 1) {
      game.tick(seconds(1));
      const snapshot = game.snapshot();
      const target = snapshot.autoPilot.targetCost;
      if (!target) continue;
      // Nothing the player could buy is cheaper than what auto mode is saving for.
      const offers = [
        ...snapshot.unlocks.filter((unlock) => !unlock.unlocked && unlock.available).map((unlock) => unlock.cost),
        ...snapshot.island.buildings.flatMap((building) => building.upgrades.map((upgrade) => upgrade.cost)),
        ...snapshot.globalUpgrades.map((upgrade) => upgrade.cost),
      ];
      for (const cost of offers) if (cost) expect(cost.gte(target)).toBe(true);
    }
  });

  it('does nothing while switched off', () => {
    const game = newGame({ money: 1e9 });
    game.tick(seconds(120));
    expect(game.island.buildings).toHaveLength(1);
    expect(game.snapshot().autoPilot).toEqual({ enabled: false, target: null, targetCost: null });
    expect(game.drainEvents().some((event) => event.type === 'upgraded' || event.type === 'buildingBuilt')).toBe(false);
  });

  it('keeps a free plot for every building type it has not built yet', () => {
    // Four building slots, four types, one of them locked: no room for a second copy of anything.
    const game = newGame({
      catalog: catalogWith({ maxBuildings: 4, buildingTypes: ['sawmill', 'textileMill', 'flourMill', 'wasteDisposal'] }),
      money: 1e7,
      seed: 5,
    });
    game.setAutoPilot(true);
    const island = game.island;
    for (let second = 0; second < 1200; second += 1) {
      game.tick(seconds(1));
      for (const event of game.drainEvents()) {
        if (event.type === 'buildingBuilt') expect(island.freeSlots).toBeGreaterThanOrEqual(island.unbuiltTypeCount());
      }
    }
    expect(island.buildings.map((building) => building.def.id).sort()).toEqual(['flourMill', 'sawmill', 'textileMill', 'wasteDisposal']);
    expect(island.isFull).toBe(true);
  });

  it('builds duplicates only in plots that are to spare', () => {
    // Five slots and four types: exactly one duplicate fits.
    const game = newGame({
      catalog: catalogWith({ maxBuildings: 5, buildingTypes: ['sawmill', 'textileMill', 'flourMill', 'glassworks'] }),
      money: 1e7,
      seed: 9,
    });
    game.setAutoPilot(true);
    game.tick(seconds(1200));
    const types = game.island.buildings.map((building) => building.def.id);
    expect(types).toHaveLength(5);
    expect(new Set(types).size).toBe(4);
  });
});

describe('special cargo', () => {
  const balance = balanceWith({ specialCargo: { minIntervalSec: 5, maxIntervalSec: 10, lifetimeSec: 6, rewardSeconds: 45, minReward: 10 } });

  it('appears, pays a number of seconds of income when clicked, and comes back later', () => {
    const game = newGame({ balance });
    expect(game.snapshot().island.specialCargo).toBeNull();
    let spawned: string | null = null;
    const waited = tickUntil(
      game,
      () => {
        spawned = drain(game, 'specialCargoSpawned')[0]?.id ?? null;
        return spawned !== null;
      },
      seconds(11),
    );
    expect(waited).toBeGreaterThanOrEqual(seconds(5));
    const view = game.snapshot().island.specialCargo!;
    expect(view.id).toBe(spawned);
    expect(view.expiresInSec).toBeCloseTo(6);
    const bounds = catalog.islands[START_ISLAND]!.layout.bounds;
    expect(view.x).toBeGreaterThanOrEqual(bounds.minX);
    expect(view.x).toBeLessThanOrEqual(bounds.maxX);
    // No income yet, so the floor applies.
    expect(view.reward.toNumber()).toBe(10);

    expect(game.collectSpecialCargo('someone-else')).toEqual({ ok: false, reason: 'notFound' });
    const before = game.money;
    expect(game.collectSpecialCargo(view.id)).toEqual({ ok: true });
    expect(game.money.sub(before).toNumber()).toBeCloseTo(10);
    expect(drain(game, 'specialCargoCollected')[0]).toMatchObject({ id: view.id });
    expect(game.snapshot().island.specialCargo).toBeNull();
    expect(game.collectSpecialCargo(view.id)).toEqual({ ok: false, reason: 'notFound' });

    tickUntil(game, () => game.snapshot().island.specialCargo !== null, seconds(11));
    expect(game.snapshot().island.specialCargo!.id).not.toBe(view.id);
  });

  it('is worth the configured seconds of current income', () => {
    const game = newGame({ balance });
    game.setAutoPilot(true);
    game.tick(seconds(900));
    tickUntil(game, () => game.snapshot().island.specialCargo !== null, seconds(20));
    const snapshot = game.snapshot();
    expect(snapshot.incomePerSec.toNumber()).toBeGreaterThan(0);
    const reward = snapshot.island.specialCargo!.reward;
    expect(reward.toNumber()).toBeCloseTo(snapshot.incomePerSec.toNumber() * 45);
    const before = game.totalEarned;
    game.collectSpecialCargo(snapshot.island.specialCargo!.id);
    expect(game.totalEarned.sub(before).toNumber()).toBeCloseTo(reward.toNumber());
  });

  it('disappears when nobody clicks it', () => {
    const game = newGame({ balance });
    tickUntil(game, () => game.snapshot().island.specialCargo !== null, seconds(11));
    const id = game.snapshot().island.specialCargo!.id;
    game.tick(seconds(6));
    expect(game.snapshot().island.specialCargo).toBeNull();
    expect(game.collectSpecialCargo(id)).toEqual({ ok: false, reason: 'notFound' });
    expect(game.money.isZero).toBe(true);
  });
});

describe('islands', () => {
  it('estimates income on a copy without touching the island', () => {
    const game = newGame();
    game.tick(seconds(300));
    const island = game.island;
    const before = JSON.stringify(island.toJSON());
    const money = game.money;
    const estimate = island.estimateIncome(300, 20);
    expect(estimate.toNumber()).toBeGreaterThan(0);
    expect(JSON.stringify(island.toJSON())).toBe(before);
    expect(game.money.eq(money)).toBe(true);
    expect(game.drainEvents().every((event) => event.type !== 'sale' || event.amount.lte(money))).toBe(true);
  });

  it('freezes the island being left, pays its estimated income and resumes on return', () => {
    const game = newGame({ catalog: twoIslandCatalog(), balance: balanceWith({ specialCargo: { minIntervalSec: 1e7, maxIntervalSec: 1e7 } }) });
    expect(game.snapshot().islands.map((entry) => [entry.id, entry.active])).toEqual([
      [START_ISLAND, true],
      [SECOND_ISLAND, false],
    ]);
    game.tick(seconds(300));
    const home = game.island;
    const frozenTick = home.tickCount;
    const { estimated: _before, ...frozen } = home.toJSON() as Record<string, unknown>;

    expect(game.switchIsland('island.nowhere')).toEqual({ ok: false, reason: 'notFound' });
    game.drainEvents();
    expect(game.switchIsland(SECOND_ISLAND)).toEqual({ ok: true });
    expect(drain(game, 'islandSwitched')).toEqual([{ type: 'islandSwitched', islandId: SECOND_ISLAND }]);
    expect(game.island.id).toBe(SECOND_ISLAND);
    const snapshot = game.snapshot();
    expect(snapshot.island.id).toBe(SECOND_ISLAND);
    expect(snapshot.island.buildings.map((building) => building.typeId)).toEqual(['textileMill']);
    const estimate = snapshot.islands.find((entry) => entry.id === START_ISLAND)!.estimatedIncomePerSec;
    expect(estimate.toNumber()).toBeGreaterThan(0);
    // Money is shared: what was earned on the first island is still there.
    expect(snapshot.money.toNumber()).toBeGreaterThan(0);

    // Away for a short while, before the second island has sold anything: only the estimate comes in.
    const money = game.money;
    game.tick(seconds(10));
    expect(drain(game, 'sale')).toEqual([]);
    expect(game.money.sub(money).toNumber()).toBeCloseTo(estimate.toNumber() * 10);

    game.tick(seconds(290));
    expect(home.tickCount).toBe(frozenTick);
    const { estimated: _after, ...still } = home.toJSON() as Record<string, unknown>;
    expect(still).toEqual(frozen);
    expect(game.island.tickCount).toBe(seconds(300));

    // Commands act on the island being watched.
    game.grant(1000);
    expect(game.build('p1-1', 'sawmill')).toEqual({ ok: false, reason: 'notFound' });
    expect(game.build('p1-1', 'flourMill')).toEqual({ ok: true });
    expect(home.buildings).toHaveLength(1);

    expect(game.switchIsland(START_ISLAND)).toEqual({ ok: true });
    const away = game.snapshot().islands.find((entry) => entry.id === SECOND_ISLAND)!;
    expect(away.active).toBe(false);
    expect(away.estimatedIncomePerSec.toNumber()).toBeGreaterThan(0);
    game.tick(seconds(60));
    expect(home.tickCount).toBe(frozenTick + seconds(60));
    expect(game.snapshot().island.buildings.map((building) => building.typeId)).toEqual(['sawmill']);
  });

  it('does not run auto mode on an island that is not being watched', () => {
    const game = newGame({ catalog: twoIslandCatalog(), money: 1e6 });
    game.setAutoPilot(true);
    game.switchIsland(SECOND_ISLAND);
    const home = game.islands.islands.get(START_ISLAND)!;
    game.tick(seconds(300));
    expect(home.buildings).toHaveLength(1);
    expect(game.island.buildings.length).toBeGreaterThan(1);
  });
});

describe('saving', () => {
  const stateOf = (game: Game): unknown => stored(game.serialize().state);

  it('writes a save the storage layer accepts', () => {
    const game = newGame({ money: 123 });
    game.tick(seconds(30));
    const save = game.serialize();
    expect(SAVE_VERSION).toBe(CURRENT_SAVE_VERSION);
    expect(save.version).toBe(CURRENT_SAVE_VERSION);
    expect(isSaveData(stored(save))).toBe(true);
    expect(migrate(stored(save))).toEqual(stored(save));
    expect(save.summary).toEqual({ money: game.money.toString(), buildings: 1, playSeconds: 30 });
    // Content is stored by its stable id.
    const text = JSON.stringify(save.state);
    expect(text).toContain('"type":"sawmill"');
    expect(text).toContain('"plot":"p2-0"');
  });

  it('moves buildings whose plot no longer exists to a free plot when loading', () => {
    const original = createGame({ catalog, seed: 5 });
    original.grant(1e6);
    original.setAutoPilot(true);
    original.tick(seconds(300));
    const before = original.snapshot().island.buildings;
    expect(before.length).toBeGreaterThan(2);

    // A save written on the older, wider layout names a column that is gone now.
    const gone = before[0]!.plotId;
    const save: SaveData = JSON.parse(JSON.stringify(stored(original.serialize())).split(`"plot":"${gone}"`).join('"plot":"p0-7"'));
    const loaded = createGame({ catalog, save, seed: 5 });
    const after = loaded.snapshot().island.buildings;
    expect(after.map((building) => building.id).sort()).toEqual(before.map((building) => building.id).sort());
    expect(new Set(after.map((building) => building.plotId)).size).toBe(after.length);
    loaded.tick(seconds(120));
    expect(loaded.snapshot().island.buildings.length).toBeGreaterThanOrEqual(after.length);
  });

  it('shows an income that does not jump when a sale lands or slide much between sales', () => {
    const game = createGame({ catalog, seed: 3 });
    game.grant(1e6);
    game.setAutoPilot(true);
    game.tick(seconds(1200));
    let previous = game.snapshot().incomePerSec.toNumber();
    let largestStep = 0;
    for (let second = 0; second < 300; second += 1) {
      game.tick(seconds(1));
      const now = game.snapshot().incomePerSec.toNumber();
      largestStep = Math.max(largestStep, Math.abs(now - previous) / Math.max(previous, 1e-9));
      previous = now;
    }
    expect(previous).toBeGreaterThan(0);
    expect(largestStep).toBeLessThan(0.03);
  });

  it('auto mode builds near the truck yard first', () => {
    const game = createGame({ catalog, seed: 8 });
    game.grant(1e4);
    game.setAutoPilot(true);
    game.tick(seconds(120));
    const island = game.snapshot().island;
    const layout = catalog.islands[catalog.startIsland]!.layout;
    const yard = layout.facilities.find((facility) => facility.kind === 'truckYard')!;
    const built = island.buildings.slice(1);
    expect(built.length).toBeGreaterThan(3);
    // West end of the island, where the yards are.
    for (const building of built) {
      const plot = layout.plots.find((candidate) => candidate.id === building.plotId)!;
      expect(Math.abs(plot.x - yard.x), building.plotId).toBeLessThan(80);
    }
  });

  it('moves a building to a free plot and swaps two buildings, and keeps running', () => {
    const game = createGame({ catalog, seed: 6 });
    game.grant(1e6);
    game.setAutoPilot(true);
    game.tick(seconds(400));
    game.setAutoPilot(false);
    const before = game.snapshot().island;
    const [first, second] = before.buildings;
    const free = before.plots.find((plot) => plot.buildingId === null)!.id;
    const earned = game.snapshot().totalEarned;

    expect(game.moveBuilding(first!.id, free)).toEqual({ ok: true });
    expect(game.moveBuilding(second!.id, free)).toEqual({ ok: true });
    expect(game.moveBuilding('nope', free)).toEqual({ ok: false, reason: 'notFound' });
    const after = game.snapshot().island;
    const plotOf = (id: string): string => after.buildings.find((building) => building.id === id)!.plotId;
    // The second took the free plot, so the first was pushed to where the second stood.
    expect(plotOf(second!.id)).toBe(free);
    expect(plotOf(first!.id)).toBe(second!.plotId);
    expect(after.plots.find((plot) => plot.id === first!.plotId)!.buildingId).toBeNull();
    expect(after.buildings).toHaveLength(before.buildings.length);

    game.tick(seconds(600));
    expect(game.snapshot().totalEarned.gt(earned)).toBe(true);
    const loaded = createGame({ catalog, save: stored(game.serialize()), seed: 6 });
    expect(loaded.snapshot().island.buildings.find((building) => building.id === second!.id)!.plotId).toBe(free);
  });

  it('restores an equivalent game that then plays on identically', () => {
    const balance = balanceWith({ specialCargo: { minIntervalSec: 20, maxIntervalSec: 60, lifetimeSec: 30 } });
    const original = createGame({ catalog, seed: 11, balance });
    original.grant(5e5);
    original.setAutoPilot(true);
    original.setSpeed(2);
    original.unlock('unlock.building.wasteDisposal');
    original.unlock('unlock.building.furnitureFactory');
    original.upgradeGlobal('global.price');
    // Stop at an awkward moment: vehicles on the road, cycles half done, a goal being saved for.
    original.tick(seconds(900) + 7);

    const save: SaveData = stored(original.serialize());
    const loaded = createGame({ catalog, balance, save, seed: 999 });
    expect(stateOf(loaded)).toEqual(save.state);

    const a = original.snapshot();
    const b = loaded.snapshot();
    expect(b.tick).toBe(a.tick);
    expect(b.speed).toBe(2);
    expect(b.money.eq(a.money)).toBe(true);
    expect(b.totalEarned.eq(a.totalEarned)).toBe(true);
    expect(b.incomePerSec.eq(a.incomePerSec)).toBe(true);
    expect(b.autoPilot).toMatchObject({ enabled: true });
    expect(stored(b.unlocks)).toEqual(stored(a.unlocks));
    expect(stored(b.globalUpgrades)).toEqual(stored(a.globalUpgrades));
    expect(stored(b.island.buildings)).toEqual(stored(a.island.buildings));
    expect(stored(b.island.facilities)).toEqual(stored(a.island.facilities));
    expect(stored(b.island.plots)).toEqual(stored(a.island.plots));
    expect(stored(b.island.buildOptions)).toEqual(stored(a.island.buildOptions));
    expect(b.island.vehicles.length).toBeGreaterThan(3);
    expect(b.island.vehicles.map((vehicle) => [vehicle.id, vehicle.state, stored(vehicle.cargo)])).toEqual(
      a.island.vehicles.map((vehicle) => [vehicle.id, vehicle.state, stored(vehicle.cargo)]),
    );
    b.island.vehicles.forEach((vehicle, index) => {
      expect(vehicle.x).toBeCloseTo(a.island.vehicles[index]!.x);
      expect(vehicle.z).toBeCloseTo(a.island.vehicles[index]!.z);
    });

    for (let round = 0; round < 6; round += 1) {
      original.tick(seconds(300));
      loaded.tick(seconds(300));
      expect(stateOf(loaded)).toEqual(stateOf(original));
    }
    expect(stored(loaded.drainEvents().slice(-50))).toEqual(stored(original.drainEvents().slice(-50)));
  });

  it('round-trips a game with a second island and an island left behind', () => {
    const twoIslands = twoIslandCatalog();
    const original = newGame({ catalog: twoIslands, money: 1e5, seed: 3 });
    original.setAutoPilot(true);
    original.tick(seconds(200));
    original.switchIsland(SECOND_ISLAND);
    original.tick(seconds(200) + 3);
    const save = stored(original.serialize());
    const loaded = createGame({ catalog: twoIslands, save });
    expect(loaded.island.id).toBe(SECOND_ISLAND);
    expect(stateOf(loaded)).toEqual(save.state);
    original.tick(seconds(400));
    loaded.tick(seconds(400));
    expect(stateOf(loaded)).toEqual(stateOf(original));
    original.switchIsland(START_ISLAND);
    loaded.switchIsland(START_ISLAND);
    original.tick(seconds(100));
    loaded.tick(seconds(100));
    expect(stateOf(loaded)).toEqual(stateOf(original));
  });

  it('skips content that no longer exists instead of failing', () => {
    const game = newGame({ money: 1e6 });
    game.build('p0-0', 'textileMill');
    game.build('p0-1', 'flourMill');
    game.tick(seconds(120));
    const save = stored(game.serialize());
    const { textileMill: _gone, ...buildings } = catalog.buildings;
    const smaller = { ...catalog, buildings };
    const loaded = createGame({ catalog: smaller, save });
    expect(loaded.island.buildings.map((building) => building.def.id).sort()).toEqual(['flourMill', 'sawmill']);
    expect(() => loaded.tick(seconds(300))).not.toThrow();
  });

  it('refuses a save of another format version', () => {
    const save = { ...stored(newGame().serialize()), version: SAVE_VERSION + 1 };
    expect(() => createGame({ catalog, save })).toThrow(/version/);
  });
});

describe('determinism', () => {
  const play = (seed: number): Game => {
    const game = newGame({ seed });
    game.setAutoPilot(true);
    game.tick(seconds(1800));
    return game;
  };

  it('plays out the same way for the same seed', () => {
    const first = play(42);
    const second = play(42);
    expect(stored(second.serialize().state)).toEqual(stored(first.serialize().state));
    expect(first.island.buildings.length).toBeGreaterThan(1);
  });

  it('plays out differently for another seed', () => {
    expect(stored(play(43).serialize().state)).not.toEqual(stored(play(42).serialize().state));
  });
});

describe('long run', () => {
  it('never lets stock or money go negative and keeps the vehicle count bounded', () => {
    const game = newGame({ seed: 2, money: 1e7 });
    game.setAutoPilot(true);
    game.unlock('unlock.building.wasteDisposal');
    let previousEarned = game.totalEarned;
    for (let step = 0; step < 240; step += 1) {
      game.tick(seconds(30));
      expect(game.money.sign).toBeGreaterThanOrEqual(0);
      expect(game.totalEarned.gte(previousEarned)).toBe(true);
      previousEarned = game.totalEarned;
      const island = game.island;
      const inventories = [
        island.inbound.stock,
        ...island.sales.map((channel) => channel.stock),
        ...island.buildings.flatMap((building) => [building.inputs, building.outputs, building.waste]),
      ];
      for (const inventory of inventories) {
        for (const slot of inventory.list) {
          expect(slot.amount.sign, slot.item).toBeGreaterThanOrEqual(0);
          expect(slot.incoming.sign, slot.item).toBeGreaterThanOrEqual(0);
          expect(slot.reserved.sign, slot.item).toBeGreaterThanOrEqual(0);
        }
      }
      if (step % 20 === 0) {
        const snapshot = game.snapshot();
        // 48 buildings with up to 3 carriers each, plus the sale channels' carriers and the visiting vehicles.
        expect(snapshot.island.vehicles.length).toBeLessThanOrEqual(180);
        for (const vehicle of snapshot.island.vehicles) {
          expect(Number.isFinite(vehicle.x + vehicle.y + vehicle.z + vehicle.heading), vehicle.id).toBe(true);
          expect(vehicle.loadRatio).toBeGreaterThanOrEqual(0);
          expect(vehicle.loadRatio).toBeLessThanOrEqual(1);
        }
        for (const building of snapshot.island.buildings) {
          expect(building.progress).toBeGreaterThanOrEqual(0);
          expect(building.progress).toBeLessThanOrEqual(1);
        }
      }
    }
    expect(game.island.buildings.length).toBeGreaterThan(5);
  });

  it('does not leave goods stranded on the way: deliveries promised to a building always arrive or are released', () => {
    const game = newGame({ seed: 4, money: 1e6 });
    game.setAutoPilot(true);
    game.tick(seconds(1800));
    game.setAutoPilot(false);
    // With nothing new being bought, every reservation must be backed by a vehicle that is actually under way.
    const island = game.island;
    const promised = new Map<string, number>();
    for (const home of island.homes) {
      for (const carrier of home.carriers) {
        for (let i = carrier.stopIndex; i < carrier.stops.length; i += 1) {
          const stop = carrier.stops[i]!;
          if (stop.action !== 'unload') continue;
          for (const entry of stop.items) {
            const key = `${stop.node}/${entry.item}`;
            promised.set(key, (promised.get(key) ?? 0) + entry.amount.toNumber());
          }
        }
      }
    }
    for (const building of island.buildings) {
      for (const slot of building.inputs.list) {
        const expected = promised.get(`${building.id}/${slot.item}`) ?? 0;
        expect(slot.incoming.toNumber(), `${building.id}/${slot.item}`).toBeCloseTo(expected, 4);
      }
    }
  });
});
