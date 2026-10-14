import { describe, expect, it } from 'vitest';
import { catalog } from '@/content';
import { renderConfig } from '@/render/config';
import { facilityPileLocal, pilePosition, roadStrips, siteToWorld } from '@/render/layout';
import { fallbackName } from '@/render/ModelRegistry';
import { gapTreeSpots, outskirts, runwayLightSpots } from '@/render/scenery';
import {
  buildingKey,
  crossingPose,
  cruiseStep,
  diffKeys,
  backOutPose,
  laneShift,
  onTrail,
  planCrossing,
  routeDots,
  trailPoint,
  pilesToShow,
  vehiclePoses,
  vehicleFade,
  parkedShift,
  type VehicleLike,
} from '@/render/sync';
import { carrierColor, defaultTheme } from '@/render/theme';

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

  it('fades in, stays whole, and fades away after leaving', () => {
    expect(vehicleFade(0, -1, 1, 1)).toBe(0);
    expect(vehicleFade(0.5, -1, 1, 1)).toBeCloseTo(0.5);
    expect(vehicleFade(5, -1, 1, 1)).toBe(1);
    expect(vehicleFade(5, 0.5, 1, 1)).toBeCloseTo(0.5);
    expect(vehicleFade(5, 1, 1, 1)).toBe(0);
    expect(vehicleFade(Infinity, -1, 1, 1)).toBe(1);
  });

  it('backs out straight, then round a curve, at one unit of the way per unit of distance', () => {
    // Parked facing north (-z); the road leads east (+x), a quarter turn.
    const leaving = { heading: Math.PI, x: 0, z: 0, straight: 3, turn: -Math.PI / 2, radius: 2 };
    expect(backOutPose(leaving, 2)).toMatchObject({ x: expect.closeTo(0), z: expect.closeTo(2), heading: Math.PI, done: false });
    const end = backOutPose(leaving, 3 + Math.PI);
    expect(end.done).toBe(true);
    expect(end.heading).toBeCloseTo(Math.PI / 2);
    // It backed south and swung its tail west, so it now faces east from west of where it stood.
    expect(end.x).toBeCloseTo(-2);
    expect(end.z).toBeCloseTo(5);
    // Half way round the curve it has moved half the curve's length.
    const mid = backOutPose(leaving, 3 + Math.PI / 2);
    const before = backOutPose(leaving, 3 + Math.PI / 2 - 0.01);
    expect(Math.hypot(mid.x - before.x, mid.z - before.z)).toBeCloseTo(0.01, 4);
  });

  it('reads a place off the way a vehicle came', () => {
    const trail = [
      { x: 0, z: 0, d: 0 },
      { x: 4, z: 0, d: 4 },
      { x: 4, z: 6, d: 10 },
    ];
    expect(trailPoint(trail, 2)).toEqual({ x: 2, z: 0 });
    expect(trailPoint(trail, 7)).toEqual({ x: 4, z: 3 });
    // Before and after the trail: its ends. Before the floor: the floor.
    expect(trailPoint(trail, -5)).toEqual({ x: 0, z: 0 });
    expect(trailPoint(trail, 99)).toEqual({ x: 4, z: 6 });
    expect(trailPoint(trail, 1, 4)).toEqual({ x: 4, z: 0 });
  });

  it('parks on the lane it came in on, further into the site', () => {
    // Driving north (-z) into a plot south of its road: the right-hand lane is east, further in is north.
    const shift = parkedShift(Math.PI, 1.5, 2);
    expect(shift.x).toBeCloseTo(1.5);
    expect(shift.z).toBeCloseTo(-2);
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

  it('keeps the countryside off the board and out of the sea', () => {
    const b = layout.bounds;
    const sea = { minX: -2000, maxX: 2000, minZ: layout.river.minZ - 14, maxZ: 2000 };
    const land = outskirts(b, [sea], { ...rule.outskirts, seed: rule.seed });
    expect(land.hills).toHaveLength(rule.outskirts.hills);
    expect(land.houses.length).toBe(rule.outskirts.villages * rule.outskirts.housesPerVillage);
    expect(land.trees.length).toBeGreaterThan(rule.outskirts.trees / 2);
    for (const spot of [...land.trees, ...land.houses]) {
      const onBoard = spot.x > b.minX && spot.x < b.maxX && spot.z > b.minZ && spot.z < b.maxZ;
      expect(onBoard).toBe(false);
      expect(spot.z).toBeLessThan(sea.minZ);
    }
    for (const hill of land.hills) expect(hill.z + hill.radius).toBeLessThan(sea.minZ);
  });

  it('lines the runway with lights and leaves the way off it free', () => {
    const runway = layout.runway;
    const lightRule = renderConfig.boxes.ground.runwayLights;
    const lights = runwayLightSpots(runway, layout.flightLane, lightRule);
    expect(lights.edge.length).toBeGreaterThan(20);
    expect(lights.ends.length).toBeGreaterThan(4);
    for (const light of [...lights.edge, ...lights.ends]) {
      expect(light.x).toBeGreaterThan(runway.minX);
      expect(light.x).toBeLessThan(runway.maxX);
      expect(light.z).toBeGreaterThan(runway.minZ);
      expect(light.z).toBeLessThan(runway.maxZ);
    }
    // Planes leave the runway towards the apron, which is the last point of their lane.
    const apron = layout.flightLane[layout.flightLane.length - 1]!;
    const turnOff = layout.flightLane[layout.flightLane.length - 2]!;
    const mid = { x: (apron.x + turnOff.x) / 2, z: (apron.z + turnOff.z) / 2 };
    for (const light of lights.edge) expect(Math.hypot(light.x - mid.x, light.z - mid.z)).toBeGreaterThan(lightRule.clearance * 0.9);
  });
});

describe('carrierColor', () => {
  it('keeps the colour of the owner when the building makes nothing', () => {
    expect(carrierColor(defaultTheme, 'tier2')).toBe(defaultTheme.vehicles.carrierOwners.tier2);
    expect(carrierColor(defaultTheme, 'tier1')).toBe(defaultTheme.vehicles.carrierCab);
  });

  it('moves towards the colour of the goods, differently for each kind', () => {
    const chair = carrierColor(defaultTheme, 'tier2', 'chair');
    const snack = carrierColor(defaultTheme, 'tier2', 'snack');
    expect(chair).not.toBe(snack);
    expect(chair).not.toBe(defaultTheme.vehicles.carrierOwners.tier2);
  });

  it("uses the owner's own colour for goods that have one", () => {
    expect(carrierColor(defaultTheme, 'tier1', 'lumber')).toBe(defaultTheme.vehicles.carrierGoodsColors.tier1!.lumber);
    expect(carrierColor(defaultTheme, 'tier1', 'steel')).not.toBe(carrierColor(defaultTheme, 'tier1', 'lumber'));
  });
});

describe('routeDots', () => {
  const way = [{ x: 0, z: 0 }, { x: 0, z: 10 }, { x: 10, z: 10 }];

  it('runs from where the vehicle is to the end of its way, on the right-hand lane', () => {
    const dots = routeDots(way, 4, 2, 1);
    // Heading +z, the right-hand side is -x.
    expect(dots[0]).toEqual({ x: -1, z: 4 });
    const last = dots[dots.length - 1]!;
    expect(last.x).toBeCloseTo(10);
    expect(last.z).toBeCloseTo(11);
    expect(dots.every((dot) => dot.z >= 4)).toBe(true);
  });

  it('is empty once the way is behind it', () => {
    expect(routeDots(way, 25, 2, 1)).toEqual([]);
  });
});

describe('cruiseStep', () => {
  const rule = { slack: 4, ease: 20, slowest: 0.85, fastest: 1.15 };

  it('moves as far on screen as the game moved it when it is where it should be', () => {
    expect(cruiseStep(6, 1, 10, () => 1, rule)).toBeCloseTo(7);
    // On the inner lane of a right turn the trail runs faster than the screen.
    expect(cruiseStep(6, 1, 10, () => 0.5, rule)).toBeCloseTo(8);
  });

  it('closes a gap slowly and never runs past the furthest it may be drawn', () => {
    expect(cruiseStep(0, 1, 10, () => 1, rule)).toBeCloseTo(1.15);
    expect(cruiseStep(9, 1, 10, () => 1, rule)).toBeCloseTo(9.85);
    expect(cruiseStep(9.9, 1, 10, () => 0.3, rule)).toBe(10);
    expect(cruiseStep(5, 0, 10, () => 1, rule)).toBe(5);
  });
});

describe('onTrail', () => {
  it('is drawn on the right-hand lane facing along the trail', () => {
    const trail = [
      { x: 0, z: 0, d: 0 },
      { x: 0, z: 20, d: 20 },
    ];
    const drawn = onTrail(trail, 10, 2, -Infinity, 1.5, 0);
    expect(drawn.heading).toBeCloseTo(0);
    expect(drawn.x).toBeCloseTo(laneShift(0, 1.5).x);
    expect(drawn.z).toBeCloseTo(10);
  });
});

describe('crossing', () => {
  it('backs out, swings round and ends standing in the site opposite, facing into it', () => {
    const from = { x: 1.5, z: -5.4, heading: Math.PI };
    const to = { x: -1.5, z: 5.4 };
    const plan = planCrossing(from, to, 2)!;
    expect(plan).not.toBeNull();
    const start = crossingPose(plan, 0);
    expect(start.x).toBeCloseTo(from.x);
    expect(start.z).toBeCloseTo(from.z);
    const end = crossingPose(plan, plan.length);
    expect(end.done).toBe(true);
    expect(end.x).toBeCloseTo(to.x);
    expect(end.z).toBeCloseTo(to.z);
    expect(Math.cos(end.heading)).toBeCloseTo(1);
    // No jumps on the way, in place or in heading.
    let previous = start;
    for (let distance = 0.1; distance <= plan.length; distance += 0.1) {
      const pose = crossingPose(plan, distance);
      expect(Math.hypot(pose.x - previous.x, pose.z - previous.z)).toBeLessThan(0.11);
      expect(Math.abs(Math.atan2(Math.sin(pose.heading - previous.heading), Math.cos(pose.heading - previous.heading)))).toBeLessThan(0.1);
      previous = pose;
    }
  });

  it('gives up when the sites are too close for the curves', () => {
    expect(planCrossing({ x: 0, z: 0, heading: Math.PI }, { x: 3, z: 3 }, 2)).toBeNull();
  });
});
