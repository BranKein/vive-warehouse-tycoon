/**
 * Primitive-built props (goods, scenery) and the four transport facilities.
 * Facilities share the plot frame of buildings: 16 wide, 14 deep, front +z.
 */
import type { Object3D } from 'three';
import type { ModelRegistry } from '../ModelRegistry';
import { renderConfig } from '../config';
import type { Anchors, Kit } from './kit';

function tree(kit: Kit, foliage: number, variant: number): Object3D {
  const p = kit.theme.props;
  const tall = variant % 2 === 1;
  const trunk = tall ? 2.3 : 1.6;
  const r = tall ? 1.25 : 1.5;
  return kit.group([
    kit.cyl(0.2, 0.3, trunk + 0.4, p.trunk, {}, 10),
    kit.blob(r, r * (tall ? 1.3 : 1.0), r, foliage, { y: trunk - 0.3 }),
    variant === 2 ? kit.blob(0.26, 0.26, 0.26, p.blossom, { x: r * 0.55, y: trunk + r * 0.9, z: r * 0.5 }) : null,
  ]);
}

function house(kit: Kit, wall: number, roof: number, variant: number): Object3D {
  const p = kit.theme.props;
  const window = kit.materials.window;
  const wide = variant % 2 === 0;
  const w = wide ? 6.2 : 4.8;
  const d = 4.6;
  const h = wide ? 2.9 : 3.6;
  return kit.group([
    kit.box(w, h, d, wall, { r: 0.35 }),
    kit.prism(w + 0.7, 1.9, d + 0.8, roof, { y: h - 0.08 }),
    kit.box(0.7, 1.6, 0.7, wall, { x: w * 0.28, y: h + 0.3, z: -0.8, r: 0.1 }),
    kit.box(0.95, 1.6, 0.14, p.door, { x: -w * 0.2, z: d / 2, r: 0.1 }),
    kit.box(1.1, 0.9, 0.14, window, { x: w * 0.2, y: 1.1, z: d / 2, r: 0.08 }),
    kit.box(0.14, 0.9, 1.2, window, { x: w / 2, y: 1.1, r: 0.08 }),
    kit.box(0.14, 0.9, 1.2, window, { x: -w / 2, y: 1.1, r: 0.08 }),
    kit.box(1.1, 0.9, 0.14, window, { y: 1.1, z: -d / 2, r: 0.08 }),
  ]);
}

/** One fence segment running along +x from the origin. */
function fence(kit: Kit): Object3D {
  const length = renderConfig.scenery.fenceSegment;
  const color = kit.theme.props.fence;
  return kit.group([
    kit.box(0.22, 1.0, 0.22, color, { r: 0.07 }),
    kit.box(length, 0.14, 0.1, color, { x: length / 2, y: 0.34, r: 0.04 }),
    kit.box(length, 0.14, 0.1, color, { x: length / 2, y: 0.7, r: 0.04 }),
  ]);
}

/** Street lamp; the arm reaches towards +z. */
function lamp(kit: Kit): Object3D {
  const p = kit.theme.props;
  return kit.group([
    kit.cyl(0.16, 0.22, 0.3, p.lampPole, {}, 10),
    kit.cyl(0.08, 0.1, 3.6, p.lampPole, {}, 8),
    kit.box(0.12, 0.12, 1.1, p.lampPole, { y: 3.5, z: 0.5, r: 0.05 }),
    kit.blob(0.26, 0.2, 0.26, kit.materials.lamp, { y: 3.18, z: 0.95 }),
  ]);
}

function specialCargo(kit: Kit): Object3D {
  const e = kit.theme.effects;
  const ribbon = kit.theme.props.blossom;
  return kit.group([
    kit.box(1.7, 1.5, 1.7, e.special, { r: 0.25 }),
    kit.box(1.74, 1.52, 0.36, ribbon, { r: 0.1 }),
    kit.box(0.36, 1.52, 1.74, ribbon, { r: 0.1 }),
    kit.blob(0.34, 0.26, 0.26, ribbon, { x: -0.3, y: 1.45 }),
    kit.blob(0.34, 0.26, 0.26, ribbon, { x: 0.3, y: 1.45 }),
  ]);
}

function coin(kit: Kit): Object3D {
  return kit.group([kit.cyl(0.55, 0.55, 0.14, kit.theme.effects.coin, { y: 0.48, rx: Math.PI / 2 }, 16)]);
}

function puff(kit: Kit): Object3D {
  return kit.group([kit.blob(1, 0.9, 1, kit.theme.effects.smoke, { y: -0.9 })]);
}

function roadDash(kit: Kit): Object3D {
  return kit.group([kit.box(0.26, 0.03, 1.7, kit.theme.ground.roadMark, { r: 0.01 })]);
}

// ---------------------------------------------------------------------------
// Facilities
// ---------------------------------------------------------------------------

function pileGrid(xs: number[], zs: number[]): Array<[number, number, number]> {
  const out: Array<[number, number, number]> = [];
  for (const z of zs) for (const x of xs) out.push([x, 0, z]);
  return out;
}

const YARD_ANCHORS: Anchors = {
  piles: pileGrid([-5.6, -3.3, -1.0, 1.3, 3.6], [-1.6, 0.8]),
  forklift: [
    [-4.5, 0, 3.0],
    [4.5, 0, 3.0],
    [4.5, 0, 5.6],
    [-4.5, 0, 5.6],
  ],
};

/** Open shed with a gatehouse; used for the inbound yard and the truck sale yard. */
function yard(kit: Kit, roof: number, accent: number): Object3D {
  const p = kit.theme.props;
  const parts: Object3D[] = [];
  for (const x of [-6.6, -2.2, 2.2, 6.6]) {
    parts.push(kit.box(0.4, 3.4, 0.4, p.sign, { x, z: -6.0, r: 0.12 }));
    parts.push(kit.box(0.4, 3.9, 0.4, p.sign, { x, z: -3.2, r: 0.12 }));
  }
  parts.push(kit.box(14.4, 0.3, 4.4, roof, { y: 3.55, z: -4.6, rx: 0.12, r: 0.14 }));
  parts.push(kit.box(14.0, 2.6, 0.3, p.concrete, { z: -6.3, r: 0.12 }));
  // Gatehouse.
  parts.push(kit.box(2.4, 2.4, 2.4, accent, { x: 6.2, z: 1.2, r: 0.4 }));
  parts.push(kit.box(2.7, 0.3, 2.7, roof, { x: 6.2, y: 2.35, z: 1.2, r: 0.14 }));
  parts.push(kit.box(1.5, 0.8, 0.16, kit.materials.window, { x: 6.2, y: 1.1, z: 2.4, r: 0.07 }));
  parts.push(kit.box(0.16, 0.8, 1.5, kit.materials.window, { x: 5.0, y: 1.1, z: 1.2, r: 0.07 }));
  // Striped barrier.
  parts.push(kit.box(0.3, 1.0, 0.3, p.hazard, { x: 4.6, z: 6.4, r: 0.08 }));
  parts.push(kit.box(3.6, 0.16, 0.16, p.hazard, { x: 2.9, y: 0.85, z: 6.4, r: 0.05 }));
  return kit.group(parts, YARD_ANCHORS);
}

function dock(kit: Kit): Object3D {
  const p = kit.theme.props;
  const v = kit.theme.vehicles;
  const parts: Object3D[] = [];
  // Wooden pier reaching over the water at the front.
  parts.push(kit.box(15, 0.35, 5.2, p.wood, { y: -0.2, z: 4.4, r: 0.1 }));
  for (const x of [-6.8, -2.3, 2.3, 6.8]) {
    parts.push(kit.cyl(0.32, 0.32, 2.2, p.trunk, { x, y: -1.4, z: 6.7 }, 10));
    parts.push(kit.cyl(0.36, 0.36, 0.16, p.sign, { x, y: 0.75, z: 6.7 }, 10));
  }
  // Crane.
  parts.push(kit.box(1.6, 0.5, 1.6, p.concrete, { x: -5.6, z: 3.6, r: 0.12 }));
  parts.push(kit.box(0.7, 6.4, 0.7, p.hazard, { x: -5.6, y: 0.4, z: 3.6, r: 0.14 }));
  parts.push(kit.box(0.5, 0.5, 7.4, p.hazard, { x: -5.6, y: 6.3, z: 5.4, r: 0.14 }));
  parts.push(kit.box(1.3, 1.1, 1.3, v.shipCabin, { x: -5.6, y: 5.2, z: 3.0, r: 0.2 }));
  parts.push(kit.cyl(0.04, 0.04, 2.4, p.darkMetal, { x: -5.6, y: 3.9, z: 8.2 }, 6));
  // Harbour office.
  parts.push(kit.box(4.2, 2.6, 3.0, v.shipCabin, { x: 4.6, z: -4.6, r: 0.4 }));
  parts.push(kit.box(4.6, 0.3, 3.4, v.shipStripe, { x: 4.6, y: 2.55, z: -4.6, r: 0.14 }));
  parts.push(kit.box(2.6, 0.8, 0.16, kit.materials.window, { x: 4.6, y: 1.2, z: -3.1, r: 0.07 }));
  return kit.group(parts, {
    piles: pileGrid([-2.8, -0.5, 1.8, 4.1, 6.2], [0.2, 3.0]),
    forklift: [
      [-4.0, 0, -2.0],
      [5.5, 0, -1.6],
      [5.5, 0, 5.4],
      [-3.4, 0, 5.4],
    ],
  });
}

function airport(kit: Kit): Object3D {
  const p = kit.theme.props;
  const v = kit.theme.vehicles;
  const parts: Object3D[] = [];
  // Hangar.
  parts.push(kit.box(8.4, 2.4, 5.0, v.planeBody, { x: -3.2, z: -4.2, r: 0.3 }));
  parts.push(kit.barrel(8.6, 1.9, 5.3, v.planeAccent, { x: -3.2, y: 2.35, z: -4.2 }));
  parts.push(kit.box(5.4, 2.0, 0.16, p.door, { x: -3.2, z: -1.7, r: 0.08 }));
  // Control tower.
  parts.push(kit.cyl(0.8, 1.0, 5.6, v.planeBody, { x: 5.4, z: -4.4 }, 16));
  parts.push(kit.cyl(1.5, 1.2, 1.2, kit.materials.window, { x: 5.4, y: 5.6, z: -4.4 }, 16));
  parts.push(kit.cyl(1.7, 1.7, 0.3, v.planeAccent, { x: 5.4, y: 6.8, z: -4.4 }, 16));
  parts.push(kit.blob(0.2, 0.2, 0.2, kit.materials.lamp, { x: 5.4, y: 7.1, z: -4.4 }));
  // Windsock.
  parts.push(kit.cyl(0.06, 0.08, 2.8, p.lampPole, { x: 7.2, z: 5.6 }, 8));
  parts.push(kit.cone(0.26, 1.0, p.hazard, { x: 6.7, y: 2.5, z: 5.6, rz: Math.PI / 2 }, 10));
  return kit.group(parts, {
    piles: pileGrid([-5.6, -3.3, -1.0, 1.3, 3.6], [0.4, 2.8]),
    forklift: [
      [-4.5, 0, 4.6],
      [4.5, 0, 4.6],
      [4.5, 0, 6.2],
      [-4.5, 0, 6.2],
    ],
  });
}

export const TREE_MODEL = (index: number): string => `prop.tree${index}`;
export const HOUSE_MODEL = (index: number): string => `prop.house${index}`;

/** The trees and the street lamp: the props the game's board is dressed with. */
export function registerStreetModels(registry: ModelRegistry, kit: Kit): void {
  kit.theme.props.foliage.forEach((color, index) => {
    registry.register(TREE_MODEL(index), (k) => tree(k, color, index));
  });
  registry.register(LAMP_MODEL, lamp);
  registerHouseModels(registry, kit);
}

/** The village houses that stand around the board. */
function registerHouseModels(registry: ModelRegistry, kit: Kit): void {
  const theme = kit.theme;
  theme.props.houseWalls.forEach((wall, index) => {
    const roofs = theme.props.houseRoofs;
    registry.register(HOUSE_MODEL(index), (k) => house(k, wall, roofs[index % roofs.length] ?? wall, index));
  });
}

export const houseModelNames = (kit: Kit): string[] => kit.theme.props.houseWalls.map((_, index) => HOUSE_MODEL(index));

export const LAMP_MODEL = 'prop.lamp';

export function registerPropModels(registry: ModelRegistry, kit: Kit): void {
  const theme = kit.theme;
  theme.props.foliage.forEach((color, index) => {
    registry.register(TREE_MODEL(index), (k) => tree(k, color, index));
  });
  registerHouseModels(registry, kit);
  registry.register('prop.fence', fence);
  registry.register('prop.lamp', lamp);
  registry.register('prop.specialCargo', specialCargo);
  registry.register('prop.coin', coin);
  registry.register('prop.puff', puff);
  registry.register('prop.roadDash', roadDash);
  registry.register('facility.inboundYard', (k) => yard(k, k.theme.vehicles.carrierCab, k.theme.vehicles.truckBody));
  registry.register('facility.truckYard', (k) => yard(k, k.theme.vehicles.truckCab, k.theme.vehicles.truckBody));
  registry.register('facility.dock', dock);
  registry.register('facility.airport', airport);
  registry.register('facility.default', (k) => yard(k, k.theme.props.houseRoofs[0] ?? 0xf4a79d, k.theme.vehicles.truckBody));
}
