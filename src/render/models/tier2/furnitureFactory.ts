/**
 * Furniture factory: a saw-tooth roofed joinery hall with a giant chair on the
 * roof of its timber store, and an assembly bench in the open beside it where
 * lumber and fabric turn into chairs.
 */
import { Group, type Object3D } from 'three';
import type { ModelRegistry } from '../../ModelRegistry';
import { buildingPalette, itemColor } from '../../theme';
import { BUILDING_ANCHORS } from '../buildings';
import type { Kit, Paint } from '../kit';
import { barnDoor, framedWindow } from '../parts';
import { FLOOR, crate, planter, rodX, rodZ, slab, walls, type Parts } from './shared';

/** Chair facing +z, one unit wide and two tall before `scale`. */
function chair(kit: Kit, wood: Paint, cushion: Paint, x: number, y: number, z: number, scale: number, ry = 0): Object3D {
  const g = new Group();
  for (const sx of [-0.4, 0.4]) {
    g.add(kit.box(0.17, 0.85, 0.17, wood, { x: sx, z: 0.38, r: 0.05 }));
    g.add(kit.box(0.17, 2, 0.17, wood, { x: sx, z: -0.4, r: 0.05 }));
  }
  g.add(kit.box(1, 0.16, 1, wood, { y: 0.8, r: 0.06 }));
  g.add(kit.box(0.84, 0.14, 0.84, cushion, { y: 0.94, z: 0.02, r: 0.07 }));
  g.add(kit.box(0.9, 0.72, 0.14, wood, { y: 1.24, z: -0.4, r: 0.06 }));
  g.add(kit.box(0.66, 0.46, 0.1, cushion, { y: 1.37, z: -0.32, r: 0.05 }));
  g.position.set(x, y, z);
  g.scale.setScalar(scale);
  g.rotation.y = ry;
  return g;
}

function furnitureFactory(kit: Kit): Object3D {
  const theme = kit.theme;
  const palette = buildingPalette(theme, 'furnitureFactory');
  const p = theme.props;
  const trim = palette.trim ?? palette.accent;
  const plank = itemColor(theme, 'lumber');
  const fabric = itemColor(theme, 'fabric');
  const chairWood = itemColor(theme, 'chair');
  const parts: Parts = [];

  // Joinery hall.
  const CX = 1.4;
  const CZ = -3;
  const W = 7.8;
  const D = 6.6;
  const WALL = 3.3;
  const eave = FLOOR + WALL;
  const front = CZ + D / 2;
  const back = CZ - D / 2;
  const left = CX - W / 2;
  const right = CX + W / 2;

  parts.push(slab(kit, -7.5, 5.8, -6.75, 2));
  parts.push(kit.box(4, 0.22, 1.4, p.concrete, { x: CX + 1.7, z: front + 0.75, r: 0.1 }));
  parts.push(walls(kit, { cx: CX, cz: CZ, width: W, depth: D, height: WALL, wall: palette.wall }));
  parts.push(kit.box(W + 0.1, 0.3, D + 0.1, palette.accent, { x: CX, y: eave - 0.5, z: CZ, r: 0.08 }));

  // Saw-tooth roof: three teeth, glazed on the upright side that faces the yard.
  parts.push(kit.box(W + 0.6, 0.32, D + 0.6, palette.roof, { x: CX, y: eave - 0.06, z: CZ, r: 0.12 }));
  const TOOTH = D / 3;
  for (let i = 0; i < 3; i += 1) {
    const z = back + TOOTH / 2 + i * TOOTH;
    parts.push(kit.prism(W + 0.4, 1.25, TOOTH, palette.roof, { x: CX, y: eave + 0.24, z }, 1));
    parts.push(kit.box(W - 0.5, 0.72, 0.12, kit.materials.window, { x: CX, y: eave + 0.42, z: z + TOOTH / 2 + 0.02, r: 0.04 }));
    parts.push(kit.box(W + 0.6, 0.22, 0.36, p.sign, { x: CX, y: eave + 1.38, z: z + TOOTH / 2 - 0.1, r: 0.08 }));
  }

  parts.push(barnDoor(kit, { cx: CX + 1.7, wall: front, y: FLOOR, paint: trim }));
  parts.push(framedWindow(kit, { face: 'front', along: CX - 2.3, wall: front, y: FLOOR + 1.05, sill: palette.accent }));
  for (const z of [CZ - 1.7, CZ + 1.7]) {
    parts.push(framedWindow(kit, { face: 'right', along: z, wall: right, y: FLOOR + 1.05, sill: palette.accent }));
  }

  // Timber store on the left: back wall, posts, flat roof, and the giant chair on top.
  const SX = -4.9;
  const SZ = -4.4;
  const storeTop = FLOOR + 2.7;
  parts.push(kit.box(4.7, 2.5, 0.26, palette.wall, { x: SX, y: FLOOR, z: SZ - 1.75, r: 0.08 }));
  parts.push(kit.box(4.8, 0.5, 0.36, p.rock, { x: SX, y: FLOOR, z: SZ - 1.75, r: 0.1 }));
  for (const x of [-7.1, -4.8]) parts.push(kit.box(0.34, 2.7, 0.34, palette.accent, { x, y: FLOOR, z: SZ + 1.6, r: 0.1 }));
  parts.push(kit.box(5, 0.3, 0.36, palette.accent, { x: SX, y: storeTop - 0.3, z: SZ + 1.6, r: 0.1 }));
  parts.push(kit.box(5.1, 0.34, 3.9, palette.roof, { x: SX, y: storeTop, z: SZ, r: 0.14 }));
  parts.push(kit.box(5.2, 0.16, 4, p.sign, { x: SX, y: storeTop + 0.04, z: SZ, r: 0.06 }));
  parts.push(kit.box(2.1, 0.16, 2.1, p.sign, { x: SX, y: storeTop + 0.34, z: SZ, r: 0.07 }));
  parts.push(chair(kit, trim, fabric, SX, storeTop + 0.5, SZ, 1.5));

  // Lumber on spacers and rolls of fabric under the store roof.
  const stackX = -5.9;
  const stackZ = SZ - 0.5;
  for (const dx of [-0.75, 0.75]) parts.push(kit.box(0.14, 0.12, 1, p.trunk, { x: stackX + dx, y: FLOOR, z: stackZ, r: 0.03 }));
  for (let layer = 0; layer < 4; layer += 1) {
    for (const dz of [-0.22, 0.22]) {
      parts.push(kit.box(2.3, 0.14, 0.38, plank, { x: stackX + (layer % 2 ? 0.06 : -0.06), y: FLOOR + 0.12 + layer * 0.16, z: stackZ + dz, r: 0.03 }));
    }
  }
  for (const [dx, dy] of [[-0.25, 0], [0.25, 0], [0, 0.42]] as const) {
    parts.push(rodZ(kit, 0.25, 1.5, fabric, -3.5 + dx, FLOOR + 0.25 + dy, SZ - 0.5));
  }

  // Assembly bench in the open: a chair half built, boards and fabric to hand.
  const BX = -5;
  const BZ = -1.3;
  const benchTop = FLOOR + 0.86;
  parts.push(kit.box(3.4, 0.16, 1.3, p.wood, { x: BX, y: benchTop - 0.16, z: BZ, r: 0.05 }));
  parts.push(kit.box(3, 0.1, 1, p.wood, { x: BX, y: FLOOR + 0.22, z: BZ, r: 0.04 }));
  for (const dx of [-1.5, 1.5]) {
    for (const dz of [-0.5, 0.5]) parts.push(kit.box(0.18, 0.72, 0.18, palette.accent, { x: BX + dx, y: FLOOR, z: BZ + dz, r: 0.05 }));
  }
  parts.push(chair(kit, chairWood, fabric, BX + 0.9, benchTop, BZ, 0.5, 0.35));
  parts.push(kit.box(1.2, 0.1, 0.24, plank, { x: BX - 0.8, y: benchTop, z: BZ + 0.3, r: 0.03 }));
  parts.push(kit.box(1.2, 0.1, 0.24, plank, { x: BX - 0.7, y: benchTop, z: BZ - 0.02, ry: 0.2, r: 0.03 }));
  parts.push(rodX(kit, 0.16, 0.9, fabric, BX - 0.8, benchTop + 0.16, BZ - 0.4));
  parts.push(kit.box(0.34, 0.22, 0.16, kit.materials.lamp, { x: left - 0.06, y: FLOOR + 2.5, z: BZ, r: 0.07 }));

  // Finished chairs lined up at the edge of the yard.
  for (const [i, x] of [-6.5, -5.2, -3.9].entries()) {
    parts.push(chair(kit, chairWood, fabric, x, FLOOR, 0.9, 0.58, (i - 1) * 0.18));
  }

  parts.push(planter(kit, CX - 0.55, FLOOR, front + 0.5, trim));
  parts.push(crate(kit, left + 0.2, FLOOR, front + 0.75, 0.8, p.wood));

  return kit.group(parts.flat(), { ...BUILDING_ANCHORS, smoke: [] });
}

export function registerFurnitureFactoryModel(registry: ModelRegistry): void {
  registry.register('building.furnitureFactory', furnitureFactory);
}
