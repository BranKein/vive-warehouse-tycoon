/**
 * Primitive-built vehicles. All of them drive towards +z and stand on y = 0
 * (the ship floats with its waterline near y = 0).
 */
import type { Mesh, Object3D } from 'three';
import type { ModelRegistry } from '../ModelRegistry';
import type { Kit } from './kit';

/** Wheel with its axle along x, centred at (x, radius, z). */
function wheel(kit: Kit, radius: number, width: number, x: number, z: number): Mesh[] {
  const tire = kit.cyl(radius, radius, width, kit.theme.props.tire, { x, y: radius - width / 2, z, rz: Math.PI / 2 }, 14);
  const hub = kit.cyl(radius * 0.45, radius * 0.45, width + 0.04, kit.theme.props.sign, { x, y: radius - width / 2 - 0.02, z, rz: Math.PI / 2 }, 10);
  return [tire, hub];
}

/** Chunky wheel for the hand-drawn vehicles: tyre, pale rim and a coloured cap. Axle along x, centred at (x, radius, z). */
function toyWheel(kit: Kit, radius: number, width: number, x: number, z: number, cap: number): Mesh[] {
  const side = Math.sign(x) || 1;
  const p = kit.theme.props;
  const disc = (r: number, w: number, paint: number, shift: number): Mesh =>
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
    parts.push(kit.box(0.22, 0.34, 0.1, v.truckCab, { x, y: 0.72, z: back - 0.02, r: 0.05 }));
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

/**
 * Carrier: the little flatbed that shuttles goods around the estate. Same toy
 * look as the box truck, one size down: round mint cab, cream bed with slatted rails.
 */
function carrier(kit: Kit): Object3D {
  const v = kit.theme.vehicles;
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
  for (const x of [-0.72, 0.72]) parts.push(kit.box(0.2, 0.14, 0.08, v.truckCab, { x, y: 0.62, z: back - 0.03, r: 0.04 }));
  // Headboard between the cab and the load.
  parts.push(kit.box(1.8, 0.75, 0.1, v.carrierCab, { y: 0.84, z: BED_Z + BED_LEN / 2 - 0.08, r: 0.05 }));

  // Cab.
  const CAB_Z = 1.12;
  parts.push(kit.box(1.8, 1.45, 1.2, v.carrierCab, { y: 0.48, z: CAB_Z, r: 0.36 }));
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
    parts.push(kit.barrel(0.26, 0.5, 1.08, v.carrierCab, { x, y: 0.38, z: FRONT_Z }));
    parts.push(kit.barrel(0.26, 0.5, 1.08, p.darkMetal, { x, y: 0.38, z: REAR_Z }));
    parts.push(...toyWheel(kit, 0.38, 0.36, x, FRONT_Z, v.carrierCab));
    parts.push(...toyWheel(kit, 0.38, 0.36, x, REAR_Z, v.carrierCab));
  }
  return kit.group(parts, { cargo, cargoScale: [[1, 1, 1]] });
}

function forklift(kit: Kit): Object3D {
  const v = kit.theme.vehicles;
  const p = kit.theme.props;
  return kit.group(
    [
      kit.box(1.15, 0.75, 1.5, v.forklift, { y: 0.22, z: -0.25, r: 0.26 }),
      kit.box(1.05, 0.5, 0.5, p.darkMetal, { y: 0.3, z: -0.95, r: 0.2 }),
      kit.box(0.6, 0.3, 0.55, p.tire, { y: 0.97, z: -0.35, r: 0.1 }),
      // Overhead guard.
      kit.box(0.07, 1.15, 0.07, p.darkMetal, { x: -0.5, y: 0.95, z: 0.38 }),
      kit.box(0.07, 1.15, 0.07, p.darkMetal, { x: 0.5, y: 0.95, z: 0.38 }),
      kit.box(0.07, 1.15, 0.07, p.darkMetal, { x: -0.5, y: 0.95, z: -0.85 }),
      kit.box(0.07, 1.15, 0.07, p.darkMetal, { x: 0.5, y: 0.95, z: -0.85 }),
      kit.box(1.15, 0.1, 1.4, v.forklift, { y: 2.08, z: -0.24, r: 0.05 }),
      // Mast and forks.
      kit.box(0.12, 2.2, 0.12, p.darkMetal, { x: -0.36, y: 0.1, z: 0.62 }),
      kit.box(0.12, 2.2, 0.12, p.darkMetal, { x: 0.36, y: 0.1, z: 0.62 }),
      kit.box(0.84, 0.12, 0.12, p.darkMetal, { y: 2.2, z: 0.62 }),
      kit.box(0.14, 0.07, 1.05, p.metal, { x: -0.3, y: 0.12, z: 1.2, r: 0.03 }),
      kit.box(0.14, 0.07, 1.05, p.metal, { x: 0.3, y: 0.12, z: 1.2, r: 0.03 }),
      ...wheel(kit, 0.3, 0.26, -0.55, 0.3),
      ...wheel(kit, 0.3, 0.26, 0.55, 0.3),
      ...wheel(kit, 0.24, 0.24, -0.5, -0.8),
      ...wheel(kit, 0.24, 0.24, 0.5, -0.8),
    ],
    { cargo: [[0, 0.2, 1.25]] },
  );
}

function cargoShip(kit: Kit): Object3D {
  const v = kit.theme.vehicles;
  const p = kit.theme.props;
  const cargo: Array<[number, number, number]> = [];
  for (const y of [1.5, 3.14]) {
    for (const z of [3.8, 1.9, 0, -1.9, -3.8]) {
      for (const x of [-1.8, 0, 1.8]) cargo.push([x, y, z]);
    }
  }
  return kit.group(
    [
      // Hull with a pointed bow.
      kit.box(7, 2.3, 16, v.shipHull, { y: -0.95, z: -1.5, r: 0.9 }),
      kit.box(4.95, 2.3, 4.95, v.shipHull, { y: -0.95, z: 6.4, ry: Math.PI / 4, r: 0.7 }),
      kit.box(7.06, 0.4, 15.4, v.shipStripe, { y: 0.45, z: -1.5, r: 0.2 }),
      kit.box(6.3, 0.22, 15.2, v.shipDeck, { y: 1.28, z: -1.5, r: 0.1 }),
      kit.box(4.3, 0.22, 4.3, v.shipDeck, { y: 1.28, z: 6.2, ry: Math.PI / 4, r: 0.1 }),
      // Bridge at the stern.
      kit.box(5.2, 2.5, 3.0, v.shipCabin, { y: 1.4, z: -7.4, r: 0.4 }),
      kit.box(4.4, 0.7, 0.2, kit.materials.window, { y: 2.8, z: -5.9, r: 0.08 }),
      kit.box(5.26, 0.7, 2.0, kit.materials.window, { y: 2.8, z: -7.3, r: 0.08 }),
      kit.box(5.6, 0.3, 3.4, v.shipStripe, { y: 3.85, z: -7.4, r: 0.14 }),
      kit.cyl(0.6, 0.72, 1.7, v.shipHull, { x: 0, y: 4.1, z: -8.0 }),
      kit.cyl(0.64, 0.64, 0.3, p.sign, { x: 0, y: 5.2, z: -8.0 }),
      // Mast at the bow.
      kit.cyl(0.08, 0.1, 2.2, p.darkMetal, { y: 1.4, z: 6.6 }, 8),
      kit.blob(0.18, 0.18, 0.18, kit.materials.lamp, { y: 3.55, z: 6.6 }),
    ],
    { cargo, cargoScale: [[2, 2, 2]], smoke: [[0, 5.7, -8.0]] },
  );
}

function cargoPlane(kit: Kit): Object3D {
  const v = kit.theme.vehicles;
  const p = kit.theme.props;
  return kit.group([
    // Chubby fuselage.
    kit.capsule(1.55, 12.5, v.planeBody, { y: 0.75 }),
    kit.box(3.0, 0.35, 9.5, v.planeAccent, { y: 2.0, z: -0.3, r: 0.17 }),
    kit.box(2.0, 0.7, 1.1, p.glass, { y: 2.75, z: 4.45, rx: 0.5, r: 0.3 }),
    // High wing with two engines.
    kit.box(15.5, 0.34, 2.9, v.planeBody, { y: 3.55, z: 0.5, r: 0.17 }),
    kit.box(1.2, 0.4, 2.95, v.planeAccent, { x: -7.2, y: 3.52, z: 0.5, r: 0.17 }),
    kit.box(1.2, 0.4, 2.95, v.planeAccent, { x: 7.2, y: 3.52, z: 0.5, r: 0.17 }),
    kit.capsule(0.55, 2.6, v.planeAccent, { x: -3.9, y: 2.5, z: 1.2 }),
    kit.capsule(0.55, 2.6, v.planeAccent, { x: 3.9, y: 2.5, z: 1.2 }),
    kit.cyl(0.9, 0.9, 0.08, p.sign, { x: -3.9, y: 3.05 - 0.04, z: 2.55, rx: Math.PI / 2 }, 14),
    kit.cyl(0.9, 0.9, 0.08, p.sign, { x: 3.9, y: 3.05 - 0.04, z: 2.55, rx: Math.PI / 2 }, 14),
    // Tail.
    kit.box(0.34, 2.7, 2.2, v.planeAccent, { y: 3.2, z: -5.2, rx: -0.25, r: 0.17 }),
    kit.box(5.4, 0.28, 1.6, v.planeBody, { y: 3.5, z: -5.5, r: 0.14 }),
    // Landing gear.
    ...wheel(kit, 0.36, 0.3, 0, 4.0),
    ...wheel(kit, 0.42, 0.34, -1.2, -0.8),
    ...wheel(kit, 0.42, 0.34, 1.2, -0.8),
    kit.box(0.34, 0.2, 0.1, kit.materials.headlight, { y: 1.5, z: 6.0, r: 0.05 }),
  ]);
}

export function registerVehicleModels(registry: ModelRegistry): void {
  registry.register('vehicle.boxTruck', boxTruck);
  registry.register('vehicle.carrier', carrier);
  registry.register('vehicle.forklift', forklift);
  registry.register('vehicle.cargoShip', cargoShip);
  registry.register('vehicle.cargoPlane', cargoPlane);
  registry.register('vehicle.default', boxTruck);
}
