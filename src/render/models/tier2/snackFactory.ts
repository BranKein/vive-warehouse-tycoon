/**
 * Snack factory: a gabled bakery with a bitten cookie on its gable, a big
 * domed oven with a striped chimney beside it and a flour silo behind; trays
 * of snacks cool on a table and a rack in front of the oven.
 */
import type { Object3D } from 'three';
import type { ModelRegistry } from '../../ModelRegistry';
import { buildingPalette, itemColor } from '../../theme';
import { BUILDING_ANCHORS } from '../buildings';
import type { Kit } from '../kit';
import { bush, framedWindow, gableRoof, rollerDoor } from '../parts';
import { FLOOR, planter, rodX, rodZ, slab, walls, type Parts } from './shared';

function snackFactory(kit: Kit): Object3D {
  const theme = kit.theme;
  const palette = buildingPalette(theme, 'snackFactory');
  const p = theme.props;
  const trim = palette.trim ?? palette.accent;
  const flour = itemColor(theme, 'flour');
  const sawdust = itemColor(theme, 'sawdust');
  const snack = itemColor(theme, 'snack');
  const parts: Parts = [];

  // Bakery on the right, gable end towards the yard.
  const CX = 2.3;
  const CZ = -3;
  const W = 6;
  const D = 5.8;
  const WALL = 2.8;
  const RISE = 2.1;
  const eave = FLOOR + WALL;
  const front = CZ + D / 2;
  const left = CX - W / 2;
  const right = CX + W / 2;

  parts.push(slab(kit, -7.5, 5.8, -6.75, 2));
  parts.push(kit.box(5.4, 0.22, 1.3, p.concrete, { x: CX, z: front + 0.7, r: 0.1 }));
  parts.push(walls(kit, { cx: CX, cz: CZ, width: W, depth: D, height: WALL, wall: palette.wall }));
  parts.push(kit.box(W + 0.1, 0.3, 0.3, palette.accent, { x: CX, y: eave - 0.28, z: front + 0.02, r: 0.08 }));
  parts.push(gableRoof(kit, { cx: CX, cz: CZ, width: W, depth: D, eave, rise: RISE, wall: palette.wall, roof: palette.roof, cap: palette.accent, overhang: 0.6 }));

  // Shop front: a wide window under a striped awning, and the door.
  const winX = CX - 1.35;
  parts.push(framedWindow(kit, { face: 'front', along: winX, wall: front, y: FLOOR + 0.9, width: 2.4, height: 1.3, sill: trim }));
  for (let i = 0; i < 5; i += 1) {
    parts.push(kit.box(0.52, 0.12, 0.95, i % 2 ? p.sign : palette.accent, { x: winX - 1.04 + i * 0.52, y: FLOOR + 2.22, z: front + 0.42, rx: 0.4, r: 0.04 }));
  }
  parts.push(rollerDoor(kit, { cx: CX + 1.75, wall: front, y: FLOOR, width: 1.7, height: 2.1, paint: trim }));
  for (const z of [CZ - 1.5, CZ + 1.5]) {
    parts.push(framedWindow(kit, { face: 'right', along: z, wall: right, y: FLOOR + 0.95, sill: trim }));
  }

  // The cookie on the gable, a bite out of it.
  const signY = eave + 0.72;
  parts.push(rodZ(kit, 1.08, 0.1, p.sign, CX, signY, front + 0.03, 28));
  parts.push(rodZ(kit, 0.86, 0.16, snack, CX, signY, front + 0.14, 28));
  parts.push(rodZ(kit, 0.34, 0.2, p.sign, CX + 0.68, signY + 0.6, front + 0.14, 18));
  for (const [dx, dy] of [[-0.45, 0.3], [0.05, 0.45], [-0.2, -0.1], [0.4, -0.05], [-0.4, -0.5], [0.2, -0.55]] as const) {
    parts.push(kit.blob(0.13, 0.13, 0.08, p.tire, { x: CX + dx, y: signY + dy - 0.13, z: front + 0.22 }));
  }

  // Domed oven on a stone base, its mouth towards the yard.
  const OX = -4.3;
  const OZ = -2.5;
  const hearth = FLOOR + 0.9;
  parts.push(kit.cyl(1.95, 2.05, 0.9, p.rock, { x: OX, y: FLOOR, z: OZ }, 24));
  parts.push(kit.dome(1.85, 2, 1.85, palette.roof, { x: OX, y: hearth, z: OZ }));
  parts.push(kit.cyl(1.9, 1.9, 0.22, palette.accent, { x: OX, y: hearth - 0.04, z: OZ }, 24));
  parts.push(kit.box(1.7, 1.15, 0.6, p.sign, { x: OX, y: hearth, z: OZ + 1.6, r: 0.2 }));
  parts.push(kit.box(1.2, 0.8, 0.64, p.tire, { x: OX, y: hearth, z: OZ + 1.6, r: 0.16 }));
  parts.push(kit.box(0.9, 0.3, 0.68, kit.materials.lamp, { x: OX, y: hearth + 0.02, z: OZ + 1.6, r: 0.1 }));
  parts.push(kit.box(1.9, 0.16, 0.7, p.rock, { x: OX, y: hearth - 0.14, z: OZ + 2.05, r: 0.06 }));
  // Chimney out of the dome, striped like a candy stick.
  const chimneyZ = OZ - 0.5;
  const chimneyBase = hearth + 1.7;
  parts.push(kit.cyl(0.38, 0.46, 3.9, p.sign, { x: OX, y: chimneyBase, z: chimneyZ }, 16));
  for (const dy of [1.1, 2.1, 3.1]) {
    parts.push(kit.cyl(0.45, 0.46, 0.34, palette.accent, { x: OX, y: chimneyBase + dy, z: chimneyZ }, 16));
  }
  parts.push(kit.cyl(0.5, 0.5, 0.24, palette.roof, { x: OX, y: chimneyBase + 3.8, z: chimneyZ }, 16));

  // Flour silo on legs behind the oven.
  const SX = -6.1;
  const SZ = -5.65;
  for (const dx of [-0.6, 0.6]) {
    for (const dz of [-0.6, 0.6]) parts.push(kit.box(0.2, 1.5, 0.2, p.darkMetal, { x: SX + dx, y: FLOOR, z: SZ + dz, r: 0.05 }));
  }
  parts.push(kit.cyl(0.95, 0.3, 0.8, p.metal, { x: SX, y: FLOOR + 0.6, z: SZ }, 18));
  parts.push(kit.cyl(0.95, 0.95, 2.9, flour, { x: SX, y: FLOOR + 1.4, z: SZ }, 18));
  parts.push(kit.cyl(0.98, 0.98, 0.3, trim, { x: SX, y: FLOOR + 2.3, z: SZ }, 18));
  parts.push(kit.cyl(0.98, 0.98, 0.3, trim, { x: SX, y: FLOOR + 3.5, z: SZ }, 18));
  parts.push(kit.cone(1.08, 0.8, palette.roof, { x: SX, y: FLOOR + 4.3, z: SZ }, 18));

  // Fuel: a bin of sawdust between the oven and the bakery.
  parts.push(kit.box(1.2, 0.8, 1.2, p.wood, { x: -1.7, y: FLOOR, z: -4.6, r: 0.1 }));
  parts.push(kit.dome(0.5, 0.36, 0.5, sawdust, { x: -1.7, y: FLOOR + 0.74, z: -4.6 }));
  // Flour sacks by the oven.
  for (const [dx, dy, dz] of [[0, 0, 0], [0.1, 0, 0.75], [0.05, 0.42, 0.35]] as const) {
    parts.push(kit.blob(0.42, 0.26, 0.34, flour, { x: -6.85 + dx, y: FLOOR + dy, z: -0.35 + dz }));
  }

  // Table in front of the oven with two trays of snacks.
  const TX = -4.4;
  const TZ = 0.95;
  const tableTop = FLOOR + 0.82;
  parts.push(kit.box(2.8, 0.16, 1.2, p.wood, { x: TX, y: tableTop - 0.16, z: TZ, r: 0.05 }));
  for (const dx of [-1.2, 1.2]) parts.push(kit.box(0.2, 0.68, 1, palette.accent, { x: TX + dx, y: FLOOR, z: TZ, r: 0.06 }));
  for (const side of [-1, 1]) {
    const x = TX + side * 0.68;
    parts.push(kit.box(1.15, 0.07, 0.9, p.metal, { x, y: tableTop, z: TZ, r: 0.03 }));
    for (const dx of [-0.34, 0, 0.34]) {
      for (const dz of [-0.2, 0.2]) {
        parts.push(kit.cyl(0.14, 0.14, 0.1, snack, { x: x + dx, y: tableTop + 0.06, z: TZ + dz }, 10));
      }
    }
  }

  // Cooling rack on wheels, full shelves.
  const RX = -1.75;
  const RZ = 0.9;
  for (const dx of [-0.5, 0.5]) {
    for (const dz of [-0.4, 0.4]) parts.push(kit.box(0.1, 1.8, 0.1, p.darkMetal, { x: RX + dx, y: FLOOR, z: RZ + dz, r: 0.03 }));
  }
  for (const y of [0.4, 0.95, 1.5]) {
    parts.push(kit.box(1.08, 0.06, 0.88, p.metal, { x: RX, y: FLOOR + y, z: RZ, r: 0.03 }));
    parts.push(kit.box(0.85, 0.12, 0.66, snack, { x: RX, y: FLOOR + y + 0.05, z: RZ, r: 0.05 }));
  }
  // Baker's peel resting on the hearth shelf.
  parts.push(rodX(kit, 0.05, 1.6, p.wood, OX + 1.5, hearth + 0.1, OZ + 2.2, 8));
  parts.push(kit.box(0.6, 0.06, 0.5, p.wood, { x: OX + 0.45, y: hearth + 0.04, z: OZ + 2.2, r: 0.03 }));

  parts.push(planter(kit, CX + 0.42, FLOOR, front + 0.5, palette.accent));
  parts.push(bush(kit, left - 0.5, FLOOR - 0.05, front - 0.7));

  return kit.group(parts.flat(), { ...BUILDING_ANCHORS, smoke: [[OX, chimneyBase + 4.3, chimneyZ]] });
}

export function registerSnackFactoryModel(registry: ModelRegistry): void {
  registry.register('building.snackFactory', snackFactory);
}
