/**
 * Glassworks: a round domed kiln with glowing working holes, and a
 * barrel-vaulted gallery beside it with the glass-blowing sign in its arch.
 * In front: the blowpipe and bench, a rack of panes and the sand heap.
 */
import type { Object3D } from 'three';
import type { ModelRegistry } from '../../ModelRegistry';
import { buildingPalette, itemColor } from '../../theme';
import { BUILDING_ANCHORS } from '../buildings';
import type { Kit } from '../kit';
import { HALF_PI, bush, framedWindow } from '../parts';
import { FLOOR, cornerPosts, disc, drum, hall, pipe, planter, sack, slab, type Parts } from './shared';

function glassworks(kit: Kit): Object3D {
  const theme = kit.theme;
  const palette = buildingPalette(theme, 'glassworks');
  const p = theme.props;
  const trim = palette.trim ?? palette.accent;
  const sand = itemColor(theme, 'sand');
  const glass = itemColor(theme, 'glass');
  const glow = kit.materials.lamp;
  const parts: Parts = [slab(kit)];

  // Kiln: brick drum, dome, a short lantern chimney.
  const KX = -3.9;
  const KZ = -3.6;
  const KR = 2.5;
  const drumTop = FLOOR + 2.4;
  parts.push(kit.cyl(KR + 0.12, KR + 0.2, 0.55, p.rock, { x: KX, y: FLOOR, z: KZ }, 26));
  parts.push(kit.cyl(KR, KR, 2.4, palette.accent, { x: KX, y: FLOOR, z: KZ }, 26));
  parts.push(kit.cyl(KR + 0.1, KR + 0.1, 0.24, p.sign, { x: KX, y: drumTop - 0.14, z: KZ }, 26));
  parts.push(kit.dome(KR, 2.2, KR, palette.roof, { x: KX, y: drumTop, z: KZ }));
  parts.push(kit.cyl(0.6, 0.8, 1.3, palette.accent, { x: KX, y: drumTop + 1.95, z: KZ }, 16));
  parts.push(kit.cyl(0.74, 0.74, 0.22, p.sign, { x: KX, y: drumTop + 3.15, z: KZ }, 16));
  // Working holes glowing on the front, buttresses between them and round the back.
  for (const angle of [-0.95, 0, 0.95]) {
    const x = KX + Math.sin(angle) * (KR - 0.05);
    const z = KZ + Math.cos(angle) * (KR - 0.05);
    parts.push(kit.box(1.1, 1.25, 0.34, trim, { x, y: FLOOR + 0.6, z, ry: angle, r: 0.16 }));
    const gx = KX + Math.sin(angle) * (KR + 0.02);
    const gz = KZ + Math.cos(angle) * (KR + 0.02);
    parts.push(kit.box(0.66, 0.8, 0.3, glow, { x: gx, y: FLOOR + 0.78, z: gz, ry: angle, r: 0.14 }));
  }
  for (const angle of [-0.48, 0.48, 1.6, 2.4, 3.14, -2.4, -1.6]) {
    parts.push(kit.box(0.5, 2.3, 0.4, p.sign, { x: KX + Math.sin(angle) * (KR + 0.04), y: FLOOR, z: KZ + Math.cos(angle) * (KR + 0.04), ry: angle, r: 0.12 }));
  }

  // Gallery under a barrel vault, its arch facing the yard.
  const CX = 2.75;
  const CZ = -3.9;
  const W = 5.2;
  const D = 4.8;
  const WALL = 2.5;
  const eave = FLOOR + WALL;
  const front = CZ + D / 2;
  const VAULT = 2.1;
  parts.push(hall(kit, { cx: CX, cz: CZ, w: W, d: D, h: WALL, wall: palette.wall }));
  parts.push(cornerPosts(kit, { cx: CX, cz: CZ, w: W, d: D, h: WALL - 0.1, paint: palette.accent }));
  parts.push(kit.barrel(D + 0.5, VAULT, W + 0.7, palette.roof, { x: CX, y: eave - 0.02, z: CZ, ry: HALF_PI }));
  parts.push(kit.barrel(0.14, VAULT - 0.3, W + 0.1, palette.wall, { x: CX, y: eave - 0.02, z: front + 0.24, ry: HALF_PI }));
  parts.push(kit.barrel(0.22, VAULT + 0.08, W + 0.86, p.sign, { x: CX, y: eave - 0.02, z: front + 0.12, ry: HALF_PI }));
  parts.push(kit.barrel(0.22, VAULT + 0.08, W + 0.86, p.sign, { x: CX, y: eave - 0.02, z: CZ - D / 2 - 0.2, ry: HALF_PI }));
  parts.push(kit.box(W + 0.7, 0.24, 0.3, p.sign, { x: CX, y: eave - 0.2, z: front + 0.2, r: 0.08 }));

  // Sign in the arch: a bubble of glass on a blowpipe, with a sparkle.
  const signY = eave + 0.92;
  const signZ = front + 0.32;
  parts.push(disc(kit, 0.84, 0.1, trim, CX, signY, signZ, 28));
  parts.push(kit.blob(0.4, 0.4, 0.16, glass, { x: CX - 0.2, y: signY - 0.52, z: signZ + 0.02 }));
  parts.push(kit.box(0.95, 0.09, 0.09, p.sign, { x: CX + 0.3, y: signY + 0.22, z: signZ + 0.08, rz: 0.62, r: 0.03 }));
  for (const rz of [0, HALF_PI]) parts.push(kit.box(0.34, 0.08, 0.06, p.sign, { x: CX - 0.36, y: signY + 0.34, z: signZ + 0.07, rz, r: 0.02 }));

  // Shop window, door and a side window.
  parts.push(framedWindow(kit, { face: 'front', along: CX - 0.85, wall: front, y: FLOOR + 0.8, width: 2.6, height: 1.5, sill: palette.accent }));
  parts.push(kit.box(1.3, 2.1, 0.12, p.sign, { x: CX + 1.65, y: FLOOR, z: front + 0.05, r: 0.06 }));
  parts.push(kit.box(1.05, 1.95, 0.16, trim, { x: CX + 1.65, y: FLOOR, z: front + 0.08, r: 0.06 }));
  parts.push(kit.box(0.6, 0.6, 0.2, kit.materials.window, { x: CX + 1.65, y: FLOOR + 1.1, z: front + 0.1, r: 0.08 }));
  parts.push(kit.box(0.3, 0.2, 0.16, glow, { x: CX + 1.65, y: FLOOR + 2.2, z: front + 0.1, r: 0.06 }));
  parts.push(framedWindow(kit, { face: 'right', along: CZ, wall: CX + W / 2, y: FLOOR + 0.9, width: 2.0, sill: palette.accent }));

  // Annealing oven between kiln and gallery, panes cooling on its table.
  const OX = -0.55;
  const OZ = -4.6;
  parts.push(kit.box(1.5, 1.2, 2.6, palette.accent, { x: OX, y: FLOOR, z: OZ, r: 0.12 }));
  parts.push(kit.barrel(2.7, 0.5, 1.5, trim, { x: OX, y: FLOOR + 1.18, z: OZ, ry: HALF_PI }));
  parts.push(kit.box(0.9, 0.6, 0.12, glow, { x: OX, y: FLOOR + 0.5, z: OZ + 1.3, r: 0.1 }));
  parts.push(kit.box(1.3, 0.12, 1.5, p.darkMetal, { x: OX, y: FLOOR + 0.42, z: OZ + 2.05, r: 0.04 }));
  for (const sx of [-1, 1]) parts.push(kit.box(0.12, 0.44, 0.12, p.darkMetal, { x: OX + sx * 0.55, y: FLOOR, z: OZ + 2.65, r: 0.04 }));
  parts.push(kit.box(1.0, 0.05, 0.9, glass, { x: OX, y: FLOOR + 0.54, z: OZ + 2.15, r: 0.02 }));

  // Blowing place in front of the kiln: pipe on a stand, a glowing gather over the marver.
  const BX = KX;
  parts.push(kit.box(0.14, 1.05, 0.14, p.darkMetal, { x: BX, y: FLOOR, z: -0.35, r: 0.04 }));
  parts.push(kit.box(0.4, 0.12, 0.14, p.darkMetal, { x: BX, y: FLOOR + 1.0, z: -0.35, r: 0.04 }));
  parts.push(pipe(kit, 0.05, 2.0, 'z', BX, FLOOR + 1.18, -0.2, p.metal, 8));
  parts.push(kit.blob(0.24, 0.24, 0.3, glow, { x: BX, y: FLOOR + 0.94, z: 0.9 }));
  parts.push(kit.box(1.1, 0.14, 0.9, p.metal, { x: BX, y: FLOOR + 0.6, z: 0.95, r: 0.05 }));
  for (const sx of [-1, 1]) parts.push(kit.box(0.14, 0.62, 0.8, p.darkMetal, { x: BX + sx * 0.42, y: FLOOR, z: 0.95, r: 0.05 }));
  // Stool and a bucket of water.
  parts.push(kit.cyl(0.26, 0.2, 0.5, p.wood, { x: BX + 1.2, y: FLOOR, z: 0.6 }, 10));
  parts.push(kit.cyl(0.24, 0.2, 0.36, p.metal, { x: BX - 1.15, y: FLOOR, z: 0.75 }, 10));
  parts.push(kit.cyl(0.2, 0.2, 0.04, kit.materials.window, { x: BX - 1.15, y: FLOOR + 0.34, z: 0.75 }, 10));

  // Rack of finished panes leaning in front of the shop window.
  const RX = CX - 1.0;
  const RZ = front + 1.0;
  parts.push(kit.box(2.5, 0.14, 1.1, p.wood, { x: RX, y: FLOOR, z: RZ, r: 0.05 }));
  for (const sx of [-1, 1]) parts.push(kit.box(0.14, 1.75, 0.14, p.wood, { x: RX + sx * 1.1, y: FLOOR + 0.1, z: RZ - 0.3, rx: 0.2, r: 0.04 }));
  parts.push(kit.box(2.3, 0.12, 0.12, p.wood, { x: RX, y: FLOOR + 1.62, z: RZ - 0.14, r: 0.04 }));
  for (let i = 0; i < 4; i += 1) {
    parts.push(kit.box(1.9, 1.45, 0.05, i % 2 ? kit.materials.window : glass, { x: RX + (i % 2 ? 0.06 : -0.06), y: FLOOR + 0.14, z: RZ - 0.12 + i * 0.13, rx: 0.2, r: 0.02 }));
  }

  // Sand: a heap with a shovel stuck in it, and sacks.
  parts.push(kit.dome(1.0, 0.7, 0.85, sand, { x: -6.5, y: FLOOR - 0.02, z: 0.75 }));
  parts.push(kit.dome(0.55, 0.38, 0.5, sand, { x: -5.6, y: FLOOR - 0.02, z: 1.25 }));
  parts.push(kit.box(0.08, 1.2, 0.08, p.wood, { x: -6.3, y: FLOOR + 0.5, z: 0.9, rz: -0.3, r: 0.03 }));
  parts.push(kit.box(0.3, 0.36, 0.06, p.metal, { x: -6.42, y: FLOOR + 0.3, z: 0.9, rz: -0.3, r: 0.03 }));
  parts.push(sack(kit, -7.0, FLOOR, -0.55, sand, trim));
  parts.push(sack(kit, -6.55, FLOOR, -0.95, sand, trim, 0.9));

  // A crate of panes packed on edge, ready to go.
  parts.push(kit.box(1.0, 0.55, 0.8, p.wood, { x: -1.5, y: FLOOR, z: 1.25, r: 0.06 }));
  for (const dx of [-0.25, 0, 0.25]) parts.push(kit.box(0.05, 0.7, 0.6, glass, { x: -1.5 + dx, y: FLOOR + 0.3, z: 1.25, r: 0.02 }));

  // Small props.
  parts.push(planter(kit, CX + 2.75, FLOOR, front + 0.5, trim));
  parts.push(drum(kit, 0.75, FLOOR, 1.2, palette.roof));
  parts.push(bush(kit, 4.6, FLOOR - 0.05, front + 1.3));

  return kit.group(parts.flat(), { ...BUILDING_ANCHORS, smoke: [[KX, drumTop + 3.6, KZ]] });
}

export function registerGlassworksModel(registry: ModelRegistry): void {
  registry.register('building.glassworks', glassworks);
}
