import { describe, expect, it } from 'vitest';
import { catalog } from '@/content';
import { bn } from '@/core/BigNum';
import { createGame } from '@/sim';

describe('yard deliveries', () => {
  it('keep every tier-1 building supplied when several compete for one carrier', () => {
    const game = createGame({ catalog, seed: 1 });
    game.grant(bn(1e6));
    const free = game.snapshot().island.plots.filter((plot) => !plot.buildingId);
    const types = ['flourMill', 'steelMill', 'textileMill', 'refinery', 'glassworks'];
    types.forEach((typeId, index) => {
      expect(game.commands.build(free[index * 5]!.id, typeId)).toEqual({ ok: true });
    });

    // Count the ticks each building spends working over ten minutes.
    const worked = new Map<string, number>();
    for (let tick = 0; tick < 20 * 600; tick += 20) {
      game.tick(20);
      for (const building of game.snapshot().island.buildings) {
        if (building.status === 'working') worked.set(building.typeId, (worked.get(building.typeId) ?? 0) + 1);
      }
    }
    for (const typeId of ['sawmill', ...types]) {
      expect(worked.get(typeId) ?? 0, typeId).toBeGreaterThan(0);
    }
  });
});
