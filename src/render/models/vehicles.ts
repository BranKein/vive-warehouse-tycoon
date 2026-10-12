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

function boxTruck(kit: Kit): Object3D {
  const v = kit.theme.vehicles;
  const p = kit.theme.props;
  return kit.group([
    kit.box(1.9, 0.35, 5.3, p.darkMetal, { y: 0.4, r: 0.1 }),
    // Cargo box with a coloured stripe.
    kit.box(2.25, 2.25, 3.7, v.truckBody, { y: 0.7, z: -0.75, r: 0.28 }),
    kit.box(2.28, 0.32, 3.4, v.truckCab, { y: 1.15, z: -0.75, r: 0.1 }),
    kit.box(1.7, 1.75, 0.1, p.sign, { y: 0.95, z: -2.6, r: 0.05 }),
    // Cab.
    kit.box(2.1, 1.75, 1.55, v.truckCab, { y: 0.65, z: 1.95, r: 0.38 }),
    kit.box(1.7, 0.72, 0.2, p.glass, { y: 1.5, z: 2.64, r: 0.09 }),
    kit.box(2.14, 0.6, 0.7, p.glass, { y: 1.55, z: 2.05, r: 0.09 }),
    kit.box(2.0, 0.3, 0.25, p.sign, { y: 0.45, z: 2.68, r: 0.1 }),
    kit.box(0.34, 0.22, 0.1, kit.materials.headlight, { x: -0.68, y: 0.9, z: 2.72, r: 0.05 }),
    kit.box(0.34, 0.22, 0.1, kit.materials.headlight, { x: 0.68, y: 0.9, z: 2.72, r: 0.05 }),
    ...wheel(kit, 0.46, 0.4, -0.98, 1.85),
    ...wheel(kit, 0.46, 0.4, 0.98, 1.85),
    ...wheel(kit, 0.46, 0.4, -0.98, -1.75),
    ...wheel(kit, 0.46, 0.4, 0.98, -1.75),
  ]);
}

function carrier(kit: Kit): Object3D {
  const v = kit.theme.vehicles;
  const p = kit.theme.props;
  const cargo: Array<[number, number, number]> = [];
  for (const y of [0.83, 1.65]) {
    for (const z of [-0.2, -1.05]) {
      for (const x of [-0.42, 0.42]) cargo.push([x, y, z]);
    }
  }
  return kit.group(
    [
      kit.box(1.6, 0.3, 3.4, p.darkMetal, { y: 0.32, r: 0.1 }),
      // Flat bed with low side rails.
      kit.box(1.9, 0.22, 2.2, v.carrierBed, { y: 0.6, z: -0.62, r: 0.08 }),
      kit.box(0.1, 0.3, 2.2, v.carrierCab, { x: -0.92, y: 0.75, z: -0.62, r: 0.04 }),
      kit.box(0.1, 0.3, 2.2, v.carrierCab, { x: 0.92, y: 0.75, z: -0.62, r: 0.04 }),
      kit.box(1.9, 0.5, 0.1, v.carrierCab, { y: 0.75, z: -1.72, r: 0.04 }),
      // Small cab.
      kit.box(1.8, 1.35, 1.15, v.carrierCab, { y: 0.5, z: 1.1, r: 0.32 }),
      kit.box(1.45, 0.52, 0.2, p.glass, { y: 1.15, z: 1.6, r: 0.08 }),
      kit.box(1.84, 0.45, 0.55, p.glass, { y: 1.2, z: 1.15, r: 0.08 }),
      kit.box(0.28, 0.18, 0.1, kit.materials.headlight, { x: -0.58, y: 0.68, z: 1.67, r: 0.04 }),
      kit.box(0.28, 0.18, 0.1, kit.materials.headlight, { x: 0.58, y: 0.68, z: 1.67, r: 0.04 }),
      ...wheel(kit, 0.36, 0.32, -0.82, 1.05),
      ...wheel(kit, 0.36, 0.32, 0.82, 1.05),
      ...wheel(kit, 0.36, 0.32, -0.82, -1.1),
      ...wheel(kit, 0.36, 0.32, 0.82, -1.1),
    ],
    { cargo, cargoScale: [[1, 1, 1]] },
  );
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
