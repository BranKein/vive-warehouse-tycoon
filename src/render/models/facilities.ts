/**
 * Logistics facilities, drawn by hand in the style of the sawmill: the inbound
 * yard, the truck yard, the dock and the airport. Each is drawn in the frame of
 * its 16 x 14 pad: +z is the front, where the row of stock piles stands
 * (z 3.9 to 5.3 stays empty across the whole width).
 */
import type { Object3D } from 'three';
import type { ModelRegistry } from '../ModelRegistry';
import { itemColor } from '../theme';
import type { Kit, Paint } from './kit';
import { HALF_PI, bush, flatRoof, framedWindow, rollerDoor } from './parts';

type Parts = Array<Object3D | Object3D[]>;

/** Round sign plate facing +z with an arrow on it; `turn` rotates the arrow (0 points up). */
function arrowSign(kit: Kit, x: number, y: number, z: number, radius: number, plate: Paint, turn: number): Object3D {
  const p = kit.theme.props;
  const sign = kit.group([
    kit.cyl(radius + 0.14, radius + 0.14, 0.1, p.sign, { y: -0.05, rx: HALF_PI }, 28),
    kit.cyl(radius, radius, 0.14, plate, { y: -0.07, rx: HALF_PI }, 28),
  ]);
  const arrow = kit.group([
    kit.box(radius * 0.34, radius * 0.9, 0.1, p.sign, { y: -radius * 0.62, z: 0.06, r: 0.03 }),
    kit.box(radius * 0.3, radius * 0.8, 0.1, p.sign, { x: -radius * 0.22, y: -radius * 0.02, z: 0.06, rz: -Math.PI / 4, r: 0.03 }),
    kit.box(radius * 0.3, radius * 0.8, 0.1, p.sign, { x: radius * 0.22, y: -radius * 0.02, z: 0.06, rz: Math.PI / 4, r: 0.03 }),
  ]);
  arrow.rotation.z = turn;
  sign.add(arrow);
  sign.position.set(x, y, z);
  return sign;
}

/** Pallet with a few crates in the given colours; `y` is the ground it stands on. */
function pallet(kit: Kit, x: number, y: number, z: number, colors: number[]): Object3D[] {
  const parts: Object3D[] = [kit.box(1.3, 0.14, 1.1, kit.theme.goods.pallet, { x, y, z, r: 0.03 })];
  const spots: Array<[number, number, number]> = [
    [-0.31, 0, 0],
    [0.31, 0, 0],
    [0, 0.56, 0],
  ];
  colors.slice(0, 3).forEach((color, index) => {
    const [dx, dy, dz] = spots[index]!;
    parts.push(kit.box(0.56, 0.54, 0.8, color, { x: x + dx, y: y + 0.14 + dy, z: z + dz, r: 0.07 }));
  });
  return parts;
}

/** Traffic cone. */
function cone(kit: Kit, x: number, y: number, z: number): Object3D[] {
  const p = kit.theme.props;
  return [
    kit.box(0.42, 0.06, 0.42, p.hazard, { x, y, z, r: 0.02 }),
    kit.cone(0.16, 0.5, p.hazard, { x, y: y + 0.05, z }, 12),
    kit.cyl(0.085, 0.115, 0.1, p.sign, { x, y: y + 0.22, z }, 12),
  ];
}

/** Inbound yard: an open canopy where raw materials arrive, shelves of crates under it, a gatehouse beside it. */
function inboundYard(kit: Kit): Object3D {
  const theme = kit.theme;
  const p = theme.props;
  const v = theme.vehicles;
  const roof = v.carrierCab;
  const wall = v.truckBody;
  const FLOOR = 0.3;
  const parts: Parts = [];
  parts.push(kit.box(14.8, FLOOR, 8.6, p.concrete, { z: -2.6, r: 0.1 }));

  // Canopy on posts with a low back wall.
  const CX = -2.2;
  const CZ = -2.7;
  const W = 9.6;
  const D = 7.4;
  for (const x of [CX - W / 2 + 0.3, CX, CX + W / 2 - 0.3]) {
    parts.push(kit.box(0.42, 3.9, 0.42, p.sign, { x, y: FLOOR, z: CZ - D / 2 + 0.3, r: 0.1 }));
    parts.push(kit.box(0.42, 3.3, 0.42, p.sign, { x, y: FLOOR, z: CZ + D / 2 - 0.3, r: 0.1 }));
    parts.push(kit.box(0.3, 0.3, D - 0.4, roof, { x, y: FLOOR + 3.35, z: CZ, rx: 0.085, r: 0.08 }));
  }
  parts.push(kit.box(W, 2.2, 0.3, wall, { x: CX, y: FLOOR, z: CZ - D / 2 + 0.2, r: 0.1 }));
  parts.push(kit.box(W + 0.1, 0.5, 0.36, p.rock, { x: CX, y: FLOOR, z: CZ - D / 2 + 0.2, r: 0.1 }));
  parts.push(kit.box(W + 0.9, 0.36, D + 1.1, roof, { x: CX, y: FLOOR + 3.62, z: CZ, rx: 0.085, r: 0.14 }));
  parts.push(kit.box(W + 0.9, 0.22, 0.24, p.sign, { x: CX, y: FLOOR + 3.3, z: CZ + D / 2 + 0.5, r: 0.06 }));
  parts.push(arrowSign(kit, CX, FLOOR + 4.25, CZ + D / 2 + 0.45, 0.8, roof, Math.PI));

  // Two shelf racks of raw materials.
  const raw = ['wood', 'ironOre', 'cotton', 'crudeOil', 'sand', 'grain', 'copperOre'].map((item) => itemColor(theme, item));
  [CX - 2.4, CX + 2.4].forEach((x, rack) => {
    const z = CZ - 2.4;
    for (const dx of [-1.55, 1.55]) parts.push(kit.box(0.16, 2.3, 0.9, p.darkMetal, { x: x + dx, y: FLOOR, z, r: 0.04 }));
    [0.05, 1.15].forEach((shelfY, shelf) => {
      parts.push(kit.box(3.1, 0.12, 1.0, p.metal, { x, y: FLOOR + shelfY, z, r: 0.03 }));
      for (let i = 0; i < 3; i += 1) {
        const color = raw[(rack * 3 + shelf * 2 + i) % raw.length]!;
        parts.push(kit.box(0.8, 0.74, 0.8, color, { x: x - 1.0 + i * 1.0, y: FLOOR + shelfY + 0.12, z, r: 0.08 }));
      }
    });
  });
  parts.push(pallet(kit, CX - 2.6, FLOOR, CZ + 1.6, [raw[0]!, raw[4]!, raw[2]!]));
  parts.push(pallet(kit, CX + 1.4, FLOOR, CZ + 2.0, [raw[5]!, raw[1]!]));
  parts.push(cone(kit, CX + W / 2 - 0.2, FLOOR, CZ + D / 2 + 0.2));
  parts.push(cone(kit, CX - W / 2 + 0.2, FLOOR, CZ + D / 2 + 0.2));

  // Gatehouse.
  const GX = 5.2;
  const GZ = -4.2;
  parts.push(kit.box(3.4, 2.7, 4.2, wall, { x: GX, y: FLOOR, z: GZ, r: 0.25 }));
  parts.push(kit.box(3.56, 0.5, 4.36, p.rock, { x: GX, y: FLOOR, z: GZ, r: 0.14 }));
  parts.push(flatRoof(kit, { cx: GX, cz: GZ, width: 3.4, depth: 4.2, top: FLOOR + 2.7, roof, cap: p.sign }));
  parts.push(framedWindow(kit, { face: 'front', along: GX + 0.6, wall: GZ + 2.1, y: FLOOR + 1.0, width: 1.5, sill: roof }));
  parts.push(framedWindow(kit, { face: 'left', along: GZ, wall: GX - 1.7, y: FLOOR + 1.0, width: 1.8, sill: roof }));
  parts.push(kit.box(0.9, 1.9, 0.14, roof, { x: GX - 1.0, y: FLOOR, z: GZ + 2.17, r: 0.07 }));
  parts.push(kit.box(0.3, 0.2, 0.16, kit.materials.lamp, { x: GX - 1.0, y: FLOOR + 2.1, z: GZ + 2.2, r: 0.06 }));
  parts.push(bush(kit, GX - 0.4, FLOOR - 0.05, GZ + 2.7));
  return kit.group(parts.flat());
}

/** Truck yard: a closed shipping warehouse with roller doors on a raised dock, and an office tower. */
function truckYard(kit: Kit): Object3D {
  const theme = kit.theme;
  const p = theme.props;
  const v = theme.vehicles;
  const roof = v.truckCab;
  const wall = v.truckBody;
  const FLOOR = 0.3;
  const parts: Parts = [];
  parts.push(kit.box(14.8, FLOOR, 8.6, p.concrete, { z: -2.6, r: 0.1 }));

  const CX = -2.0;
  const CZ = -3.4;
  const W = 9.6;
  const D = 6.0;
  const H = 3.5;
  const front = CZ + D / 2;
  parts.push(kit.box(W, H, D, wall, { x: CX, y: FLOOR, z: CZ, r: 0.25 }));
  parts.push(kit.box(W + 0.16, 0.55, D + 0.16, p.rock, { x: CX, y: FLOOR, z: CZ, r: 0.14 }));
  parts.push(kit.box(W + 0.1, 0.4, D + 0.1, roof, { x: CX, y: FLOOR + H - 0.9, z: CZ, r: 0.1 }));
  parts.push(flatRoof(kit, { cx: CX, cz: CZ, width: W, depth: D, top: FLOOR + H, roof, cap: p.sign }));
  // Raised loading dock with three doors and bumpers.
  parts.push(kit.box(W - 0.4, 0.5, 1.3, p.concrete, { x: CX, y: FLOOR, z: front + 0.6, r: 0.1 }));
  for (const dx of [-3.0, 0, 3.0]) {
    parts.push(rollerDoor(kit, { cx: CX + dx, wall: front, y: FLOOR + 0.5, width: 2.1, height: 1.9 }));
    for (const side of [-0.8, 0.8]) {
      parts.push(kit.box(0.26, 0.4, 0.2, p.tire, { x: CX + dx + side, y: FLOOR + 0.06, z: front + 1.28, r: 0.06 }));
    }
  }
  // Awning over the dock.
  parts.push(kit.box(W - 0.2, 0.2, 1.7, roof, { x: CX, y: FLOOR + 2.72, z: front + 0.8, rx: 0.14, r: 0.08 }));
  // Sign on the roof: an arrow leaving.
  parts.push(kit.box(0.2, 0.9, 0.2, p.darkMetal, { x: CX - 0.8, y: FLOOR + H + 0.3, z: CZ + 1.6 }));
  parts.push(kit.box(0.2, 0.9, 0.2, p.darkMetal, { x: CX + 0.8, y: FLOOR + H + 0.3, z: CZ + 1.6 }));
  parts.push(arrowSign(kit, CX, FLOOR + H + 1.9, CZ + 1.7, 0.95, roof, -Math.PI / 4));
  // Goods waiting on the dock.
  const goods = ['chair', 'bottle', 'snack', 'tools', 'giftSet', 'sofa'].map((item) => itemColor(theme, item));
  parts.push(pallet(kit, CX - 1.5, FLOOR + 0.5, front + 0.62, [goods[0]!, goods[1]!, goods[4]!]));
  parts.push(pallet(kit, CX + 1.5, FLOOR + 0.5, front + 0.62, [goods[2]!, goods[3]!]));
  // Rooftop vents.
  for (const dx of [-3.2, 3.2]) {
    parts.push(kit.cyl(0.34, 0.4, 0.6, p.metal, { x: CX + dx, y: FLOOR + H + 0.4, z: CZ - 1.4 }, 12));
    parts.push(kit.blob(0.5, 0.28, 0.5, p.metal, { x: CX + dx, y: FLOOR + H + 0.9, z: CZ - 1.4 }));
  }

  // Office tower.
  const OX = 5.3;
  const OZ = -4.4;
  const OH = 5.0;
  parts.push(kit.box(3.3, OH, 3.8, wall, { x: OX, y: FLOOR, z: OZ, r: 0.25 }));
  parts.push(kit.box(3.46, 0.55, 3.96, p.rock, { x: OX, y: FLOOR, z: OZ, r: 0.14 }));
  parts.push(flatRoof(kit, { cx: OX, cz: OZ, width: 3.3, depth: 3.8, top: FLOOR + OH, roof, cap: p.sign }));
  for (const y of [FLOOR + 1.0, FLOOR + 3.0]) {
    parts.push(framedWindow(kit, { face: 'front', along: OX, wall: OZ + 1.9, y, width: 2.2, sill: roof }));
    parts.push(framedWindow(kit, { face: 'left', along: OZ, wall: OX - 1.65, y, width: 2.0, sill: roof }));
  }
  parts.push(kit.cyl(0.05, 0.05, 1.6, p.darkMetal, { x: OX + 0.9, y: FLOOR + OH + 0.4, z: OZ - 1.0 }, 6));
  parts.push(kit.box(0.9, 0.5, 0.05, roof, { x: OX + 1.38, y: FLOOR + OH + 1.45, z: OZ - 1.0, r: 0.02 }));
  parts.push(bush(kit, OX - 0.6, FLOOR - 0.05, OZ + 2.5));
  parts.push(cone(kit, CX + W / 2 + 0.5, FLOOR, front + 0.4));
  return kit.group(parts.flat());
}

/** Dock: a quay with a tower crane reaching over the water, containers, and a harbour office with a light. */
function dock(kit: Kit): Object3D {
  const theme = kit.theme;
  const p = theme.props;
  const v = theme.vehicles;
  const FLOOR = 0.3;
  const parts: Parts = [];
  parts.push(kit.box(14.8, FLOOR, 8.6, p.concrete, { z: -2.6, r: 0.1 }));
  // Wooden pier along the water, with bollards.
  parts.push(kit.box(15.6, 0.3, 5.6, p.wood, { y: -0.26, z: 4.3, r: 0.08 }));
  for (let i = 0; i < 6; i += 1) {
    const x = -7.2 + i * 2.88;
    parts.push(kit.cyl(0.3, 0.3, 2.0, p.trunk, { x, y: -1.5, z: 7.0 }, 10));
    parts.push(kit.cyl(0.22, 0.26, 0.5, p.darkMetal, { x, y: 0.02, z: 6.5 }, 10));
    parts.push(kit.cyl(0.3, 0.3, 0.12, v.shipHull, { x, y: 0.5, z: 6.5 }, 10));
  }

  // Tower crane: base, lattice-free chunky tower, cabin, jib over the water, a crate on the hook.
  const TX = -5.4;
  const TZ = 0.9;
  parts.push(kit.box(2.0, 0.5, 2.0, p.rock, { x: TX, y: FLOOR, z: TZ, r: 0.14 }));
  parts.push(kit.box(0.8, 6.6, 0.8, p.hazard, { x: TX, y: FLOOR + 0.4, z: TZ, r: 0.16 }));
  for (const y of [2.2, 4.0, 5.8]) parts.push(kit.box(0.92, 0.2, 0.92, p.sign, { x: TX, y: FLOOR + y, z: TZ, r: 0.06 }));
  parts.push(kit.box(1.5, 1.2, 1.5, v.shipCabin, { x: TX, y: FLOOR + 6.0, z: TZ - 0.1, r: 0.25 }));
  parts.push(kit.box(1.56, 0.5, 0.9, p.glass, { x: TX, y: FLOOR + 6.5, z: TZ + 0.25, r: 0.08 }));
  parts.push(kit.box(0.55, 0.5, 9.0, p.hazard, { x: TX, y: FLOOR + 7.2, z: TZ + 2.4, r: 0.14 }));
  parts.push(kit.box(1.1, 0.9, 1.3, p.darkMetal, { x: TX, y: FLOOR + 6.9, z: TZ - 1.9, r: 0.14 }));
  parts.push(kit.box(0.3, 1.4, 0.3, p.hazard, { x: TX, y: FLOOR + 7.5, z: TZ, r: 0.08 }));
  parts.push(kit.cyl(0.04, 0.04, 3.4, p.darkMetal, { x: TX, y: FLOOR + 3.9, z: TZ + 5.6 }, 6));
  parts.push(kit.box(0.5, 0.2, 0.5, p.darkMetal, { x: TX, y: FLOOR + 3.75, z: TZ + 5.6, r: 0.05 }));
  parts.push(kit.box(1.1, 1.0, 1.1, itemColor(theme, 'giftSet'), { x: TX, y: FLOOR + 2.75, z: TZ + 5.6, r: 0.1 }));

  // Containers stacked on the quay.
  const colors = [v.shipStripe, v.shipHull, p.houseRoofs[2] ?? v.shipStripe, p.hazard];
  const CZ = -5.0;
  [
    [-1.2, 0, 0],
    [1.9, 0, 1],
    [0.3, 1.24, 2],
    [-1.2, 0, 3],
  ].forEach(([x, y, color], index) => {
    const z = index === 3 ? CZ + 1.7 : CZ;
    parts.push(kit.box(2.9, 1.2, 1.4, colors[color!]!, { x, y: FLOOR + y!, z, r: 0.1 }));
    for (const dx of [-0.9, 0, 0.9]) parts.push(kit.box(0.08, 1.0, 1.44, p.sign, { x: x! + dx, y: FLOOR + y! + 0.1, z, r: 0.02 }));
  });

  // Harbour office with a light on top and a life ring by the door.
  const OX = 4.9;
  const OZ = -4.4;
  parts.push(kit.box(4.0, 2.7, 3.8, v.shipCabin, { x: OX, y: FLOOR, z: OZ, r: 0.25 }));
  parts.push(kit.box(4.16, 0.55, 3.96, p.rock, { x: OX, y: FLOOR, z: OZ, r: 0.14 }));
  parts.push(flatRoof(kit, { cx: OX, cz: OZ, width: 4.0, depth: 3.8, top: FLOOR + 2.7, roof: v.shipStripe, cap: p.sign }));
  parts.push(framedWindow(kit, { face: 'front', along: OX + 0.8, wall: OZ + 1.9, y: FLOOR + 1.0, width: 1.6, sill: v.shipStripe }));
  parts.push(framedWindow(kit, { face: 'left', along: OZ, wall: OX - 2.0, y: FLOOR + 1.0, width: 1.8, sill: v.shipStripe }));
  parts.push(kit.box(0.9, 1.9, 0.14, v.shipStripe, { x: OX - 1.1, y: FLOOR, z: OZ + 1.98, r: 0.07 }));
  parts.push(kit.cyl(0.3, 0.3, 0.12, v.shipHull, { x: OX - 0.32, y: FLOOR + 1.5, z: OZ + 1.95, rx: HALF_PI }, 18));
  parts.push(kit.cyl(0.16, 0.16, 0.2, v.shipCabin, { x: OX - 0.32, y: FLOOR + 1.45, z: OZ + 1.95, rx: HALF_PI }, 18));
  const LX = OX + 0.9;
  const LZ = OZ - 0.7;
  const top = FLOOR + 3.1;
  parts.push(kit.cyl(0.62, 0.82, 2.2, v.shipCabin, { x: LX, y: top, z: LZ }, 18));
  parts.push(kit.cyl(0.72, 0.76, 0.5, v.shipHull, { x: LX, y: top + 0.8, z: LZ }, 18));
  parts.push(kit.cyl(0.9, 0.9, 0.16, p.sign, { x: LX, y: top + 2.2, z: LZ }, 18));
  parts.push(kit.cyl(0.5, 0.5, 0.7, kit.materials.lamp, { x: LX, y: top + 2.36, z: LZ }, 14));
  parts.push(kit.cone(0.75, 0.6, v.shipHull, { x: LX, y: top + 3.06, z: LZ }, 18));
  return kit.group(parts.flat(), { smoke: [] });
}

/** Airport: a round-roofed hangar with a plane badge, a control tower, a radar and a windsock. */
function airport(kit: Kit): Object3D {
  const theme = kit.theme;
  const p = theme.props;
  const v = theme.vehicles;
  const FLOOR = 0.3;
  const parts: Parts = [];
  parts.push(kit.box(14.8, FLOOR, 8.6, p.concrete, { z: -2.6, r: 0.1 }));

  // Hangar.
  const CX = -2.6;
  const CZ = -3.3;
  const W = 8.8;
  const D = 6.4;
  const H = 2.6;
  const front = CZ + D / 2;
  parts.push(kit.box(W, H, D, v.planeBody, { x: CX, y: FLOOR, z: CZ, r: 0.25 }));
  parts.push(kit.box(W + 0.16, 0.55, D + 0.16, p.rock, { x: CX, y: FLOOR, z: CZ, r: 0.14 }));
  parts.push(kit.box(W + 0.5, 0.3, D + 0.7, p.sign, { x: CX, y: FLOOR + H - 0.1, z: CZ, r: 0.1 }));
  parts.push(kit.barrel(W + 0.3, 2.3, D + 0.5, v.planeAccent, { x: CX, y: FLOOR + H + 0.15, z: CZ }));
  for (const dx of [-2.9, 0, 2.9]) parts.push(kit.barrel(0.3, 2.38, D + 0.66, p.sign, { x: CX + dx, y: FLOOR + H + 0.15, z: CZ }));
  // Wide door, half open, dark inside.
  parts.push(kit.box(6.4, 2.25, 0.12, p.sign, { x: CX, y: FLOOR, z: front + 0.06, r: 0.06 }));
  parts.push(kit.box(6.0, 2.05, 0.14, p.tire, { x: CX, y: FLOOR, z: front + 0.09, r: 0.06 }));
  for (const dx of [-2.1, 2.1]) {
    parts.push(kit.box(1.9, 2.05, 0.16, p.door, { x: CX + dx, y: FLOOR, z: front + 0.14, r: 0.06 }));
    parts.push(kit.box(1.5, 0.5, 0.24, kit.materials.window, { x: CX + dx, y: FLOOR + 1.2, z: front + 0.14, r: 0.05 }));
  }
  // Plane badge on the gable of the round roof.
  const BY = FLOOR + H + 1.05;
  const BZ = front + 0.3;
  parts.push(kit.cyl(0.95, 0.95, 0.1, p.sign, { x: CX, y: BY - 0.05, z: BZ - 0.02, rx: HALF_PI }, 28));
  parts.push(kit.cyl(0.8, 0.8, 0.14, v.planeAccent, { x: CX, y: BY - 0.07, z: BZ, rx: HALF_PI }, 28));
  const plane = kit.group([
    kit.box(0.22, 1.1, 0.1, p.sign, { y: -0.55, z: 0.08, r: 0.1 }),
    kit.box(1.15, 0.26, 0.1, p.sign, { y: -0.08, z: 0.08, r: 0.08 }),
    kit.box(0.5, 0.18, 0.1, p.sign, { y: -0.5, z: 0.08, r: 0.06 }),
  ]);
  plane.position.set(CX, BY, BZ);
  plane.rotation.z = -Math.PI / 4;
  parts.push(plane);

  // Control tower.
  const TX = 5.3;
  const TZ = -4.4;
  parts.push(kit.box(2.6, 1.6, 2.6, v.planeBody, { x: TX, y: FLOOR, z: TZ, r: 0.25 }));
  parts.push(kit.box(2.76, 0.5, 2.76, p.rock, { x: TX, y: FLOOR, z: TZ, r: 0.14 }));
  parts.push(kit.cyl(0.8, 1.0, 4.4, v.planeBody, { x: TX, y: FLOOR + 1.5, z: TZ }, 18));
  parts.push(kit.cyl(0.84, 0.9, 0.4, v.planeAccent, { x: TX, y: FLOOR + 3.2, z: TZ }, 18));
  parts.push(kit.cyl(1.5, 1.2, 0.3, p.sign, { x: TX, y: FLOOR + 5.8, z: TZ }, 18));
  parts.push(kit.cyl(1.55, 1.3, 1.1, kit.materials.window, { x: TX, y: FLOOR + 6.1, z: TZ }, 18));
  parts.push(kit.cyl(1.75, 1.75, 0.3, v.planeAccent, { x: TX, y: FLOOR + 7.2, z: TZ }, 18));
  parts.push(kit.cyl(0.05, 0.05, 1.1, p.darkMetal, { x: TX, y: FLOOR + 7.5, z: TZ }, 6));
  parts.push(kit.blob(0.16, 0.16, 0.16, kit.materials.lamp, { x: TX, y: FLOOR + 8.55, z: TZ }));
  parts.push(framedWindow(kit, { face: 'front', along: TX, wall: TZ + 1.3, y: FLOOR + 0.6, width: 1.5, height: 0.9, sill: v.planeAccent }));
  // Radar dish beside the tower.
  parts.push(kit.cyl(0.12, 0.16, 1.2, p.darkMetal, { x: TX + 0.2, y: FLOOR, z: TZ + 2.7 }, 8));
  parts.push(kit.dome(0.85, 0.36, 0.85, p.sign, { x: TX + 0.2, y: FLOOR + 1.6, z: TZ + 2.7, rx: Math.PI * 0.82 }));

  // Baggage cart with crates, and a windsock at the corner of the apron.
  const goods = ['appliance', 'eBike', 'smartHomeSet'].map((item) => itemColor(theme, item));
  parts.push(pallet(kit, CX + W / 2 + 0.9, FLOOR, front - 0.6, goods));
  parts.push(kit.cyl(0.07, 0.09, 3.0, p.lampPole, { x: 7.3, z: 6.5 }, 8));
  parts.push(kit.cone(0.28, 1.1, p.hazard, { x: 6.75, y: 2.6, z: 6.5, rz: HALF_PI }, 10));
  parts.push(kit.cyl(0.3, 0.3, 0.1, p.sign, { x: 7.3, y: 2.83, z: 6.5, rz: HALF_PI }, 10));
  for (const x of [-7.3, -3.6, 0, 3.6]) parts.push(kit.blob(0.14, 0.12, 0.14, kit.materials.lamp, { x, y: 0, z: 6.6 }));
  return kit.group(parts.flat());
}

export function registerFacilityModels(registry: ModelRegistry): void {
  registry.register('facility.inboundYard', inboundYard);
  registry.register('facility.truckYard', truckYard);
  registry.register('facility.dock', dock);
  registry.register('facility.airport', airport);
  registry.register('facility.default', truckYard);
}
