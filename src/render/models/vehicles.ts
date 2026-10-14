/**
 * Primitive-built vehicles. All of them drive towards +z and stand on y = 0
 * (the ship floats with its waterline near y = 0).
 */
import type { Mesh, Object3D } from 'three';
import type { ModelRegistry } from '../ModelRegistry';
import type { Kit, Paint } from './kit';

/** Chunky wheel for the hand-drawn vehicles: tyre, pale rim and a coloured cap. Axle along x, centred at (x, radius, z). */
function toyWheel(kit: Kit, radius: number, width: number, x: number, z: number, cap: Paint): Mesh[] {
  const side = Math.sign(x) || 1;
  const p = kit.theme.props;
  const disc = (r: number, w: number, paint: Paint, shift: number): Mesh =>
    kit.cyl(r, r, w, paint, { x: x + side * shift, y: radius - w / 2, z, rz: Math.PI / 2 }, 18);
  return [
    disc(radius, width, p.tire, 0),
    disc(radius * 0.62, width * 0.5, p.sign, width * 0.34),
    disc(radius * 0.26, width * 0.5, cap, width * 0.44),
  ];
}

/**
 * Box truck, drawn by hand as the style sample for vehicles (PLAN.md stage 5):
 * short and tall like a toy, a round cab with a wind deflector, a cream cargo
 * box with a coloured band and a crate badge, a roll-up door at the back.
 */
function boxTruck(kit: Kit): Object3D {
  const v = kit.theme.vehicles;
  const p = kit.theme.props;
  const light = kit.materials.headlight;
  const HALF_PI = Math.PI / 2;
  const parts: Object3D[] = [];

  // Frame, fuel tanks and the step under each door.
  parts.push(kit.box(1.6, 0.3, 5.3, p.darkMetal, { y: 0.42, z: -0.05, r: 0.1 }));
  for (const x of [-0.92, 0.92]) {
    parts.push(kit.cyl(0.24, 0.24, 0.85, p.metal, { x, y: 0.5 - 0.425, z: 0.25, rx: HALF_PI }, 12));
    parts.push(kit.box(0.3, 0.1, 0.7, p.darkMetal, { x: x * 1.12, y: 0.42, z: 1.75, r: 0.04 }));
  }

  // Cargo box: cream shell, coloured band, roof ribs.
  const BOX_Z = -0.92;
  const BOX_LEN = 3.7;
  const BOX_TOP = 3.05;
  parts.push(kit.box(2.3, 2.3, BOX_LEN, v.truckBody, { y: BOX_TOP - 2.3, z: BOX_Z, r: 0.3 }));
  parts.push(kit.box(2.34, 0.55, BOX_LEN - 0.3, v.truckCab, { y: 0.98, z: BOX_Z, r: 0.12 }));
  parts.push(kit.box(2.1, 0.16, BOX_LEN + 0.04, p.darkMetal, { y: 0.66, z: BOX_Z, r: 0.06 }));
  for (const dz of [-1.1, 0, 1.1]) parts.push(kit.box(1.9, 0.07, 0.22, p.sign, { y: BOX_TOP - 0.02, z: BOX_Z + dz, r: 0.03 }));
  // Badge on both sides: a little crate on a round plate.
  for (const side of [-1, 1]) {
    const x = side * 1.15;
    parts.push(kit.cyl(0.52, 0.52, 0.06, v.carrierCab, { x, y: 2.15 - 0.03, z: BOX_Z, rz: HALF_PI }, 24));
    parts.push(kit.box(0.08, 0.46, 0.5, p.wood, { x: x + side * 0.03, y: 1.92, z: BOX_Z, r: 0.03 }));
    parts.push(kit.box(0.1, 0.1, 0.52, p.sign, { x: x + side * 0.035, y: 2.1, z: BOX_Z, r: 0.02 }));
  }
  // Roll-up door, bumper and tail lights at the back.
  const back = BOX_Z - BOX_LEN / 2;
  parts.push(kit.box(1.75, 1.75, 0.12, p.sign, { y: 0.95, z: back - 0.01, r: 0.08 }));
  for (const y of [1.3, 1.7, 2.1]) parts.push(kit.box(1.6, 0.06, 0.14, p.door, { y, z: back - 0.02, r: 0.02 }));
  parts.push(kit.box(0.4, 0.1, 0.16, p.darkMetal, { y: 1.05, z: back - 0.04, r: 0.04 }));
  parts.push(kit.box(2.2, 0.22, 0.3, p.darkMetal, { y: 0.4, z: back - 0.02, r: 0.08 }));
  for (const x of [-0.95, 0.95]) {
    parts.push(kit.box(0.22, 0.34, 0.1, light, { x, y: 0.72, z: back - 0.02, r: 0.05 }));
    parts.push(kit.box(0.5, 0.42, 0.06, p.tire, { x, y: 0.2, z: -2.25, r: 0.02 }));
  }

  // Cab: round shell, wrap-around glass, grille, bumper, mirrors.
  const CAB_Z = 1.95;
  parts.push(kit.box(2.2, 1.95, 1.7, v.truckCab, { y: 0.55, z: CAB_Z, r: 0.45 }));
  parts.push(kit.box(1.8, 0.78, 0.3, p.glass, { y: 1.5, z: CAB_Z + 0.72, r: 0.12 }));
  parts.push(kit.box(2.24, 0.72, 0.85, p.glass, { y: 1.53, z: CAB_Z + 0.12, r: 0.12 }));
  parts.push(kit.box(2.26, 0.74, 0.12, v.truckCab, { y: 1.52, z: CAB_Z - 0.38, r: 0.04 }));
  parts.push(kit.box(1.25, 0.36, 0.14, p.sign, { y: 0.88, z: CAB_Z + 0.82, r: 0.08 }));
  for (const y of [0.97, 1.09]) parts.push(kit.box(1.05, 0.04, 0.22, p.door, { y, z: CAB_Z + 0.82, r: 0.01 }));
  parts.push(kit.box(2.3, 0.3, 0.42, p.sign, { y: 0.4, z: CAB_Z + 0.72, r: 0.13 }));
  for (const x of [-0.82, 0.82]) {
    parts.push(kit.cyl(0.19, 0.19, 0.12, light, { x, y: 1.06 - 0.06, z: CAB_Z + 0.83, rx: HALF_PI }, 14));
    parts.push(kit.box(0.26, 0.05, 0.05, p.darkMetal, { x: x * 1.45, y: 1.78, z: CAB_Z + 0.5 }));
    parts.push(kit.box(0.1, 0.44, 0.26, p.darkMetal, { x: x * 1.62, y: 1.5, z: CAB_Z + 0.5, r: 0.04 }));
    parts.push(kit.box(0.05, 0.07, 0.26, p.sign, { x: x * 1.36, y: 1.28, z: CAB_Z - 0.05, r: 0.02 }));
  }
  // Wind deflector up to the box roof, with three marker lights.
  parts.push(kit.box(1.9, 0.4, 1.0, v.truckCab, { y: 2.4, z: CAB_Z - 0.42, rx: 0.5, r: 0.18 }));
  for (const x of [-0.5, 0, 0.5]) parts.push(kit.box(0.16, 0.08, 0.12, p.hazard, { x, y: 2.48, z: CAB_Z + 0.5, r: 0.03 }));

  // Wheels under arches.
  const FRONT_Z = 1.85;
  const REAR_Z = -1.6;
  for (const x of [-0.98, 0.98]) {
    parts.push(kit.barrel(0.36, 0.66, 1.42, v.truckCab, { x, y: 0.5, z: FRONT_Z }));
    parts.push(kit.barrel(0.3, 0.66, 1.42, p.darkMetal, { x, y: 0.5, z: REAR_Z }));
    parts.push(...toyWheel(kit, 0.5, 0.44, x, FRONT_Z, v.truckCab));
    parts.push(...toyWheel(kit, 0.5, 0.44, x, REAR_Z, v.truckCab));
  }
  return kit.group(parts);
}

/** Cab and wheels shared by the carrier and the waste tanker: everything but what rides on the back. */
function carrierFront(kit: Kit, cab: Paint): Object3D[] {
  const p = kit.theme.props;
  const light = kit.materials.headlight;
  const HALF_PI = Math.PI / 2;
  const parts: Object3D[] = [];
  // Cab.
  const CAB_Z = 1.12;
  parts.push(kit.box(1.8, 1.45, 1.2, cab, { y: 0.48, z: CAB_Z, r: 0.36 }));
  parts.push(kit.box(1.44, 0.56, 0.26, p.glass, { y: 1.18, z: CAB_Z + 0.5, r: 0.1 }));
  parts.push(kit.box(1.84, 0.5, 0.58, p.glass, { y: 1.21, z: CAB_Z + 0.08, r: 0.1 }));
  parts.push(kit.box(1.0, 0.24, 0.12, p.sign, { y: 0.72, z: CAB_Z + 0.58, r: 0.06 }));
  parts.push(kit.box(1.86, 0.24, 0.32, p.sign, { y: 0.36, z: CAB_Z + 0.52, r: 0.1 }));
  parts.push(kit.box(0.5, 0.1, 0.3, p.hazard, { y: 1.92, z: CAB_Z - 0.1, r: 0.05 }));
  for (const x of [-0.64, 0.64]) {
    parts.push(kit.cyl(0.15, 0.15, 0.1, light, { x, y: 0.86 - 0.05, z: CAB_Z + 0.59, rx: HALF_PI }, 12));
    parts.push(kit.box(0.24, 0.05, 0.05, p.darkMetal, { x: x * 1.5, y: 1.42, z: CAB_Z + 0.36 }));
    parts.push(kit.box(0.08, 0.3, 0.2, p.darkMetal, { x: x * 1.62, y: 1.2, z: CAB_Z + 0.36, r: 0.03 }));
  }

  // Wheels under arches.
  const FRONT_Z = 1.05;
  const REAR_Z = -1.05;
  for (const x of [-0.8, 0.8]) {
    parts.push(kit.barrel(0.26, 0.5, 1.08, cab, { x, y: 0.38, z: FRONT_Z }));
    parts.push(kit.barrel(0.26, 0.5, 1.08, p.darkMetal, { x, y: 0.38, z: REAR_Z }));
    parts.push(...toyWheel(kit, 0.38, 0.36, x, FRONT_Z, cab));
    parts.push(...toyWheel(kit, 0.38, 0.36, x, REAR_Z, cab));
  }
  return parts;
}

/**
 * Carrier: the little flatbed that shuttles goods around the estate. Same toy
 * look as the box truck, one size down: round cab, cream bed with slatted rails.
 */
function carrier(kit: Kit): Object3D {
  // The cab is body paint: the game colours each carrier by its owner and goods.
  const cab: Paint = kit.materials.paint;
  const v = { ...kit.theme.vehicles, carrierCab: cab };
  const p = kit.theme.props;
  const light = kit.materials.headlight;
  const HALF_PI = Math.PI / 2;
  const cargo: Array<[number, number, number]> = [];
  for (const y of [0.9, 1.7]) {
    for (const z of [-0.25, -1.1]) {
      for (const x of [-0.42, 0.42]) cargo.push([x, y, z]);
    }
  }
  const parts: Object3D[] = [];
  parts.push(kit.box(1.3, 0.26, 3.4, p.darkMetal, { y: 0.36, z: -0.1, r: 0.09 }));

  // Bed: a thick cream deck, rails on posts, a tailgate with a coloured band.
  const BED_Z = -0.68;
  const BED_LEN = 2.25;
  parts.push(kit.box(1.9, 0.24, BED_LEN, v.carrierBed, { y: 0.62, z: BED_Z, r: 0.09 }));
  for (const x of [-0.87, 0.87]) {
    parts.push(kit.box(0.1, 0.12, BED_LEN - 0.1, v.carrierCab, { x, y: 1.12, z: BED_Z, r: 0.04 }));
    parts.push(kit.box(0.08, 0.1, BED_LEN - 0.1, p.sign, { x, y: 0.94, z: BED_Z, r: 0.03 }));
    for (const dz of [-0.95, -0.32, 0.32, 0.95]) {
      parts.push(kit.box(0.1, 0.42, 0.1, v.carrierCab, { x, y: 0.82, z: BED_Z + dz, r: 0.03 }));
    }
  }
  const back = BED_Z - BED_LEN / 2;
  parts.push(kit.box(1.82, 0.46, 0.12, v.carrierBed, { y: 0.84, z: back, r: 0.05 }));
  parts.push(kit.box(1.5, 0.16, 0.14, v.carrierCab, { y: 0.99, z: back - 0.03, r: 0.04 }));
  parts.push(kit.box(1.8, 0.16, 0.2, p.darkMetal, { y: 0.34, z: back + 0.02, r: 0.06 }));
  for (const x of [-0.72, 0.72]) parts.push(kit.box(0.2, 0.14, 0.08, light, { x, y: 0.62, z: back - 0.03, r: 0.04 }));
  // Headboard between the cab and the load.
  parts.push(kit.box(1.8, 0.75, 0.1, v.carrierCab, { y: 0.84, z: BED_Z + BED_LEN / 2 - 0.08, r: 0.05 }));

  parts.push(...carrierFront(kit, v.carrierCab));
  return kit.group(parts, { cargo, cargoScale: [[1, 1, 1]] });
}

/**
 * Waste tanker: the carrier's cab on the same chassis, with a round tank lying
 * on the back instead of the bed, a band in the body paint round its middle,
 * a hatch on top and a valve at the back. Painted by owner like the carrier.
 */
function wasteTanker(kit: Kit): Object3D {
  const cab: Paint = kit.materials.paint;
  const v = kit.theme.vehicles;
  const p = kit.theme.props;
  const HALF_PI = Math.PI / 2;
  const parts: Object3D[] = [];
  parts.push(kit.box(1.3, 0.26, 3.4, p.darkMetal, { y: 0.36, z: -0.1, r: 0.09 }));

  const TANK_Z = -0.68;
  const TANK_LEN = 1.9;
  const R = 0.74;
  const MID = 0.62 + R + 0.06;
  // Two saddles on the chassis hold the tank.
  for (const dz of [-0.6, 0.6]) parts.push(kit.box(1.5, 0.36, 0.26, p.darkMetal, { y: 0.5, z: TANK_Z + dz, r: 0.06 }));
  parts.push(kit.cyl(R, R, TANK_LEN, v.carrierBed, { y: MID - TANK_LEN / 2, z: TANK_Z, rx: HALF_PI }, 24));
  for (const end of [-1, 1]) {
    parts.push(kit.blob(R, R, 0.26, v.carrierBed, { y: MID - R, z: TANK_Z + end * (TANK_LEN / 2) }));
  }
  for (const dz of [-0.45, 0.45]) parts.push(kit.cyl(R + 0.05, R + 0.05, 0.16, cab, { y: MID - 0.08, z: TANK_Z + dz, rx: HALF_PI }, 24));
  // Hatch on top, valve and tail lights at the back.
  parts.push(kit.cyl(0.26, 0.28, 0.16, p.darkMetal, { y: MID + R - 0.06, z: TANK_Z + 0.2 }, 14));
  parts.push(kit.cyl(0.18, 0.18, 0.06, p.metal, { y: MID + R + 0.1, z: TANK_Z + 0.2 }, 14));
  const back = TANK_Z - TANK_LEN / 2 - 0.24;
  parts.push(kit.cyl(0.09, 0.09, 0.34, p.darkMetal, { y: 0.7 - 0.17, z: back - 0.02, rx: HALF_PI }, 10));
  parts.push(kit.cyl(0.13, 0.13, 0.06, p.hazard, { y: 0.7 - 0.03, z: back - 0.2, rx: HALF_PI }, 12));
  parts.push(kit.box(1.8, 0.16, 0.2, p.darkMetal, { y: 0.34, z: -1.82, r: 0.06 }));
  for (const x of [-0.72, 0.72]) parts.push(kit.box(0.2, 0.14, 0.08, kit.materials.headlight, { x, y: 0.4, z: -1.93, r: 0.04 }));

  parts.push(...carrierFront(kit, cab));
  return kit.group(parts);
}

/** Forklift: a stubby truck with a roll cage, a mast and two forks, its body painted by the game. */
function forklift(kit: Kit): Object3D {
  // The body is paint: the game colours each forklift by its owner and goods, like the carrier.
  const body: Paint = kit.materials.paint;
  const p = kit.theme.props;
  const parts: Object3D[] = [];
  // Body, counterweight and seat.
  parts.push(kit.box(1.2, 0.8, 1.6, body, { y: 0.22, z: -0.25, r: 0.28 }));
  parts.push(kit.box(1.1, 0.6, 0.55, p.darkMetal, { y: 0.28, z: -1.0, r: 0.2 }));
  parts.push(kit.box(0.62, 0.16, 0.56, p.tire, { y: 1.0, z: -0.42, r: 0.07 }));
  parts.push(kit.box(0.62, 0.6, 0.14, p.tire, { y: 1.06, z: -0.72, r: 0.06 }));
  parts.push(kit.cyl(0.03, 0.03, 0.5, p.darkMetal, { y: 1.0, z: 0.2, rx: -0.5 }, 6));
  parts.push(kit.cyl(0.2, 0.2, 0.05, p.tire, { y: 1.42, z: 0.1, rx: 1.07 }, 12));
  // Roll cage.
  for (const x of [-0.52, 0.52]) {
    // The posts start inside the body: its shoulders are rounded, so posts set on top of it would hang in the air.
    for (const z of [0.36, -0.86]) parts.push(kit.box(0.1, 1.66, 0.1, p.darkMetal, { x: x * 0.92, y: 0.52, z, r: 0.03 }));
  }
  parts.push(kit.box(1.2, 0.1, 1.5, body, { y: 2.14, z: -0.24, r: 0.05 }));
  // Warning beacon on the roof, work lights at the front, a tail light on the counterweight.
  const light = kit.materials.headlight;
  parts.push(kit.cyl(0.15, 0.17, 0.08, p.darkMetal, { y: 2.24, z: -0.6 }, 12));
  parts.push(kit.dome(0.14, 0.2, 0.14, light, { y: 2.32, z: -0.6 }));
  for (const x of [-0.42, 0.42]) parts.push(kit.box(0.2, 0.14, 0.12, light, { x, y: 2.0, z: 0.5, r: 0.04 }));
  parts.push(kit.box(0.5, 0.12, 0.08, light, { y: 0.6, z: -1.27, r: 0.04 }));
  // Mast, carriage and forks.
  for (const x of [-0.36, 0.36]) {
    parts.push(kit.box(0.14, 2.3, 0.14, p.darkMetal, { x, y: 0.08, z: 0.66, r: 0.03 }));
    parts.push(kit.box(0.16, 0.07, 1.1, p.metal, { x: x * 0.85, y: 0.14, z: 1.3, r: 0.03 }));
    parts.push(kit.box(0.16, 0.5, 0.08, p.metal, { x: x * 0.85, y: 0.14, z: 0.79, r: 0.03 }));
  }
  parts.push(kit.box(0.9, 0.14, 0.14, p.darkMetal, { y: 2.3, z: 0.66, r: 0.03 }));
  parts.push(kit.box(0.9, 0.12, 0.1, p.darkMetal, { y: 0.5, z: 0.76, r: 0.03 }));
  for (const x of [-0.6, 0.6]) {
    parts.push(...toyWheel(kit, 0.32, 0.26, x, 0.32, body));
    parts.push(...toyWheel(kit, 0.25, 0.22, x * 0.92, -0.85, body));
  }
  return kit.group(parts, { cargo: [[0, 0.22, 1.3]] });
}

/**
 * Cargo ship: a round-shouldered hull with a pointed bow, containers stacked on
 * deck, a two-storey bridge with a funnel at the stern. Floats with its
 * waterline near y = 0 and sails towards +z.
 */
function cargoShip(kit: Kit): Object3D {
  const v = kit.theme.vehicles;
  const p = kit.theme.props;
  const HALF_PI = Math.PI / 2;
  const cargo: Array<[number, number, number]> = [];
  for (const y of [1.5, 3.14]) {
    for (const z of [3.8, 1.9, 0, -1.9, -3.8]) {
      for (const x of [-1.8, 0, 1.8]) cargo.push([x, y, z]);
    }
  }
  const parts: Object3D[] = [];
  const DECK = 1.4;
  // Hull, bow, waterline band, deck.
  parts.push(kit.box(7, 2.4, 16, v.shipHull, { y: -1.0, z: -1.5, r: 0.9 }));
  parts.push(kit.box(4.95, 2.4, 4.95, v.shipHull, { y: -1.0, z: 6.4, ry: Math.PI / 4, r: 0.7 }));
  parts.push(kit.box(7.1, 0.5, 15.2, p.sign, { y: 0.35, z: -1.5, r: 0.22 }));
  parts.push(kit.box(5.0, 0.5, 5.0, p.sign, { y: 0.35, z: 6.4, ry: Math.PI / 4, r: 0.22 }));
  parts.push(kit.box(6.3, 0.2, 15.2, v.shipDeck, { y: DECK - 0.12, z: -1.5, r: 0.08 }));
  parts.push(kit.box(4.3, 0.2, 4.3, v.shipDeck, { y: DECK - 0.12, z: 6.3, ry: Math.PI / 4, r: 0.08 }));
  // Railings along both sides.
  for (const x of [-3.2, 3.2]) {
    parts.push(kit.box(0.1, 0.1, 10.6, p.sign, { x, y: DECK + 0.62, z: 0.6, r: 0.04 }));
    for (let i = 0; i < 6; i += 1) parts.push(kit.box(0.1, 0.62, 0.1, p.sign, { x, y: DECK + 0.04, z: -4.5 + i * 2.04, r: 0.03 }));
  }
  // Containers on deck, in two layers.
  const colors = [v.shipStripe, p.houseRoofs[2] ?? v.shipStripe, p.hazard, p.houseRoofs[4] ?? v.shipHull, p.houseRoofs[3] ?? v.shipStripe];
  let n = 0;
  for (const z of [4.0, 1.15, -1.7]) {
    for (const x of [-1.45, 1.45]) {
      const layers = (n + (z > 3 ? 1 : 0)) % 3 === 0 ? 1 : 2;
      for (let layer = 0; layer < layers; layer += 1) {
        const color = colors[(n + layer * 2) % colors.length]!;
        const y = DECK + 0.06 + layer * 1.24;
        parts.push(kit.box(2.6, 1.2, 2.5, color, { x, y, z, r: 0.1 }));
        for (const dz of [-0.75, 0, 0.75]) parts.push(kit.box(2.68, 1.0, 0.1, p.sign, { x, y: y + 0.1, z: z + dz, r: 0.03 }));
      }
      n += 1;
    }
  }
  // Bridge at the stern: two storeys, wrap-around glass, a coloured roof.
  const BZ = -7.2;
  parts.push(kit.box(5.4, 1.5, 3.4, v.shipCabin, { y: DECK, z: BZ, r: 0.35 }));
  parts.push(kit.box(5.48, 0.3, 3.48, v.shipStripe, { y: DECK + 0.1, z: BZ, r: 0.1 }));
  for (const x of [-1.6, 0, 1.6]) parts.push(kit.cyl(0.28, 0.28, 0.14, kit.materials.window, { x, y: DECK + 0.95 - 0.07, z: BZ + 1.7, rx: HALF_PI }, 14));
  parts.push(kit.box(4.4, 1.5, 2.6, v.shipCabin, { y: DECK + 1.45, z: BZ - 0.2, r: 0.35 }));
  parts.push(kit.box(3.7, 0.7, 0.2, kit.materials.window, { y: DECK + 2.0, z: BZ + 1.06, r: 0.08 }));
  parts.push(kit.box(4.48, 0.7, 1.7, kit.materials.window, { y: DECK + 2.0, z: BZ + 0.1, r: 0.08 }));
  parts.push(kit.box(5.0, 0.3, 3.2, v.shipStripe, { y: DECK + 2.9, z: BZ - 0.2, r: 0.14 }));
  // Funnel, radar mast, lifeboat.
  parts.push(kit.cyl(0.62, 0.76, 1.8, v.shipHull, { y: DECK + 3.15, z: BZ - 0.9 }, 18));
  parts.push(kit.cyl(0.68, 0.72, 0.4, p.sign, { y: DECK + 4.1, z: BZ - 0.9 }, 18));
  parts.push(kit.cyl(0.52, 0.52, 0.1, p.tire, { y: DECK + 4.9, z: BZ - 0.9 }, 18));
  parts.push(kit.cyl(0.06, 0.08, 1.5, p.darkMetal, { x: 1.5, y: DECK + 3.15, z: BZ + 0.6 }, 8));
  parts.push(kit.box(1.0, 0.12, 0.2, p.sign, { x: 1.5, y: DECK + 4.5, z: BZ + 0.6, r: 0.04 }));
  parts.push(kit.blob(0.14, 0.14, 0.14, kit.materials.lamp, { x: 1.5, y: DECK + 4.62, z: BZ + 0.6 }));
  for (const x of [-2.95, 2.95]) {
    parts.push(kit.capsule(0.36, 1.9, p.hazard, { x, y: DECK + 1.5, z: BZ - 0.2 }));
    parts.push(kit.box(0.5, 0.12, 0.12, p.darkMetal, { x: x * 0.92, y: DECK + 1.9, z: BZ - 0.2 }));
  }
  // Bow: mast with a light, anchor plates.
  parts.push(kit.cyl(0.08, 0.1, 2.2, p.darkMetal, { y: DECK, z: 7.4 }, 8));
  parts.push(kit.blob(0.18, 0.18, 0.18, kit.materials.lamp, { y: DECK + 2.15, z: 7.4 }));
  parts.push(kit.box(0.9, 0.5, 0.9, p.darkMetal, { y: DECK, z: 6.6, r: 0.12 }));
  return kit.group(parts, { cargo, cargoScale: [[2, 2, 2]], smoke: [[0, DECK + 5.3, BZ - 0.9]] });
}

/**
 * Cargo plane: a chubby fuselage, a high wing with two propeller engines, a
 * tall tail. Stands on its wheels on y = 0 and flies towards +z.
 */
function cargoPlane(kit: Kit): Object3D {
  const v = kit.theme.vehicles;
  const p = kit.theme.props;
  const HALF_PI = Math.PI / 2;
  const parts: Object3D[] = [];
  const BELLY = 0.75;
  const R = 1.55;
  // Fuselage with coloured hoops, a dark nose and the cockpit glass.
  parts.push(kit.capsule(R, 12.5, v.planeBody, { y: BELLY }));
  for (const z of [2.6, -3.4]) parts.push(kit.cyl(R + 0.04, R + 0.04, 0.5, v.planeAccent, { y: BELLY + R - 0.25, z, rx: HALF_PI }, 24));
  parts.push(kit.blob(0.7, 0.7, 0.5, p.darkMetal, { y: BELLY + R - 0.75, z: 5.85 }));
  parts.push(kit.box(2.0, 0.75, 1.3, p.glass, { y: BELLY + 1.95, z: 4.35, rx: 0.5, r: 0.3 }));
  for (const side of [-1, 1]) {
    for (const z of [1.3, 0.2, -0.9, -2.0]) {
      parts.push(kit.cyl(0.24, 0.24, 0.16, kit.materials.window, { x: side * (R - 0.1), y: BELLY + R + 0.2 - 0.08, z, rz: HALF_PI }, 12));
    }
    // Cargo door on each side.
    parts.push(kit.box(0.14, 1.3, 1.5, p.sign, { x: side * (R - 0.02), y: BELLY + 0.6, z: -4.2, r: 0.06 }));
  }
  // High wing, engines with spinners and propeller blades.
  const WING_Y = BELLY + 2.85;
  parts.push(kit.box(15.6, 0.36, 3.0, v.planeBody, { y: WING_Y, z: 0.5, r: 0.18 }));
  parts.push(kit.box(3.2, 0.3, 3.3, v.planeBody, { y: WING_Y - 0.12, z: 0.5, r: 0.14 }));
  for (const side of [-1, 1]) {
    const x = side * 4.0;
    parts.push(kit.box(1.3, 0.44, 3.06, v.planeAccent, { x: side * 7.2, y: WING_Y - 0.04, z: 0.5, r: 0.18 }));
    parts.push(kit.blob(0.16, 0.16, 0.16, kit.materials.headlight, { x: side * 7.85, y: WING_Y + 0.02, z: 0.5 }));
    // Landing light under the wing, beside the engine.
    parts.push(kit.cyl(0.18, 0.18, 0.14, kit.materials.headlight, { x: side * 5.4, y: WING_Y - 0.06, z: 1.92, rx: HALF_PI }, 12));
    parts.push(kit.capsule(0.6, 2.9, v.planeAccent, { x, y: WING_Y - 1.0, z: 1.3 }));
    parts.push(kit.cone(0.3, 0.6, p.sign, { x, y: WING_Y - 0.4 - 0.3, z: 3.0, rx: HALF_PI }, 14));
    const prop = kit.group([
      kit.box(0.26, 2.3, 0.08, p.darkMetal, { y: -1.15, r: 0.04 }),
      kit.box(2.3, 0.26, 0.08, p.darkMetal, { y: -0.13, r: 0.04 }),
    ]);
    prop.position.set(x, WING_Y - 0.4, 2.82);
    prop.rotation.z = side * 0.5;
    parts.push(prop);
  }
  // Tail: fin with a coloured tip, stabiliser.
  parts.push(kit.box(0.36, 3.0, 2.3, v.planeBody, { y: BELLY + 2.3, z: -5.2, rx: -0.25, r: 0.17 }));
  parts.push(kit.box(0.42, 0.9, 2.0, v.planeAccent, { y: BELLY + 4.4, z: -5.75, rx: -0.25, r: 0.17 }));
  parts.push(kit.box(5.6, 0.3, 1.7, v.planeBody, { y: BELLY + 2.75, z: -5.5, r: 0.15 }));
  for (const side of [-1, 1]) parts.push(kit.box(0.9, 0.36, 1.76, v.planeAccent, { x: side * 2.5, y: BELLY + 2.72, z: -5.5, r: 0.15 }));
  // Landing gear and the nose light.
  for (const [x, z, radius] of [[-0.22, 4.0, 0.36], [0.22, 4.0, 0.36], [-1.25, -0.8, 0.44], [1.25, -0.8, 0.44]] as const) {
    parts.push(...toyWheel(kit, radius, 0.3, x, z, v.planeAccent));
    parts.push(kit.box(0.12, BELLY + 0.3 - radius, 0.12, p.darkMetal, { x: x * 0.8, y: radius, z }));
  }
  parts.push(kit.cyl(0.2, 0.2, 0.14, kit.materials.headlight, { y: BELLY + 0.55, z: 5.55, rx: 1.2 }, 12));
  // Beacons on the back of the fuselage, under the belly and on top of the fin.
  parts.push(kit.dome(0.16, 0.2, 0.16, kit.materials.headlight, { y: BELLY + 2 * R - 0.03, z: -1.6 }));
  parts.push(kit.blob(0.16, 0.14, 0.16, kit.materials.headlight, { y: BELLY - 0.1, z: 1.0 }));
  parts.push(kit.blob(0.15, 0.15, 0.15, kit.materials.headlight, { y: BELLY + 5.22, z: -6.1 }));
  return kit.group(parts);
}

export function registerVehicleModels(registry: ModelRegistry): void {
  registry.register('vehicle.boxTruck', boxTruck);
  registry.register('vehicle.carrier', carrier);
  registry.register('vehicle.forklift', forklift);
  registry.register('vehicle.wasteTanker', wasteTanker);
  registry.register('vehicle.cargoShip', cargoShip);
  registry.register('vehicle.cargoPlane', cargoPlane);
  registry.register('vehicle.default', boxTruck);
}
