/**
 * Bottle factory: a barrel-vaulted glass hall with a giant bottle standing
 * beside it, and a bottling line in the open where bottles come out of the
 * blowing machine, ride the belt under the capper and end up in crates.
 */
import type { Object3D } from 'three';
import type { ModelRegistry } from '../../ModelRegistry';
import { buildingPalette, itemColor } from '../../theme';
import { BUILDING_ANCHORS } from '../buildings';
import type { Kit } from '../kit';
import { HALF_PI, framedWindow, rollerDoor } from '../parts';
import { FLOOR, conveyor, crate, planter, rodX, rodZ, slab, walls, type Parts } from './shared';

function bottleFactory(kit: Kit): Object3D {
  const theme = kit.theme;
  const palette = buildingPalette(theme, 'bottleFactory');
  const p = theme.props;
  const trim = palette.trim ?? palette.accent;
  const glass = itemColor(theme, 'glass');
  const plastic = itemColor(theme, 'plastic');
  const bottle = itemColor(theme, 'bottle');
  const parts: Parts = [];

  // Glass hall under a barrel vault, its round end towards the yard.
  const CX = 1.3;
  const CZ = -3;
  const W = 7.4;
  const D = 6.4;
  const WALL = 2.9;
  const VAULT = 2.3;
  const eave = FLOOR + WALL;
  const front = CZ + D / 2;
  const left = CX - W / 2;
  const right = CX + W / 2;

  parts.push(slab(kit, -7.5, 5.75, -6.75, 2));
  parts.push(kit.box(3.4, 0.22, 1.3, p.concrete, { x: CX + 1.6, z: front + 0.7, r: 0.1 }));
  parts.push(walls(kit, { cx: CX, cz: CZ, width: W, depth: D, height: WALL, wall: palette.wall }));
  for (const x of [left + 0.1, right - 0.1]) {
    parts.push(kit.box(0.42, WALL + 0.05, 0.42, palette.roof, { x, y: FLOOR, z: front - 0.1, r: 0.1 }));
  }

  // Vault: roof shell, a pale rim and the wall-coloured end showing inside it.
  parts.push(kit.barrel(D + 0.9, VAULT, W + 0.7, palette.roof, { x: CX, y: eave, z: CZ, ry: HALF_PI }));
  parts.push(kit.barrel(D + 0.97, VAULT - 0.2, W + 0.3, p.sign, { x: CX, y: eave, z: CZ, ry: HALF_PI }));
  parts.push(kit.barrel(D + 1.04, VAULT - 0.36, W, palette.wall, { x: CX, y: eave, z: CZ, ry: HALF_PI }));
  for (const side of [-1, 1]) {
    parts.push(kit.box(0.34, 0.24, D + 0.96, p.sign, { x: CX + side * (W / 2 + 0.27), y: eave - 0.12, z: CZ, r: 0.08 }));
  }
  parts.push(kit.box(W + 0.5, 0.24, 0.3, p.sign, { x: CX, y: eave - 0.12, z: front + 0.4, r: 0.08 }));
  // Round window in the vault end.
  const gableZ = front + 0.54;
  parts.push(rodZ(kit, 0.82, 0.1, p.sign, CX, eave + 0.95, gableZ, 24));
  parts.push(rodZ(kit, 0.64, 0.14, kit.materials.window, CX, eave + 0.95, gableZ, 24));
  parts.push(kit.box(0.1, 1.3, 0.18, p.sign, { x: CX, y: eave + 0.3, z: gableZ, r: 0.03 }));
  parts.push(kit.box(1.3, 0.1, 0.18, p.sign, { x: CX, y: eave + 0.9, z: gableZ, r: 0.03 }));

  parts.push(rollerDoor(kit, { cx: CX + 1.6, wall: front, y: FLOOR, paint: trim }));
  // Backplate that holds the door lamp to the wall.
  parts.push(kit.box(0.54, 0.36, 0.14, p.sign, { x: CX + 1.6, y: FLOOR + 2.53, z: front + 0.03, r: 0.05 }));
  parts.push(framedWindow(kit, { face: 'front', along: CX - 1.9, wall: front, y: FLOOR + 1, sill: palette.roof }));
  for (const z of [CZ - 1.7, CZ + 1.7]) {
    parts.push(framedWindow(kit, { face: 'right', along: z, wall: right, y: FLOOR + 1, sill: palette.roof }));
  }

  // Furnace flue through the vault.
  const flueX = CX + 2.3;
  const flueZ = CZ - 1.8;
  parts.push(kit.cyl(0.55, 0.6, 0.5, p.sign, { x: flueX, y: eave + 1.15, z: flueZ }, 14));
  parts.push(kit.cyl(0.32, 0.4, 3.3, p.metal, { x: flueX, y: eave + 1.4, z: flueZ }, 14));
  parts.push(kit.cyl(0.42, 0.42, 0.24, palette.roof, { x: flueX, y: eave + 4.6, z: flueZ }, 14));

  // The giant bottle: plinth, body with a label, shoulder, neck and cap.
  const GX = -5.7;
  const GZ = -4.7;
  parts.push(kit.cyl(1.4, 1.5, 0.4, p.rock, { x: GX, y: FLOOR, z: GZ }, 24));
  parts.push(kit.cyl(1.1, 1.1, 2.9, bottle, { x: GX, y: FLOOR + 0.4, z: GZ }, 24));
  parts.push(kit.cyl(1.14, 1.14, 1.2, p.sign, { x: GX, y: FLOOR + 1.2, z: GZ }, 24));
  parts.push(kit.cyl(1.17, 1.17, 0.3, trim, { x: GX, y: FLOOR + 1.65, z: GZ }, 24));
  parts.push(kit.dome(1.1, 1, 1.1, bottle, { x: GX, y: FLOOR + 3.3, z: GZ }));
  parts.push(kit.cyl(0.36, 0.46, 1.3, bottle, { x: GX, y: FLOOR + 4.05, z: GZ }, 18));
  parts.push(kit.cyl(0.45, 0.45, 0.14, bottle, { x: GX, y: FLOOR + 5.1, z: GZ }, 18));
  parts.push(kit.cyl(0.42, 0.42, 0.34, trim, { x: GX, y: FLOOR + 5.24, z: GZ }, 18));

  // Bottling line: blowing machine, belt, capper.
  const LX = -4.6;
  const beltTop = FLOOR + 0.85;
  const MZ = -2.2;
  parts.push(kit.box(1.8, 1.55, 1.3, trim, { x: LX, y: FLOOR, z: MZ, r: 0.16 }));
  parts.push(kit.box(1.2, 0.6, 0.12, kit.materials.window, { x: LX, y: FLOOR + 0.75, z: MZ + 0.62, r: 0.05 }));
  parts.push(kit.cyl(0.55, 0.25, 0.6, p.metal, { x: LX - 0.3, y: FLOOR + 1.55, z: MZ }, 14));
  parts.push(kit.dome(0.5, 0.26, 0.5, glass, { x: LX - 0.3, y: FLOOR + 2.1, z: MZ }));
  parts.push(kit.box(0.26, 0.2, 0.26, kit.materials.lamp, { x: LX + 0.55, y: FLOOR + 1.55, z: MZ + 0.3, r: 0.06 }));
  parts.push(rodX(kit, 0.17, 1.5, p.metal, LX + 1.55, FLOOR + 1.1, MZ));
  parts.push(conveyor(kit, { x: LX, z: 0.05, length: 3.4, top: beltTop }));
  const capZ = 0.25;
  for (const dx of [-0.6, 0.6]) parts.push(kit.box(0.2, 1.75, 0.3, palette.roof, { x: LX + dx, y: FLOOR, z: capZ, r: 0.06 }));
  parts.push(kit.box(1.5, 0.42, 0.6, palette.roof, { x: LX, y: FLOOR + 1.7, z: capZ, r: 0.12 }));
  parts.push(kit.cyl(0.08, 0.12, 0.3, p.metal, { x: LX, y: FLOOR + 1.42, z: capZ }, 10));
  // Bottles on the belt; the ones past the capper wear a cap.
  for (const z of [-1.35, -0.85, -0.3, 0.25, 0.8, 1.35]) {
    parts.push(kit.cyl(0.15, 0.15, 0.36, bottle, { x: LX, y: beltTop, z }, 12));
    parts.push(kit.cyl(0.06, 0.1, 0.2, z > capZ ? trim : bottle, { x: LX, y: beltTop + 0.36, z }, 10));
  }

  // Cullet bin and pellet drums feeding the machine; a crate of full bottles at the end.
  parts.push(kit.box(1.1, 0.75, 1.1, p.wood, { x: -6.6, y: FLOOR, z: -1.7, r: 0.1 }));
  parts.push(kit.dome(0.45, 0.3, 0.45, glass, { x: -6.6, y: FLOOR + 0.7, z: -1.7 }));
  for (const z of [-0.9, -0.1]) {
    parts.push(kit.cyl(0.34, 0.34, 0.8, p.metal, { x: -3.05, y: FLOOR, z }, 14));
    parts.push(kit.dome(0.3, 0.14, 0.3, plastic, { x: -3.05, y: FLOOR + 0.78, z }));
  }
  parts.push(crate(kit, -6.3, FLOOR, 1.1, 0.95, p.wood));
  for (const dx of [-0.22, 0.22]) {
    for (const dz of [-0.22, 0.22]) {
      parts.push(kit.cyl(0.07, 0.15, 0.34, bottle, { x: -6.3 + dx, y: FLOOR + 0.72, z: 1.1 + dz }, 10));
    }
  }
  parts.push(crate(kit, -6.35, FLOOR, 0, 0.8, p.wood));

  parts.push(planter(kit, CX - 0.25, FLOOR, front + 0.5, trim));
  parts.push(crate(kit, right - 0.4, FLOOR, front + 0.6, 0.7, bottle));

  return kit.group(parts.flat(), { ...BUILDING_ANCHORS, smoke: [[flueX, eave + 5.1, flueZ]] });
}

export function registerBottleFactoryModel(registry: ModelRegistry): void {
  registry.register('building.bottleFactory', bottleFactory);
}
