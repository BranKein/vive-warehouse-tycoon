/**
 * Waste disposal plant: a flat-roofed block with the recycling arrows on its
 * front, a sorting conveyor climbing into its side from a tipping hopper, a
 * scrubber with a filter stack behind, and skips of slag, waste oil and
 * e-waste waiting in front.
 */
import type { Object3D } from 'three';
import type { ModelRegistry } from '../../ModelRegistry';
import { buildingPalette, itemColor } from '../../theme';
import { BUILDING_ANCHORS } from '../buildings';
import type { Kit, Paint } from '../kit';
import { bush, flatRoof, framedWindow, rollerDoor } from '../parts';
import { FLOOR, chimney, cornerPosts, disc, drum, hall, pipe, slab, type Parts } from './shared';

/** Three chasing arrows in a triangle, facing the front; (x, y, z) is the centre. */
function recycleArrows(kit: Kit, size: number, paint: Paint, x: number, y: number, z: number): Object3D[] {
  const parts: Object3D[] = [];
  for (let k = 0; k < 3; k += 1) {
    const phi = Math.PI / 2 + (k * Math.PI * 2) / 3;
    const cx = Math.cos(phi) * size * 0.5;
    const cy = Math.sin(phi) * size * 0.5;
    const tx = -Math.sin(phi);
    const ty = Math.cos(phi);
    const bar = kit.box(size * 0.24, size * 0.8, 0.12, paint, { r: 0.04 });
    bar.position.set(x + cx - tx * size * 0.12, y + cy - ty * size * 0.12, z);
    bar.rotation.z = phi;
    parts.push(bar);
    const head = kit.cone(size * 0.3, size * 0.44, paint, {}, 3);
    head.position.set(x + cx + tx * size * 0.46, y + cy + ty * size * 0.46, z);
    head.rotation.set(0, 0, phi);
    head.scale.set(1, 1, 0.3);
    parts.push(head);
  }
  return parts;
}

/** Open skip on runners; `fill` is what lies in it. */
function skip(kit: Kit, x: number, z: number, paint: Paint): Object3D[] {
  const p = kit.theme.props;
  return [
    kit.box(1.7, 0.75, 1.15, paint, { x, y: FLOOR + 0.12, z, r: 0.12 }),
    kit.box(1.8, 0.14, 1.25, p.sign, { x, y: FLOOR + 0.8, z, r: 0.06 }),
    kit.box(1.5, 0.1, 0.95, p.darkMetal, { x, y: FLOOR + 0.88, z, r: 0.03 }),
    kit.box(0.16, 0.14, 1.2, p.darkMetal, { x: x - 0.55, y: FLOOR, z, r: 0.04 }),
    kit.box(0.16, 0.14, 1.2, p.darkMetal, { x: x + 0.55, y: FLOOR, z, r: 0.04 }),
  ];
}

function wasteDisposal(kit: Kit): Object3D {
  const theme = kit.theme;
  const palette = buildingPalette(theme, 'wasteDisposal');
  const p = theme.props;
  const trim = palette.trim ?? palette.accent;
  const slag = itemColor(theme, 'slag');
  const wasteOil = itemColor(theme, 'wasteOil');
  const eWaste = itemColor(theme, 'eWaste');
  const parts: Parts = [slab(kit)];

  // Plant block.
  const CX = 2.2;
  const CZ = -3.8;
  const W = 6.0;
  const D = 5.2;
  const WALL = 3.6;
  const top = FLOOR + WALL;
  const front = CZ + D / 2;
  const left = CX - W / 2;
  parts.push(hall(kit, { cx: CX, cz: CZ, w: W, d: D, h: WALL, wall: palette.wall }));
  parts.push(cornerPosts(kit, { cx: CX, cz: CZ, w: W, d: D, h: WALL, paint: palette.accent }));
  parts.push(flatRoof(kit, { cx: CX, cz: CZ, width: W, depth: D, top, roof: palette.roof, cap: palette.accent }));
  parts.push(kit.box(W + 0.1, 0.3, 0.3, palette.roof, { x: CX, y: FLOOR + 2.75, z: front + 0.02, r: 0.08 }));
  // Roof plant: fan housing and two vents.
  parts.push(kit.box(1.6, 0.7, 1.4, p.metal, { x: CX + 1.4, y: top + 0.4, z: CZ - 0.9, r: 0.14 }));
  parts.push(kit.cyl(0.42, 0.42, 0.12, p.darkMetal, { x: CX + 1.4, y: top + 1.08, z: CZ - 0.9 }, 14));
  for (const z of [CZ + 0.6, CZ + 1.5]) parts.push(kit.cyl(0.26, 0.2, 0.5, trim, { x: CX - 1.6, y: top + 0.4, z }, 10));

  // Recycling arrows on a white disc.
  const SX = CX - 1.45;
  const SY = FLOOR + 1.55;
  parts.push(disc(kit, 1.2, 0.12, p.sign, SX, SY, front + 0.04, 30));
  parts.push(disc(kit, 1.28, 0.08, palette.roof, SX, SY, front + 0.01, 30));
  parts.push(recycleArrows(kit, 1.15, palette.roof, SX, SY - 0.05, front + 0.14));

  parts.push(rollerDoor(kit, { cx: CX + 1.55, wall: front, y: FLOOR, width: 2.2, height: 2.2, paint: trim }));
  parts.push(framedWindow(kit, { face: 'right', along: CZ, wall: CX + W / 2, y: FLOOR + 1.3, width: 2.2, sill: palette.accent }));

  // Sorting conveyor from the tipping hopper up into the side of the block.
  const BZ = -2.3;
  const x0 = -6.0;
  const y0 = FLOOR + 0.95;
  const x1 = left + 0.1;
  const y1 = FLOOR + 2.55;
  const length = Math.hypot(x1 - x0, y1 - y0);
  const rise = Math.atan2(y1 - y0, x1 - x0);
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  const onBelt = (t: number, lift: number): [number, number] => [x0 + (x1 - x0) * t - Math.sin(rise) * lift, y0 + (y1 - y0) * t + Math.cos(rise) * lift];
  parts.push(kit.box(length, 0.16, 0.9, p.tire, { x: mx, y: my - 0.08, z: BZ, rz: rise, r: 0.06 }));
  for (const sz of [-1, 1]) parts.push(kit.box(length, 0.32, 0.1, palette.accent, { x: mx, y: my - 0.12, z: BZ + sz * 0.5, rz: rise, r: 0.04 }));
  for (const t of [0.3, 0.68]) {
    const [bx, by] = onBelt(t, -0.1);
    for (const sz of [-1, 1]) parts.push(kit.box(0.16, by - FLOOR, 0.16, p.darkMetal, { x: bx, y: FLOOR, z: BZ + sz * 0.5, r: 0.05 }));
  }
  const cargo: Array<[number, Paint, number]> = [[0.2, slag, 0.2], [0.42, eWaste, 0.16], [0.62, wasteOil, 0.18], [0.82, slag, 0.15]];
  for (const [t, paint, size] of cargo) {
    const [bx, by] = onBelt(t, 0.08);
    parts.push(kit.box(size * 2, size * 1.5, size * 2, paint, { x: bx, y: by, z: BZ + (t > 0.5 ? 0.1 : -0.1), rz: rise, r: 0.08 }));
  }
  parts.push(kit.box(0.3, 1.2, 1.4, p.darkMetal, { x: left - 0.02, y: FLOOR + 2.0, z: BZ, r: 0.1 }));
  // Hopper with slag tipped in.
  const HX = -6.35;
  parts.push(kit.box(1.5, 0.95, 1.5, trim, { x: HX, y: FLOOR, z: BZ, r: 0.14 }));
  parts.push(kit.box(1.62, 0.14, 1.62, p.sign, { x: HX, y: FLOOR + 0.88, z: BZ, r: 0.06 }));
  parts.push(kit.dome(0.6, 0.36, 0.6, slag, { x: HX, y: FLOOR + 0.98, z: BZ }));

  // Scrubber and filter stack behind, ducted from the block.
  const FX = -2.9;
  const FZ = -5.2;
  parts.push(kit.box(2.2, 0.5, 2.2, p.rock, { x: FX, y: FLOOR, z: FZ, r: 0.12 }));
  parts.push(kit.cyl(0.95, 0.95, 2.6, p.metal, { x: FX, y: FLOOR + 0.5, z: FZ }, 18));
  for (const y of [1.1, 2.5]) parts.push(kit.cyl(1.0, 1.0, 0.16, trim, { x: FX, y: FLOOR + y, z: FZ }, 18));
  parts.push(kit.cyl(0.5, 0.95, 0.7, palette.roof, { x: FX, y: FLOOR + 3.08, z: FZ }, 18));
  parts.push(chimney(kit, { x: FX, z: FZ, y: FLOOR + 3.75, r: 0.5, h: 3.6, body: palette.wall }));
  for (const y of [4.4, 5.3, 6.2]) parts.push(kit.cyl(0.68, 0.68, 0.36, palette.accent, { x: FX, y: FLOOR + y, z: FZ }, 16));
  parts.push(pipe(kit, 0.3, 1.5, 'x', (FX + left) / 2 + 0.4, FLOOR + 2.1, FZ, trim, 12));
  parts.push(kit.box(0.3, 2.6, 0.08, p.darkMetal, { x: FX, y: FLOOR + 0.5, z: FZ + 0.98, r: 0.03 }));

  // Three skips in front: slag, waste oil in drums, e-waste.
  const skipZ = 0.75;
  parts.push(skip(kit, -6.2, skipZ, palette.accent));
  parts.push(kit.dome(0.68, 0.42, 0.42, slag, { x: -6.2, y: FLOOR + 0.88, z: skipZ }));
  parts.push(skip(kit, -4.1, skipZ, trim));
  for (const dx of [-0.4, 0.4]) parts.push(drum(kit, -4.1 + dx, FLOOR + 0.6, skipZ, wasteOil, 0.28, 0.6));
  parts.push(skip(kit, -2.0, skipZ, palette.roof));
  parts.push(kit.box(0.6, 0.4, 0.5, eWaste, { x: -2.3, y: FLOOR + 0.9, z: skipZ - 0.1, ry: 0.3, r: 0.05 }));
  parts.push(kit.box(0.5, 0.3, 0.6, p.metal, { x: -1.7, y: FLOOR + 0.9, z: skipZ + 0.1, ry: -0.4, r: 0.05 }));
  parts.push(kit.box(0.4, 0.3, 0.3, eWaste, { x: -1.95, y: FLOOR + 1.2, z: skipZ, ry: 0.8, rz: 0.2, r: 0.05 }));

  // Wheelie bins under the sign, bollards, greenery.
  for (const [x, paint] of [[SX - 0.5, palette.roof], [SX + 0.4, palette.accent]] as const) {
    parts.push(kit.box(0.7, 0.85, 0.65, paint, { x, y: FLOOR + 0.06, z: front + 0.55, r: 0.1 }));
    parts.push(kit.box(0.76, 0.1, 0.72, p.darkMetal, { x, y: FLOOR + 0.9, z: front + 0.55, r: 0.04 }));
  }
  for (const x of [CX + 0.2, CX + 2.9]) parts.push(kit.cyl(0.1, 0.12, 0.6, p.hazard, { x, y: FLOOR, z: front + 1.3 }, 8));
  parts.push(bush(kit, -6.9, FLOOR - 0.05, -4.6));

  return kit.group(parts.flat(), { ...BUILDING_ANCHORS, smoke: [[FX, FLOOR + 7.7, FZ]] });
}

export function registerWasteDisposalModel(registry: ModelRegistry): void {
  registry.register('building.wasteDisposal', wasteDisposal);
}
