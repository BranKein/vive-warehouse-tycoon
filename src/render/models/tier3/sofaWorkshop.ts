/**
 * Sofa workshop (tier 3): a hall under a round vault with a big sofa on its
 * front arch, and a striped awning on the left where a sofa is being
 * upholstered between fabric rolls and the chairs it is made from.
 */
import type { Object3D } from 'three';
import type { ModelRegistry } from '../../ModelRegistry';
import { buildingPalette, itemColor } from '../../theme';
import { BUILDING_ANCHORS } from '../buildings';
import type { Kit } from '../kit';
import { HALF_PI, bush, framedWindow, rollerDoor } from '../parts';
import { FLOOR, type Parts, disc, glassBand, hall, pot, sofa } from './shared';

function sofaWorkshop(kit: Kit): Object3D {
  const theme = kit.theme;
  const palette = buildingPalette(theme, 'sofaWorkshop');
  const p = theme.props;
  const trim = palette.trim ?? palette.accent;
  const sofaPaint = itemColor(theme, 'sofa');
  const fabric = itemColor(theme, 'fabric');
  const chair = itemColor(theme, 'chair');
  const parts: Parts = [];

  const CX = 1.4;
  const CZ = -3.2;
  const W = 8;
  const D = 6.6;
  const WALL = 3.2;
  const RISE = 2.3;
  const eave = FLOOR + WALL;
  const front = CZ + D / 2;
  const left = CX - W / 2;
  const right = CX + W / 2;

  parts.push(kit.box(13.2, FLOOR, 8.6, p.concrete, { x: -0.7, z: -2.5, r: 0.1 }));
  parts.push(hall(kit, { cx: CX, cz: CZ, w: W, d: D, h: WALL, wall: palette.wall }));
  parts.push(kit.box(W + 0.1, 0.34, 0.3, palette.accent, { x: CX, y: eave - 0.32, z: front + 0.02, r: 0.08 }));

  // Round vault: roof, two ribs, gutters, and a pale arch around the front end.
  const roofFront = CZ + (D + 0.9) / 2;
  parts.push(kit.barrel(D + 0.9, RISE, W + 0.9, palette.roof, { x: CX, y: eave - 0.05, z: CZ, ry: HALF_PI }));
  for (const z of [CZ - 1.5, CZ + 1.5]) {
    parts.push(kit.barrel(0.34, RISE + 0.1, W + 1.1, palette.accent, { x: CX, y: eave - 0.05, z, ry: HALF_PI }));
  }
  parts.push(kit.barrel(0.3, RISE + 0.14, W + 1.16, p.sign, { x: CX, y: eave - 0.05, z: roofFront - 0.06, ry: HALF_PI }));
  parts.push(kit.barrel(0.3, RISE - 0.22, W + 0.3, palette.wall, { x: CX, y: eave - 0.05, z: roofFront - 0.01, ry: HALF_PI }));
  for (const side of [-1, 1]) {
    parts.push(kit.box(0.3, 0.26, D + 0.9, p.sign, { x: CX + side * (W / 2 + 0.38), y: eave - 0.24, z: CZ, r: 0.1 }));
  }
  // Vent on the crown.
  parts.push(kit.box(1.1, 0.5, 1.1, p.metal, { x: CX, y: eave + RISE - 0.15, z: CZ, r: 0.12 }));
  parts.push(kit.box(1.35, 0.14, 1.35, p.sign, { x: CX, y: eave + RISE + 0.33, z: CZ, r: 0.06 }));

  // The sofa on the arch says what is made here.
  parts.push(sofa(kit, { x: CX, y: eave + 0.2, z: roofFront + 0.3, w: 3.4, h: 1.45, d: 0.4, paint: sofaPaint, cushion: p.sign }));

  // Dispatch door, showroom window with a finished sofa on a plinth in front of it.
  parts.push(rollerDoor(kit, { cx: CX + 2.3, wall: front, y: FLOOR, paint: trim }));
  parts.push(glassBand(kit, { face: 'front', along: CX - 1.6, wall: front, y: FLOOR + 0.9, width: 3.6, height: 1.6, panes: 3 }));
  parts.push(kit.box(3.9, 0.14, 0.4, palette.accent, { x: CX - 1.6, y: FLOOR + 0.8, z: front + 0.12, r: 0.05 }));
  parts.push(kit.box(2.5, 0.16, 1.2, trim, { x: CX - 1.6, y: FLOOR, z: front + 0.95, r: 0.06 }));
  parts.push(sofa(kit, { x: CX - 1.6, y: FLOOR + 0.16, z: front + 0.95, w: 2.1, h: 0.85, d: 0.85, paint: sofaPaint, cushion: fabric }));
  for (const z of [CZ - 1.7, CZ + 1.7]) {
    parts.push(framedWindow(kit, { face: 'right', along: z, wall: right, y: FLOOR + 1.1, sill: palette.accent }));
  }

  // Upholstery bay on the left under a striped awning.
  const BAY_X = -4.9;
  const POST_X = -7.0;
  const BAY_Z = -2.7;
  const pitch = Math.atan2(0.75, 4.6);
  for (let i = 0; i < 6; i += 1) {
    parts.push(kit.box(4.9, 0.2, 1.02, i % 2 ? p.sign : palette.roof, { x: BAY_X + 0.05, y: FLOOR + 2.62, z: BAY_Z - 2.5 + i, rz: pitch, r: 0.06 }));
  }
  for (const z of [BAY_Z - 2.8, BAY_Z, BAY_Z + 2.8]) {
    parts.push(kit.box(0.3, 2.3, 0.3, palette.accent, { x: POST_X, y: FLOOR, z, r: 0.09 }));
  }
  parts.push(kit.box(0.34, 0.26, 6.2, palette.accent, { x: POST_X, y: FLOOR + 2.1, z: BAY_Z, r: 0.08 }));
  parts.push(kit.box(4.5, 1.5, 0.24, palette.wall, { x: BAY_X + 0.1, y: FLOOR, z: BAY_Z - 3.0, r: 0.08 }));
  parts.push(kit.box(4.5, 0.2, 0.3, palette.accent, { x: BAY_X + 0.1, y: FLOOR + 1.45, z: BAY_Z - 3.0, r: 0.06 }));

  // Bench with a sofa half covered: bare timber frame, one arm and a cushion done, cloth draped over the back.
  const benchZ = BAY_Z + 0.4;
  parts.push(kit.box(3.0, 0.16, 1.5, p.wood, { x: BAY_X, y: FLOOR + 0.6, z: benchZ, r: 0.05 }));
  for (const dx of [-1.15, 1.15]) parts.push(kit.box(0.24, 0.62, 1.3, p.trunk, { x: BAY_X + dx, y: FLOOR, z: benchZ, r: 0.06 }));
  const wipY = FLOOR + 0.76;
  parts.push(kit.box(2.2, 0.3, 0.9, p.wood, { x: BAY_X, y: wipY, z: benchZ, r: 0.06 }));
  parts.push(kit.box(2.2, 0.85, 0.26, p.wood, { x: BAY_X, y: wipY, z: benchZ - 0.32, r: 0.06 }));
  parts.push(kit.box(0.44, 0.62, 1.0, sofaPaint, { x: BAY_X + 0.95, y: wipY, z: benchZ, r: 0.1 }));
  parts.push(kit.box(0.8, 0.16, 0.6, sofaPaint, { x: BAY_X + 0.3, y: wipY + 0.3, z: benchZ + 0.1, r: 0.07 }));
  parts.push(kit.box(1.0, 0.5, 0.34, fabric, { x: BAY_X - 0.55, y: wipY + 0.42, z: benchZ - 0.32, r: 0.1 }));
  parts.push(kit.box(0.9, 0.06, 0.8, fabric, { x: BAY_X - 0.6, y: wipY + 0.3, z: benchZ + 0.1, r: 0.03 }));

  // Sewing machine on its own table.
  const sewX = BAY_X + 1.3;
  const sewZ = BAY_Z - 2.0;
  parts.push(kit.box(1.3, 0.7, 0.8, trim, { x: sewX, y: FLOOR, z: sewZ, r: 0.1 }));
  parts.push(kit.box(0.9, 0.16, 0.34, p.sign, { x: sewX, y: FLOOR + 0.7, z: sewZ, r: 0.05 }));
  parts.push(kit.box(0.26, 0.5, 0.3, p.sign, { x: sewX + 0.3, y: FLOOR + 0.84, z: sewZ, r: 0.08 }));
  parts.push(kit.box(0.8, 0.2, 0.28, p.sign, { x: sewX + 0.02, y: FLOOR + 1.2, z: sewZ, r: 0.08 }));
  parts.push(disc(kit, 0.17, 0.08, p.darkMetal, sewX + 0.47, FLOOR + 1.22, sewZ, 'x', 12));

  // Fabric rolls on a rack at the back, and a few standing in the corner.
  const rackX = BAY_X - 0.7;
  const rackZ = BAY_Z - 2.55;
  for (const dx of [-1.2, 1.2]) parts.push(kit.box(0.2, 2.0, 0.5, p.darkMetal, { x: rackX + dx, y: FLOOR, z: rackZ, r: 0.06 }));
  const rolls = [fabric, palette.roof, trim] as const;
  rolls.forEach((paint, i) => {
    const y = FLOOR + 0.45 + i * 0.62;
    parts.push(disc(kit, 0.26, 2.2, paint, rackX, y, rackZ, 'x', 14));
    parts.push(disc(kit, 0.09, 2.7, p.sign, rackX, y, rackZ, 'x', 8));
  });
  const standing = [
    [-6.5, 0.6, fabric],
    [-5.95, 0.75, palette.accent],
    [-6.3, 1.15, trim],
  ] as const;
  for (const [x, dz, paint] of standing) {
    parts.push(kit.cyl(0.24, 0.24, 1.5, paint, { x, y: FLOOR, z: BAY_Z + 1.9 + dz - 0.6 }, 12));
  }

  // Chairs waiting to become sofas.
  for (const [x, z] of [[-3.7, 0.55], [-4.7, 0.85]] as const) {
    parts.push(kit.box(0.6, 0.12, 0.6, chair, { x, y: FLOOR + 0.42, z, r: 0.04 }));
    parts.push(kit.box(0.6, 0.75, 0.12, chair, { x, y: FLOOR + 0.5, z: z - 0.24, r: 0.04 }));
    parts.push(kit.box(0.5, 0.42, 0.5, p.trunk, { x, y: FLOOR, z, r: 0.03 }));
  }

  parts.push(pot(kit, CX + 0.75, FLOOR, front + 0.5, palette.accent));
  parts.push(pot(kit, CX + 3.85, FLOOR, front + 0.5, palette.accent));
  parts.push(bush(kit, left + 0.3, FLOOR - 0.05, front + 0.5));

  return kit.group(parts.flat(), { ...BUILDING_ANCHORS, smoke: [] });
}

export function registerSofaWorkshop(registry: ModelRegistry): void {
  registry.register('building.sofaWorkshop', sofaWorkshop);
}
