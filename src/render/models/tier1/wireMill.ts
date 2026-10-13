/**
 * Wire mill: a long shed under a single-pitch roof, high at the front, with a
 * big cable reel on its wall. A drawing line runs along the front from the
 * pay-off reel through the dies to the take-up spool; a small smelter with a
 * stack stands at the side, cable drums and coils in front of it.
 */
import type { Object3D } from 'three';
import type { ModelRegistry } from '../../ModelRegistry';
import { buildingPalette, itemColor } from '../../theme';
import { BUILDING_ANCHORS } from '../buildings';
import type { Kit, Paint } from '../kit';
import { bush, framedWindow, rollerDoor } from '../parts';
import { FLOOR, chimney, cornerPosts, disc, hall, pipe, planter, slab, type Parts } from './shared';

/** Reel whose axle runs along `axis`: two flanges and the wound coil between them. (x, y, z) is its centre. */
function reel(kit: Kit, o: { x: number; y: number; z: number; r: number; width: number; axis: 'x' | 'z'; flange: Paint; coil: Paint; fill?: number }): Object3D[] {
  const parts: Object3D[] = [pipe(kit, o.r * (o.fill ?? 0.7), o.width, o.axis, o.x, o.y, o.z, o.coil, 16)];
  for (const side of [-1, 1]) {
    const off = side * (o.width / 2 + 0.05);
    parts.push(pipe(kit, o.r, 0.1, o.axis, o.x + (o.axis === 'x' ? off : 0), o.y, o.z + (o.axis === 'z' ? off : 0), o.flange, 18));
  }
  return parts;
}

function wireMill(kit: Kit): Object3D {
  const theme = kit.theme;
  const palette = buildingPalette(theme, 'wireMill');
  const p = theme.props;
  const trim = palette.trim ?? palette.accent;
  const ore = itemColor(theme, 'copperOre');
  const wire = itemColor(theme, 'wire');
  const glow = kit.materials.lamp;
  const parts: Parts = [slab(kit)];

  // Shed: single-pitch roof rising to the front.
  const CX = -1.6;
  const CZ = -4.1;
  const W = 8.0;
  const D = 4.6;
  const WALL = 2.5;
  const RISE = 1.6;
  const eave = FLOOR + WALL;
  const front = CZ + D / 2;
  const left = CX - W / 2;
  const pitch = Math.atan2(RISE, D);
  parts.push(hall(kit, { cx: CX, cz: CZ, w: W, d: D, h: WALL, wall: palette.wall }));
  parts.push(kit.prism(W - 0.06, RISE, D - 0.06, palette.wall, { x: CX, y: eave - 0.04, z: CZ }, 1));
  parts.push(kit.box(W + 0.9, 0.32, D / Math.cos(pitch) + 0.9, palette.roof, { x: CX, y: eave + RISE / 2 - 0.02, z: CZ, rx: -pitch, r: 0.12 }));
  parts.push(kit.box(W + 0.9, 0.22, 0.24, p.sign, { x: CX, y: eave + RISE + 0.02, z: front + 0.4, r: 0.07 }));
  parts.push(cornerPosts(kit, { cx: CX, cz: CZ, w: W, d: D, h: WALL - 0.1, paint: palette.accent }));
  for (const sx of [-1, 1]) parts.push(kit.box(0.42, RISE, 0.42, palette.accent, { x: CX + sx * (W / 2 - 0.1), y: eave - 0.1, z: front - 0.1, r: 0.1 }));

  // The reel on the front wall: flange, copper coil, hub and bolts.
  const SX = CX - 1.5;
  const SY = FLOOR + 2.75;
  parts.push(disc(kit, 1.22, 0.14, p.wood, SX, SY, front + 0.05, 30));
  parts.push(disc(kit, 0.95, 0.24, wire, SX, SY, front + 0.12, 30));
  parts.push(disc(kit, 0.66, 0.3, palette.roof, SX, SY, front + 0.12, 30));
  parts.push(disc(kit, 0.42, 0.36, p.wood, SX, SY, front + 0.12, 24));
  parts.push(disc(kit, 0.16, 0.44, p.darkMetal, SX, SY, front + 0.12, 12));
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2;
    parts.push(disc(kit, 0.07, 0.2, p.darkMetal, SX + Math.cos(angle) * 1.08, SY + Math.sin(angle) * 1.08, front + 0.05, 8));
  }
  parts.push(kit.box(0.09, 1.0, 0.09, wire, { x: SX + 0.93, y: SY - 1.35, z: front + 0.2, r: 0.04 }));

  // Door, a strip window over it, a window on the side.
  const doorX = CX + 2.35;
  parts.push(rollerDoor(kit, { cx: doorX, wall: front, y: FLOOR, width: 2.3, height: 2.2, paint: trim }));
  parts.push(kit.box(2.5, 0.75, 0.12, p.sign, { x: doorX, y: FLOOR + 2.95, z: front + 0.02, r: 0.05 }));
  parts.push(kit.box(2.25, 0.5, 0.16, kit.materials.window, { x: doorX, y: FLOOR + 3.07, z: front + 0.03, r: 0.05 }));
  parts.push(framedWindow(kit, { face: 'left', along: CZ, wall: left, y: FLOOR + 0.9, width: 2.0, sill: palette.accent }));

  // Drawing line along the front: thick rod off the pay-off reel, through three dies and two capstans, onto the take-up spool.
  const LZ = front + 1.25;
  const LY = FLOOR + 1.12;
  const payX = -6.2;
  const takeX = -1.0;
  for (const x of [payX, takeX]) {
    for (const sz of [-1, 1]) parts.push(kit.box(0.6, 0.85, 0.12, p.darkMetal, { x, y: FLOOR, z: LZ + sz * 0.46, r: 0.05 }));
  }
  parts.push(reel(kit, { x: payX, y: LY - 0.25, z: LZ, r: 0.62, width: 0.6, axis: 'z', flange: p.wood, coil: ore, fill: 0.55 }));
  parts.push(reel(kit, { x: takeX, y: LY - 0.25, z: LZ, r: 0.62, width: 0.6, axis: 'z', flange: p.wood, coil: wire, fill: 0.85 }));
  parts.push(kit.box(3.3, 0.24, 0.95, p.darkMetal, { x: -3.6, y: FLOOR + 0.6, z: LZ, r: 0.08 }));
  for (const sx of [-1, 1]) parts.push(kit.box(0.24, 0.62, 0.8, p.darkMetal, { x: -3.6 + sx * 1.35, y: FLOOR, z: LZ, r: 0.06 }));
  for (const [x, paint] of [[-4.75, palette.accent], [-3.6, trim], [-2.45, palette.accent]] as const) {
    parts.push(kit.box(0.42, 0.6, 0.66, paint, { x, y: FLOOR + 0.84, z: LZ, r: 0.1 }));
  }
  for (const x of [-4.18, -3.02]) parts.push(kit.cyl(0.24, 0.24, 0.34, p.metal, { x, y: FLOOR + 0.84, z: LZ + 0.06 }, 14));
  parts.push(pipe(kit, 0.06, 2.6, 'x', -5.45 + 0.6, LY + 0.02, LZ, ore, 8));
  parts.push(pipe(kit, 0.035, 3.1, 'x', -2.55, LY + 0.02, LZ, wire, 8));

  // Smelter at the side: brick box, fire mouth, hood and stack. Ore heap and copper bars beside it.
  const FX = 4.3;
  const FZ = -4.5;
  parts.push(kit.box(2.7, 0.5, 2.7, p.rock, { x: FX, y: FLOOR, z: FZ, r: 0.12 }));
  parts.push(kit.box(2.4, 2.1, 2.4, palette.accent, { x: FX, y: FLOOR + 0.3, z: FZ, r: 0.2 }));
  parts.push(kit.box(1.1, 0.95, 0.2, p.darkMetal, { x: FX, y: FLOOR + 0.7, z: FZ + 1.14, r: 0.2 }));
  parts.push(kit.box(0.72, 0.6, 0.24, glow, { x: FX, y: FLOOR + 0.8, z: FZ + 1.16, r: 0.18 }));
  parts.push(kit.cyl(0.55, 1.25, 0.8, palette.roof, { x: FX, y: FLOOR + 2.35, z: FZ }, 16));
  parts.push(chimney(kit, { x: FX, z: FZ, y: FLOOR + 3.1, r: 0.5, h: 3.0, body: palette.accent }));
  parts.push(kit.dome(0.8, 0.55, 0.7, ore, { x: FX + 0.75, y: FLOOR - 0.02, z: FZ + 2.3 }));
  parts.push(kit.dome(0.45, 0.32, 0.45, ore, { x: FX - 0.1, y: FLOOR - 0.02, z: FZ + 2.6 }));
  for (const [dx, dy] of [[-0.2, 0], [0.2, 0], [0, 0.18]] as const) {
    parts.push(kit.box(0.34, 0.18, 0.9, wire, { x: FX - 1.35 + dx, y: FLOOR + dy, z: FZ + 2.3, r: 0.05 }));
  }

  // Cable drums: one lying flat with a small one on top, one standing chocked.
  const DX = 4.5;
  const DZ = 0.5;
  parts.push(kit.cyl(0.95, 0.95, 0.12, p.wood, { x: DX, y: FLOOR, z: DZ }, 20));
  parts.push(kit.cyl(0.72, 0.72, 0.7, wire, { x: DX, y: FLOOR + 0.12, z: DZ }, 20));
  parts.push(kit.cyl(0.95, 0.95, 0.12, p.wood, { x: DX, y: FLOOR + 0.82, z: DZ }, 20));
  parts.push(reel(kit, { x: DX, y: FLOOR + 1.44, z: DZ, r: 0.5, width: 0.5, axis: 'x', flange: p.wood, coil: wire }));
  parts.push(reel(kit, { x: 2.75, y: FLOOR + 0.75, z: 1.0, r: 0.75, width: 0.7, axis: 'x', flange: p.wood, coil: wire, fill: 0.8 }));
  for (const sz of [-1, 1]) parts.push(kit.box(0.7, 0.2, 0.24, p.wood, { x: 2.75, y: FLOOR, z: 1.0 + sz * 0.62, r: 0.05 }));

  // Loose coils on a pallet by the door.
  const PX = 2.85;
  const PZ = front + 0.95;
  parts.push(kit.box(1.1, 0.12, 1.1, p.wood, { x: PX, y: FLOOR, z: PZ, r: 0.04 }));
  for (let i = 0; i < 4; i += 1) parts.push(kit.cyl(0.44, 0.44, 0.17, wire, { x: PX + (i % 2 ? 0.04 : -0.04), y: FLOOR + 0.12 + i * 0.18, z: PZ }, 16));
  parts.push(kit.cyl(0.24, 0.24, 0.04, p.darkMetal, { x: PX + 0.04, y: FLOOR + 0.81, z: PZ }, 12));

  // Small props.
  parts.push(planter(kit, doorX - 1.75, FLOOR, front + 0.45, trim));
  parts.push(bush(kit, left - 1.0, FLOOR - 0.05, CZ + 0.4));
  parts.push(kit.cyl(0.1, 0.12, 0.6, p.hazard, { x: 0.3, y: FLOOR, z: LZ + 0.4 }, 8));

  return kit.group(parts.flat(), { ...BUILDING_ANCHORS, smoke: [[FX, FLOOR + 6.5, FZ]] });
}

export function registerWireMillModel(registry: ModelRegistry): void {
  registry.register('building.wireMill', wireMill);
}
