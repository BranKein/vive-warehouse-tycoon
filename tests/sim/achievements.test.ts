import { describe, expect, it } from 'vitest';
import { catalog } from '@/content';
import { BALANCE } from '@/content/balance';
import { en } from '@/i18n/en';
import { ko } from '@/i18n/ko';
import { migrate } from '@/save/migrations';
import { createGame, type Game } from '@/sim';
import { Achievements } from '@/sim/Achievements';
import { bn } from '@/core/BigNum';
import type { GameEvent } from '@/contracts';
import { newGame, seconds, stored } from './helpers';

/** Builds tier-1 buildings on free plots until `count` stand. */
function buildUpTo(game: Game, count: number): void {
  game.grant(1e9);
  const types = ['sawmill', 'steelMill', 'textileMill', 'flourMill'];
  for (const plot of game.snapshot().island.plots) {
    if (game.island.buildings.length >= count) return;
    if (plot.buildingId) continue;
    for (const type of types) if (game.build(plot.id, type).ok) break;
  }
}

const achieved = (game: Game): string[] =>
  game.snapshot().achievements.list.filter((entry) => entry.achievedAtSec !== null).map((entry) => entry.id);

describe('achievement content', () => {
  it('has unique ids, reachable goals and text in both languages', () => {
    const ids = catalog.achievements.map((def) => def.id);
    expect(new Set(ids).size).toBe(ids.length);
    const unlockCount = Object.keys(catalog.unlocks).length;
    const plots = catalog.islands[catalog.startIsland]!.maxBuildings;
    for (const def of catalog.achievements) {
      if (def.metric.kind === 'unlocks') expect(def.goal).toBeLessThanOrEqual(unlockCount);
      if (def.metric.kind === 'buildings') expect(def.goal).toBeLessThanOrEqual(plots);
      for (const table of [en, ko] as Array<Record<string, string>>) {
        expect(table[`achievement.${def.id}.name`], def.id).toBeTruthy();
        expect(table[`achievement.${def.id}.desc`], def.id).toBeTruthy();
      }
    }
  });
});

describe('achievements', () => {
  it('are reached from the state, raise an event and add to sale prices', () => {
    const game = newGame();
    const before = game.priceMultiplier().toNumber();
    buildUpTo(game, 10);
    game.drainEvents();
    game.tick(seconds(1));
    const events = game.drainEvents().filter((event) => event.type === 'achievementUnlocked');
    expect(events.map((event) => (event as Extract<GameEvent, { type: 'achievementUnlocked' }>).achievementId)).toContain(
      'buildings.1',
    );
    const count = game.achievements.count;
    expect(count).toBeGreaterThan(0);
    expect(game.priceMultiplier().toNumber()).toBeCloseTo(before * (1 + count * BALANCE.achievements.saleBonusEach));
    expect(game.snapshot().achievements.saleBonus).toBeCloseTo(count * BALANCE.achievements.saleBonusEach);
  });

  it('count sales by channel and special cargo from events', () => {
    const events: GameEvent[] = [];
    const defs = catalog.achievements.filter((def) => def.id === 'firstShipSale' || def.id === 'specialCargo.1');
    const tracker = new Achievements(defs, { measure: () => bn(0), playSeconds: () => 42, emit: (e) => events.push(e) });
    tracker.observe({ type: 'sale', channelId: 'sale.truck', amount: bn(5), x: 0, z: 0 });
    tracker.check();
    expect(tracker.count).toBe(0);
    tracker.observe({ type: 'sale', channelId: 'sale.ship', amount: bn(5), x: 0, z: 0 });
    for (let i = 0; i < 5; i += 1) tracker.observe({ type: 'specialCargoCollected', id: `s${i}`, reward: bn(1) });
    tracker.check();
    expect(tracker.count).toBe(2);
    expect(events).toHaveLength(2);
    expect(tracker.view(0.01).list.every((entry) => entry.achievedAtSec === 42)).toBe(true);
    // Once is enough.
    tracker.check();
    expect(events).toHaveLength(2);
  });

  it('survive a save and load with their tallies', () => {
    const game = newGame();
    buildUpTo(game, 10);
    game.tick(seconds(2));
    const loaded = createGame({ catalog, save: migrate(stored(game.serialize())) });
    expect(achieved(loaded)).toEqual(achieved(game));
    expect(loaded.snapshot().achievements.list.find((entry) => entry.id === 'sales.1')!.value.toNumber()).toBe(
      game.snapshot().achievements.list.find((entry) => entry.id === 'sales.1')!.value.toNumber(),
    );
    loaded.drainEvents();
    loaded.tick(seconds(1));
    expect(loaded.drainEvents().some((event) => event.type === 'achievementUnlocked')).toBe(false);
  });

  it('judge a save from before achievements once, quietly', () => {
    const game = newGame();
    buildUpTo(game, 10);
    const save = stored(game.serialize());
    const state = save.state as Record<string, unknown>;
    delete state.achievements;
    const old = { ...save, version: 1 };
    const loaded = createGame({ catalog, save: migrate(old) });
    expect(achieved(loaded)).toContain('buildings.1');
    expect(loaded.drainEvents().some((event) => event.type === 'achievementUnlocked')).toBe(false);
  });
});
