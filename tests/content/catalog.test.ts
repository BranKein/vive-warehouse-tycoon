import { describe, expect, it } from 'vitest';
import { catalog } from '@/content';

describe('content catalog', () => {
  it('has 18 building types, each with a recipe', () => {
    const buildings = Object.values(catalog.buildings);
    expect(buildings).toHaveLength(18);
    for (const building of buildings) {
      expect(catalog.recipes[building.recipe], building.id).toBeDefined();
      for (const track of building.upgradeTracks) expect(catalog.upgradeTracks[track], track).toBeDefined();
      if (building.unlock) expect(catalog.unlocks[building.unlock], building.id).toBeDefined();
    }
  });

  it('only references known items in recipes', () => {
    for (const recipe of Object.values(catalog.recipes)) {
      for (const io of [...recipe.inputs, ...recipe.outputs]) {
        expect(catalog.items[io.item], `${recipe.id}:${io.item}`).toBeDefined();
      }
    }
  });

  it('starts with every tier-1 building unlocked and everything else locked', () => {
    for (const building of Object.values(catalog.buildings)) {
      expect(building.unlock === null, building.id).toBe(building.category === 'tier1');
    }
  });

  it('lays out 30 plots on a connected road graph', () => {
    const island = catalog.islands[catalog.startIsland]!;
    const { plots, roadNodes, roadEdges, facilities, roadGate } = island.layout;
    expect(plots).toHaveLength(30);
    expect(island.maxBuildings).toBe(30);
    const ids = new Set(roadNodes.map((node) => node.id));
    for (const plot of plots) expect(ids.has(plot.roadNode), plot.id).toBe(true);
    for (const facility of facilities) expect(ids.has(facility.roadNode), facility.id).toBe(true);

    const neighbours = new Map<string, string[]>();
    for (const [a, b] of roadEdges) {
      neighbours.set(a, [...(neighbours.get(a) ?? []), b]);
      neighbours.set(b, [...(neighbours.get(b) ?? []), a]);
    }
    const seen = new Set([roadGate]);
    const queue = [roadGate];
    while (queue.length > 0) {
      for (const next of neighbours.get(queue.pop()!) ?? []) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    expect(seen.size).toBe(ids.size);
  });
});
