/**
 * Textile mill: a weaving shed under a sawtooth roof, a square water-tank
 * tower carrying a thread spool sign, a loom under an awning, cotton bales
 * going in and rolls of fabric coming out.
 */
import type { Object3D } from 'three';
import type { ModelRegistry } from '../../ModelRegistry';
import { buildingPalette, itemColor } from '../../theme';
import { BUILDING_ANCHORS } from '../buildings';
import type { Kit } from '../kit';
import { HALF_PI, barnDoor, bush, flatRoof, framedWindow } from '../parts';
import { FLOOR, cornerPosts, disc, hall, pipe, planter, slab, type Parts } from './shared';

function textileMill(kit: Kit): Object3D {
  const theme = kit.theme;
  const palette = buildingPalette(theme, 'textileMill');
  const p = theme.props;
  const trim = palette.trim ?? palette.accent;
  const cotton = itemColor(theme, 'cotton');
  const fabric = itemColor(theme, 'fabric');
  const parts: Parts = [slab(kit, 13.2, 8.8, -0.8, -2.5)];

  // Weaving shed.
  const CX = -1.6;
  const CZ = -3.4;
  const W = 8.4;
  const D = 6.0;
  const WALL = 2.8;
  const eave = FLOOR + WALL;
  const front = CZ + D / 2;
  const left = CX - W / 2;
  parts.push(hall(kit, { cx: CX, cz: CZ, w: W, d: D, h: WALL, wall: palette.wall }));
  parts.push(cornerPosts(kit, { cx: CX, cz: CZ, w: W, d: D, h: WALL, paint: palette.accent }));
  parts.push(kit.box(W + 0.1, 0.3, 0.3, palette.accent, { x: CX, y: eave - 0.28, z: front + 0.02, r: 0.08 }));

  // Sawtooth roof: three teeth, glazed on the steep side.
  const TEETH = 3;
  const tooth = W / TEETH;
  const RISE = 1.4;
  const pitch = Math.atan2(RISE, tooth);
  for (let i = 0; i < TEETH; i += 1) {
    const x0 = left + i * tooth;
    const cx = x0 + tooth / 2;
    parts.push(kit.prism(D - 0.1, RISE, tooth, palette.wall, { x: cx, y: eave - 0.02, z: CZ, ry: HALF_PI }, 1));
    parts.push(kit.box(tooth / Math.cos(pitch) + 0.1, 0.28, D + 0.8, palette.roof, { x: cx - 0.06, y: eave + RISE / 2 - 0.02, z: CZ, rz: pitch, r: 0.1 }));
    parts.push(kit.box(0.14, RISE - 0.45, D - 1.0, kit.materials.window, { x: x0 + tooth + 0.02, y: eave + 0.22, z: CZ, r: 0.04 }));
    parts.push(kit.box(0.42, 0.22, D + 0.9, p.sign, { x: x0 + tooth - 0.06, y: eave + RISE - 0.02, z: CZ, r: 0.08 }));
  }

  parts.push(barnDoor(kit, { cx: CX + 2.3, wall: front, y: FLOOR, width: 2.4, height: 2.2, paint: trim }));
  for (const x of [CX - 3.0, CX - 0.9]) parts.push(framedWindow(kit, { face: 'front', along: x, wall: front, y: FLOOR + 1.0, sill: palette.accent }));
  parts.push(framedWindow(kit, { face: 'left', along: CZ, wall: left, y: FLOOR + 1.0, width: 2.2, sill: palette.accent }));

  // Tower with a wooden water tank and the thread spool sign.
  const TX = 4.15;
  const TZ = -2.6;
  const TW = 2.9;
  const TD = 3.6;
  const TH = 4.9;
  const ttop = FLOOR + TH;
  const tfront = TZ + TD / 2;
  parts.push(hall(kit, { cx: TX, cz: TZ, w: TW, d: TD, h: TH, wall: palette.wall }));
  parts.push(cornerPosts(kit, { cx: TX, cz: TZ, w: TW, d: TD, h: TH, paint: palette.accent }));
  parts.push(flatRoof(kit, { cx: TX, cz: TZ, width: TW, depth: TD, top: ttop, roof: palette.roof, cap: palette.accent }));
  parts.push(kit.cyl(0.95, 0.95, 1.2, p.wood, { x: TX, y: ttop + 0.5, z: TZ }, 16));
  parts.push(kit.cyl(0.99, 0.99, 0.12, p.darkMetal, { x: TX, y: ttop + 1.0, z: TZ }, 16));
  parts.push(kit.cone(1.15, 0.8, palette.roof, { x: TX, y: ttop + 1.68, z: TZ }, 16));
  for (const sx of [-1, 1]) parts.push(kit.box(0.16, 0.24, 1.5, p.darkMetal, { x: TX + sx * 0.5, y: ttop + 0.36, z: TZ, r: 0.04 }));
  parts.push(framedWindow(kit, { face: 'front', along: TX, wall: tfront, y: FLOOR + 0.95, width: 1.5, height: 1.2, sill: palette.accent }));
  parts.push(framedWindow(kit, { face: 'right', along: TZ, wall: TX + TW / 2, y: FLOOR + 2.6, width: 1.4, height: 1.2, sill: palette.accent }));
  const signY = FLOOR + 3.55;
  parts.push(disc(kit, 1.08, 0.12, p.sign, TX, signY, tfront + 0.03, 28));
  parts.push(kit.cyl(0.46, 0.46, 0.14, p.wood, { x: TX, y: signY - 0.62, z: tfront + 0.42 }, 16));
  parts.push(kit.cyl(0.34, 0.34, 1.0, fabric, { x: TX, y: signY - 0.5, z: tfront + 0.42 }, 16));
  parts.push(kit.cyl(0.46, 0.46, 0.14, p.wood, { x: TX, y: signY + 0.48, z: tfront + 0.42 }, 16));
  parts.push(kit.box(0.08, 1.7, 0.08, p.darkMetal, { x: TX, y: signY - 0.85, z: tfront + 0.14, rz: 0.75, r: 0.03 }));

  // Awning in front of the shed with a loom under it: warp from the back beam, cloth rolling up in front.
  const LX = -3.7;
  const LZ = front + 1.1;
  parts.push(kit.box(4.6, 0.2, 2.2, trim, { x: LX, y: FLOOR + 2.35, z: front + 1.05, rx: 0.14, r: 0.08 }));
  parts.push(kit.box(4.6, 0.16, 0.2, p.sign, { x: LX, y: FLOOR + 2.22, z: front + 2.15, r: 0.06 }));
  for (const sx of [-1, 1]) parts.push(kit.box(0.2, 2.3, 0.2, palette.accent, { x: LX + sx * 2.1, y: FLOOR, z: front + 1.95, r: 0.06 }));
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) parts.push(kit.box(0.16, 1.5, 0.16, p.wood, { x: LX + sx * 0.95, y: FLOOR, z: LZ + sz * 0.6, r: 0.05 }));
    parts.push(kit.box(0.16, 0.16, 1.4, p.wood, { x: LX + sx * 0.95, y: FLOOR + 1.45, z: LZ, r: 0.05 }));
  }
  parts.push(pipe(kit, 0.2, 2.0, 'x', LX, FLOOR + 0.95, LZ - 0.6, cotton, 12));
  parts.push(kit.box(1.6, 0.05, 1.25, cotton, { x: LX, y: FLOOR + 0.85, z: LZ, rx: 0.1, r: 0.02 }));
  parts.push(kit.box(1.74, 0.75, 0.08, p.metal, { x: LX, y: FLOOR + 0.75, z: LZ - 0.05, r: 0.03 }));
  parts.push(pipe(kit, 0.26, 2.0, 'x', LX, FLOOR + 0.72, LZ + 0.62, fabric, 12));

  // Cotton bales with straps, by the left corner.
  for (const [x, y, z] of [[-6.85, 0, -0.1], [-6.85, 0, 0.85], [-6.85, 0.62, 0.35]] as const) {
    parts.push(kit.box(1.0, 0.62, 0.8, cotton, { x, y: FLOOR + y, z, r: 0.16 }));
    for (const dz of [-0.2, 0.2]) parts.push(kit.box(1.03, 0.65, 0.07, trim, { x, y: FLOOR + y - 0.015, z: z + dz, r: 0.03 }));
  }

  // Fabric rolls stacked in front of the tower, a few dyed.
  const RX = TX;
  const RZ = tfront + 0.95;
  for (const sx of [-1, 1]) parts.push(kit.box(0.14, 0.8, 0.14, p.wood, { x: RX + sx * 0.4, y: FLOOR, z: RZ + 0.86, r: 0.04 }));
  const rolls = [[-0.54, 0, fabric], [0, 0, palette.roof], [0.54, 0, fabric], [-0.27, 0.46, trim], [0.27, 0.46, fabric], [0, 0.92, palette.accent]] as const;
  rolls.forEach(([dz, dy, paint], i) => {
    // Each roll a little shorter than the last, so the ends do not share a plane.
    parts.push(pipe(kit, 0.27, 1.9 - i * 0.08, 'x', RX, FLOOR + 0.27 + dy, RZ + dz, paint, 12));
  });

  // Washing line with dyed cloth beside the shed.
  const lineX = left - 1.1;
  for (const z of [CZ - 2.2, CZ + 1.6]) parts.push(kit.box(0.14, 2.2, 0.14, p.wood, { x: lineX, y: FLOOR, z, r: 0.04 }));
  parts.push(pipe(kit, 0.03, 3.8, 'z', lineX, FLOOR + 2.1, CZ - 0.3, p.darkMetal, 6));
  for (const [dz, paint, drop] of [[-1.6, fabric, 1.3], [-0.3, trim, 1.1], [0.95, palette.roof, 1.25]] as const) {
    parts.push(kit.box(0.06, drop, 0.9, paint, { x: lineX, y: FLOOR + 2.12 - drop, z: CZ + dz, r: 0.02 }));
  }

  // Greenery and a pot by the door.
  parts.push(bush(kit, -0.8, FLOOR - 0.05, front + 0.6));
  parts.push(planter(kit, CX + 4.05, FLOOR, front + 0.45, palette.accent));

  return kit.group(parts.flat(), { ...BUILDING_ANCHORS, smoke: [] });
}

export function registerTextileMillModel(registry: ModelRegistry): void {
  registry.register('building.textileMill', textileMill);
}
