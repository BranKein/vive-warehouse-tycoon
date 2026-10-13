import { describe, expect, it } from 'vitest';
import { catalog } from '@/content';
import { renderConfig } from '@/render/config';
import { facilityPileLocal, pilePosition, roadStrips, siteToWorld } from '@/render/layout';
import { fallbackName } from '@/render/ModelRegistry';
import { gapTreeSpots, outskirts } from '@/render/scenery';
import { buildingKey, diffKeys, laneShift, pilesToShow, vehiclePoses, vehicleSize, type VehicleLike } from '@/render/sync';

describe('diffKeys', () => {
  it('lists what to create and what to remove', () => {
    expect(diffKeys(['a', 'b', 'c'], ['b', 'c', 'd', 'e'])).toEqual({ create: ['d', 'e'], remove: ['a'] });
  });

  it('does nothing when the two sides match', () => {
    expect(diffKeys(['a', 'b'], ['b', 'a'])).toEqual({ create: [], remove: [] });
  });

  it('handles an empty side and repeated keys', () => {
    expect(diffKeys([], ['a', 'a'])).toEqual({ create: ['a'], remove: [] });
    expect(diffKeys(['a', 'b'], [])).toEqual({ create: [], remove: ['a', 'b'] });
  });

  it('rebuilds a building whose type or plot changed under the same id', () => {
    const before = buildingKey({ id: 'b1', typeId: 'sawmill', plotId: 'p0-0' });
    const retyped = buildingKey({ id: 'b1', typeId: 'steelMill', plotId: 'p0-0' });
    const moved = buildingKey({ id: 'b1', typeId: 'sawmill', plotId: 'p0-1' });
    expect(diffKeys([before], [retyped])).toEqual({ create: [retyped], remove: [before] });
    expect(moved).not.toBe(before);
    expect(buildingKey({ id: 'b1', typeId: 'sawmill', plotId: 'p0-0' })).toBe(before);
  });
});

describe('vehiclePoses', () => {
  const vehicle = (id: string, x: number, heading = 0): VehicleLike => ({ id, model: 'vehicle.carrier', x, y: 0, z: 0, heading });
  const snap = renderConfig.vehicle.snapDistance;

  it('interpolates a vehicle that is in both snapshots', () => {
    const drawn = vehiclePoses([vehicle('v1', 0)], [vehicle('v1', 2)], 0.25, snap);
    expect(drawn).toHaveLength(1);
    expect(drawn[0]!.pose.x).toBeCloseTo(0.5);
    expect(drawn[0]!.model).toBe('vehicle.carrier');
  });

  it('draws a vehicle that just appeared at its current pose', () => {
    const drawn = vehiclePoses([vehicle('v1', 0)], [vehicle('v1', 2), vehicle('v2', 9, 1)], 0.5, snap);
    expect(drawn.map((d) => d.id)).toEqual(['v1', 'v2']);
    expect(drawn[1]!.pose).toEqual({ x: 9, y: 0, z: 0, heading: 1 });
  });

  it('does not draw a vehicle that is only in the previous snapshot', () => {
    const drawn = vehiclePoses([vehicle('v1', 0), vehicle('gone', 5)], [vehicle('v1', 2)], 0.5, snap);
    expect(drawn.map((d) => d.id)).toEqual(['v1']);
  });

  it('uses current poses when there is no comparable previous snapshot', () => {
    const curr = [vehicle('v1', 2)];
    expect(vehiclePoses(null, curr, 0.5, snap)[0]!.pose.x).toBe(2);
    expect(vehiclePoses(curr, curr, 0.5, snap)[0]!.pose.x).toBe(2);
  });

  it('does not slide a vehicle across the board when it teleports', () => {
    expect(vehiclePoses([vehicle('v1', 0)], [vehicle('v1', snap + 1)], 0.5, snap)[0]!.pose.x).toBe(snap + 1);
  });
});

describe('roads', () => {
  it('turns each edge into a strip between its two nodes', () => {
    const nodes = [
      { id: 'a', x: 0, z: 0 },
      { id: 'b', x: 10, z: 0 },
      { id: 'c', x: 10, z: -6 },
    ];
    const strips = roadStrips(nodes, [['a', 'b'], ['b', 'c'], ['a', 'missing']]);
    expect(strips).toHaveLength(2);
    expect(strips[0]).toMatchObject({ x: 5, z: 0, length: 10 });
    expect(strips[0]!.heading).toBeCloseTo(Math.PI / 2);
    expect(strips[1]).toMatchObject({ x: 10, z: -3, length: 6 });
    expect(Math.abs(strips[1]!.heading)).toBeCloseTo(Math.PI);
  });

  it('covers every edge of the first island', () => {
    const layout = catalog.islands[catalog.startIsland]!.layout;
    const strips = roadStrips(layout.roadNodes, layout.roadEdges);
    expect(strips).toHaveLength(layout.roadEdges.length);
    expect(strips.every((strip) => strip.length > 0)).toBe(true);
  });
});

describe('site positions', () => {
  const yard = renderConfig.boxes.yard;

  it('keeps local coordinates for a site facing +z and mirrors them for one facing -z', () => {
    expect(siteToWorld({ x: 10, z: 20, facing: 0 }, 3, 4)).toEqual({ x: 13, z: 24 });
    const flipped = siteToWorld({ x: 10, z: 20, facing: Math.PI }, 3, 4);
    expect(flipped.x).toBeCloseTo(7);
    expect(flipped.z).toBeCloseTo(16);
  });

  it('lines inputs up from the left, outputs from the right, waste beside the box', () => {
    const site = { x: 0, z: 0, facing: 0 };
    expect(pilePosition(site, 'inputs', 0, yard)).toEqual({ x: -yard.edgeX, z: yard.frontZ });
    expect(pilePosition(site, 'inputs', 1, yard).x).toBeCloseTo(-yard.edgeX + yard.step);
    expect(pilePosition(site, 'outputs', 1, yard).x).toBeCloseTo(yard.edgeX - yard.step);
    expect(pilePosition(site, 'waste', 1, yard)).toEqual({ x: yard.wasteX, z: yard.wasteZ - yard.wasteStep });
  });

  it('keeps every pile of a full yard on its own plot and off the building box', () => {
    const layout = catalog.islands[catalog.startIsland]!.layout;
    const boxes = renderConfig.boxes;
    const halfWidth = layout.plotSize.width / 2;
    const halfDepth = layout.plotSize.depth / 2;
    const boxFront = boxes.siteOffsetZ + boxes.building[2] / 2;
    const site = { x: 0, z: 0, facing: 0 };
    for (const group of ['inputs', 'outputs'] as const) {
      for (let index = 0; index < 3; index += 1) {
        const at = pilePosition(site, group, index, yard);
        expect(Math.abs(at.x) + renderConfig.pile.palletSize / 2).toBeLessThanOrEqual(halfWidth);
        expect(at.z + renderConfig.pile.palletSize / 2).toBeLessThanOrEqual(halfDepth);
        expect(at.z - renderConfig.pile.palletSize / 2).toBeGreaterThanOrEqual(boxFront);
      }
    }
    const waste = pilePosition(site, 'waste', 0, yard);
    expect(waste.x - renderConfig.waste.footprint / 2).toBeGreaterThanOrEqual(boxes.building[0] / 2);
    expect(waste.x + renderConfig.waste.footprint / 2).toBeLessThanOrEqual(halfWidth);
  });
});

describe('model names', () => {
  it('falls back to the default of the same family', () => {
    expect(fallbackName('building.sawmill')).toBe('building.default');
    expect(fallbackName('vehicle.unknownThing')).toBe('vehicle.default');
  });
});

describe('facility piles', () => {
  const rule = renderConfig.boxes.yard.facility;

  it('wraps into rows that stay on the pad', () => {
    const pad = renderConfig.boxes.ground.facilityPad;
    const half = (renderConfig.pile.palletSize * rule.scale) / 2;
    for (let slot = 0; slot < rule.perRow * rule.rows; slot += 1) {
      const at = facilityPileLocal(slot, rule);
      expect(Math.abs(at.x) + half).toBeLessThanOrEqual(pad[0] / 2);
      expect(at.z + half).toBeLessThanOrEqual(pad[1] / 2);
    }
    expect(facilityPileLocal(rule.perRow, rule)).toEqual({ x: -rule.edgeX, z: rule.frontZ - rule.rowStep });
  });

  it('keeps every stock in place while they fit and shows the largest when they do not', () => {
    expect(pilesToShow([1, -Infinity, 3], 3)).toEqual([0, 1, 2]);
    expect(pilesToShow([1, -Infinity, 3, 2], 3)).toEqual([0, 2, 3]);
    expect(pilesToShow([1, 5, 3, 2, -Infinity], 2)).toEqual([1, 2]);
  });
});

describe('vehicles on the road', () => {
  it('keeps to the right of the way a vehicle is heading', () => {
    // Heading 0 is +z (south): the right-hand side is west.
    expect(laneShift(0, 1.5).x).toBeCloseTo(-1.5);
    expect(laneShift(0, 1.5).z).toBeCloseTo(0);
    // Heading east: the right-hand side is south.
    expect(laneShift(Math.PI / 2, 1.5).z).toBeCloseTo(1.5);
    // Turning round swaps the lane.
    expect(laneShift(Math.PI, 1.5).x).toBeCloseTo(1.5);
  });

  it('grows in, stays whole, and shrinks away after leaving', () => {
    expect(vehicleSize(0, -1, 1, 1)).toBe(0);
    expect(vehicleSize(0.5, -1, 1, 1)).toBeCloseTo(0.5);
    expect(vehicleSize(5, -1, 1, 1)).toBe(1);
    expect(vehicleSize(5, 0.5, 1, 1)).toBeCloseTo(0.5);
    expect(vehicleSize(5, 1, 1, 1)).toBe(0);
    expect(vehicleSize(Infinity, -1, 1, 1)).toBe(1);
  });
});

describe('scenery', () => {
  const layout = catalog.islands[catalog.startIsland]!.layout;
  const rule = renderConfig.scenery;

  it('plants small trees only in the strips between neighbouring plots', () => {
    const trees = gapTreeSpots(layout, { ...rule.gapTrees, seed: rule.seed });
    expect(trees.length).toBeGreaterThan(20);
    expect(gapTreeSpots(layout, { ...rule.gapTrees, seed: rule.seed })).toEqual(trees);
    const halfWidth = layout.plotSize.width / 2;
    for (const tree of trees) {
      // Off every plot: at least the gap's half width away from each plot's side edges.
      for (const plot of layout.plots) {
        const local = siteToWorld({ x: 0, z: 0, facing: -plot.facing }, tree.x - plot.x, tree.z - plot.z);
        const inside = Math.abs(local.x) < halfWidth && Math.abs(local.z) < layout.plotSize.depth / 2;
        expect(inside, `tree at ${tree.x}, ${tree.z}`).toBe(false);
      }
    }
  });

  it('keeps the countryside off the board and out of the corridors', () => {
    const b = layout.bounds;
    const corridor = { minX: -2000, maxX: 2000, minZ: layout.river.minZ - 5, maxZ: layout.river.maxZ + 5 };
    const land = outskirts(b, [corridor], { ...rule.outskirts, seed: rule.seed });
    expect(land.hills).toHaveLength(rule.outskirts.hills);
    expect(land.houses.length).toBe(rule.outskirts.villages * rule.outskirts.housesPerVillage);
    expect(land.trees.length).toBeGreaterThan(rule.outskirts.trees / 2);
    for (const spot of [...land.trees, ...land.houses]) {
      const onBoard = spot.x > b.minX && spot.x < b.maxX && spot.z > b.minZ && spot.z < b.maxZ;
      expect(onBoard).toBe(false);
    }
    for (const tree of land.trees) expect(tree.z > corridor.minZ && tree.z < corridor.maxZ).toBe(false);
    for (const hill of land.hills) expect(Math.abs(hill.z - (corridor.minZ + corridor.maxZ) / 2)).toBeGreaterThan(hill.radius);
  });
});
