import { describe, expect, it } from 'vitest';
import { catalog } from '@/content';
import { bn } from '@/core/BigNum';
import { newGame, seconds } from './helpers';

describe('waste reduction upgrade', () => {
  it('is offered only to buildings whose recipe makes waste', () => {
    expect(catalog.buildings.steelMill!.upgradeTracks).toContain('building.wasteCut');
    expect(catalog.buildings.refinery!.upgradeTracks).toContain('building.wasteCut');
    expect(catalog.buildings.sawmill!.upgradeTracks).not.toContain('building.wasteCut');
    expect(catalog.buildings.wasteDisposal!.upgradeTracks).not.toContain('building.wasteCut');
  });

  it('cuts the waste of each cycle but never all of it', () => {
    const track = catalog.upgradeTracks['building.wasteCut']!;
    expect(track.maxLevel).not.toBeNull();
    expect(Math.pow(track.effect.perLevel, track.maxLevel!)).toBeGreaterThan(0.3);

    /** Slag per steel made over ten minutes, with the track bought `levels` times. */
    const slagPerSteel = (levels: number): number => {
      const game = newGame({ money: 1e9 });
      const plot = game.snapshot().island.plots.find((entry) => !entry.buildingId)!;
      expect(game.build(plot.id, 'steelMill')).toEqual({ ok: true });
      const mill = game.island.buildings.find((building) => building.def.id === 'steelMill')!;
      for (let i = 0; i < levels; i += 1) expect(game.upgradeBuilding(mill.id, track.id)).toEqual({ ok: true });
      // Count what is made, wherever it has gone since.
      let steel = bn(0);
      let slag = bn(0);
      let lastSteel = bn(0);
      let lastSlag = bn(0);
      for (let i = 0; i < seconds(600); i += 1) {
        game.tick();
        const nowSteel = mill.outputs.amount('steel');
        const nowSlag = mill.waste.amount('slag');
        if (nowSteel.gt(lastSteel)) steel = steel.add(nowSteel.sub(lastSteel));
        if (nowSlag.gt(lastSlag)) slag = slag.add(nowSlag.sub(lastSlag));
        lastSteel = nowSteel;
        lastSlag = nowSlag;
      }
      expect(steel.toNumber()).toBeGreaterThan(0);
      return slag.toNumber() / steel.toNumber();
    };

    const base = slagPerSteel(0);
    expect(base).toBeCloseTo(0.5);
    expect(slagPerSteel(1)).toBeCloseTo(0.5 * track.effect.perLevel);
    const most = slagPerSteel(track.maxLevel!);
    expect(most).toBeGreaterThan(0);
    expect(most).toBeLessThan(base / 2 + 0.01);

    const game = newGame({ money: 1e12 });
    const plot = game.snapshot().island.plots.find((entry) => !entry.buildingId)!;
    game.build(plot.id, 'steelMill');
    const mill = game.island.buildings.at(-1)!;
    while (game.upgradeBuilding(mill.id, track.id).ok);
    expect(mill.levels.get(track.id)).toBe(track.maxLevel);
  });
});
