import { describe, expect, it } from 'vitest';
import { catalog } from '@/content';
import { newGame } from './helpers';

describe('building limit per type', () => {
  it('refuses one more than the type allows and says so in the build options', () => {
    const game = newGame({ money: 1e12 });
    const max = catalog.buildings.sawmill!.maxCount;
    const free = game.snapshot().island.plots.filter((plot) => !plot.buildingId);
    // One sawmill stands already.
    for (let i = 1; i < max; i += 1) expect(game.build(free[i]!.id, 'sawmill')).toEqual({ ok: true });
    expect(game.build(free[max]!.id, 'sawmill')).toEqual({ ok: false, reason: 'typeFull' });
    const option = game.snapshot().island.buildOptions.find((entry) => entry.typeId === 'sawmill')!;
    expect(option).toMatchObject({ builtCount: max, maxCount: max });
    expect(game.build(free[max]!.id, 'flourMill')).toEqual({ ok: true });
  });

  it('makes the first tier-2 factory cheaper than a fourth tier-1 building', () => {
    const cost = (id: string, built: number): number => {
      const def = catalog.buildings[id]!;
      return def.buildCost * Math.pow(def.buildCostGrowth, built);
    };
    const furniture = catalog.unlocks['unlock.building.furnitureFactory']!.cost + cost('furnitureFactory', 0);
    for (const def of Object.values(catalog.buildings)) {
      if (def.category === 'tier1') expect(cost(def.id, 3), def.id).toBeGreaterThan(furniture);
    }
  });

  it('leaves room on the island for every type', () => {
    const island = catalog.islands[catalog.startIsland]!;
    const total = island.buildingTypes.reduce((sum, id) => sum + catalog.buildings[id]!.maxCount, 0);
    expect(total).toBeGreaterThanOrEqual(island.maxBuildings);
  });
});
