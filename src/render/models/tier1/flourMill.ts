/**
 * Flour mill: a round tower windmill whose sails are the sign, two grain
 * silos behind it, a small gabled store, and millstones grinding in the open
 * with grain going in and flour sacks coming out.
 */
import { Group, type Object3D } from 'three';
import type { ModelRegistry } from '../../ModelRegistry';
import { buildingPalette, itemColor } from '../../theme';
import { BUILDING_ANCHORS } from '../buildings';
import type { Kit } from '../kit';
import { barnDoor, bush, framedWindow, gableRoof } from '../parts';
import { FLOOR, disc, hall, pipe, planter, sack, slab, slantPipe, type Parts } from './shared';

/** Four lattice sails on a hub, facing the front; the centre is at the origin of the group. */
function sails(kit: Kit, length: number, cloth: number, wood: number): Group {
  const wheel = new Group();
  for (let i = 0; i < 4; i += 1) {
    const arm = new Group();
    arm.add(kit.box(0.16, length - 0.2, 0.12, wood, { y: 0.2, r: 0.04 }));
    arm.add(kit.box(0.74, length - 1.0, 0.05, cloth, { x: 0.42, y: 0.85, r: 0.02 }));
    for (const t of [0.3, 0.55, 0.8, 0.98]) arm.add(kit.box(0.8, 0.07, 0.09, wood, { x: 0.4, y: length * t - 0.06, r: 0.02 }));
    arm.add(kit.box(0.07, length - 1.0, 0.09, wood, { x: 0.8, y: 0.85, r: 0.02 }));
    arm.rotation.z = (i * Math.PI) / 2;
    wheel.add(arm);
  }
  return wheel;
}

function flourMill(kit: Kit): Object3D {
  const theme = kit.theme;
  const palette = buildingPalette(theme, 'flourMill');
  const p = theme.props;
  const trim = palette.trim ?? palette.accent;
  const grain = itemColor(theme, 'grain');
  const flour = itemColor(theme, 'flour');
  const parts: Parts = [slab(kit)];

  // Tower: stone base, tapered body, gallery ring, cap.
  const TX = -3.4;
  const TZ = -3.5;
  const bodyY = FLOOR + 0.4;
  const BODY = 4.6;
  const radiusAt = (y: number): number => 2.05 - ((y - bodyY) / BODY) * 0.7;
  parts.push(kit.cyl(2.15, 2.3, 0.75, p.rock, { x: TX, y: FLOOR, z: TZ }, 22));
  parts.push(kit.cyl(1.35, 2.05, BODY, palette.wall, { x: TX, y: bodyY, z: TZ }, 22));
  parts.push(kit.cyl(2.1, 2.1, 0.16, p.wood, { x: TX, y: FLOOR + 2.1, z: TZ }, 22));
  parts.push(kit.cyl(1.8, 1.8, 0.14, palette.accent, { x: TX, y: FLOOR + 2.3, z: TZ }, 22));
  parts.push(kit.cyl(1.55, 1.55, 0.24, p.sign, { x: TX, y: bodyY + BODY - 0.1, z: TZ }, 22));
  parts.push(kit.cone(1.7, 1.5, palette.roof, { x: TX, y: bodyY + BODY + 0.1, z: TZ }, 22));
  parts.push(kit.blob(0.18, 0.18, 0.18, palette.accent, { x: TX, y: bodyY + BODY + 1.5, z: TZ }));
  // Door and windows on the tower.
  parts.push(kit.box(1.1, 1.75, 0.3, p.sign, { x: TX, y: FLOOR + 0.3, z: TZ + radiusAt(1.3) - 0.02, r: 0.12 }));
  parts.push(kit.box(0.86, 1.6, 0.34, trim, { x: TX, y: FLOOR + 0.3, z: TZ + radiusAt(1.3), r: 0.12 }));
  parts.push(kit.box(0.6, 0.75, 0.3, kit.materials.window, { x: TX, y: FLOOR + 2.9, z: TZ + radiusAt(3.5) - 0.02, r: 0.1 }));
  parts.push(kit.box(0.3, 0.75, 0.6, kit.materials.window, { x: TX + radiusAt(3.5) - 0.02, y: FLOOR + 2.9, z: TZ, r: 0.1 }));

  // Sails on a shaft out of the cap.
  const hubY = bodyY + BODY - 0.1;
  const hubZ = TZ + 1.95;
  parts.push(pipe(kit, 0.14, 1.1, 'z', TX, hubY, hubZ - 0.5, p.darkMetal));
  const wheel = sails(kit, 3.15, p.sign, p.wood);
  wheel.position.set(TX, hubY, hubZ);
  wheel.rotation.z = 0.4;
  parts.push(wheel);
  parts.push(disc(kit, 0.3, 0.2, palette.accent, TX, hubY, hubZ + 0.06, 14));

  // Grain silos behind the tower, with an auger pipe across.
  const silos = [[-6.6, -5.75], [-6.65, -3.75]] as const;
  for (const [x, z] of silos) {
    parts.push(kit.cyl(0.9, 0.9, 0.3, p.rock, { x, y: FLOOR, z }, 16));
    parts.push(kit.cyl(0.82, 0.82, 3.5, p.metal, { x, y: FLOOR + 0.25, z }, 16));
    parts.push(kit.cyl(0.86, 0.86, 0.14, palette.accent, { x, y: FLOOR + 1.5, z }, 16));
    parts.push(kit.cyl(0.86, 0.86, 0.14, palette.accent, { x, y: FLOOR + 2.9, z }, 16));
    parts.push(kit.cone(0.95, 0.8, palette.roof, { x, y: FLOOR + 3.7, z }, 16));
  }
  parts.push(slantPipe(kit, 0.1, -6.65, FLOOR + 4.3, -4.7, FLOOR + 3.4, -3.75, p.darkMetal));

  // Store shed on the right, a wheat-ear sign in its gable.
  const CX = 3.0;
  const CZ = -3.7;
  const W = 4.8;
  const D = 5.0;
  const WALL = 2.3;
  const eave = FLOOR + WALL;
  const front = CZ + D / 2;
  parts.push(hall(kit, { cx: CX, cz: CZ, w: W, d: D, h: WALL, wall: palette.wall }));
  parts.push(gableRoof(kit, { cx: CX, cz: CZ, width: W, depth: D, eave, rise: 1.7, wall: palette.wall, roof: palette.roof, cap: palette.accent, overhang: 0.5 }));
  parts.push(barnDoor(kit, { cx: CX, wall: front, y: FLOOR, width: 2.2, height: 1.9, paint: trim }));
  parts.push(framedWindow(kit, { face: 'right', along: CZ, wall: CX + W / 2, y: FLOOR + 0.85, width: 1.8, height: 1.1, sill: palette.accent }));
  const earY = eave + 0.55;
  parts.push(kit.box(0.07, 0.9, 0.08, grain, { x: CX, y: earY - 0.3, z: front + 0.08, r: 0.02 }));
  for (const [dx, dy, rz] of [[-0.14, 0.1, 0.5], [0.14, 0.1, -0.5], [-0.14, 0.34, 0.5], [0.14, 0.34, -0.5], [0, 0.56, 0]] as const) {
    parts.push(kit.blob(0.1, 0.17, 0.07, grain, { x: CX + dx, y: earY + dy - 0.1, z: front + 0.1, rz }));
  }

  // Millstones in the open: grain hopper above, flour spilling into the trough.
  const MX = -0.2;
  const MZ = -0.2;
  parts.push(kit.box(1.9, 0.5, 1.9, p.wood, { x: MX, y: FLOOR, z: MZ, r: 0.1 }));
  parts.push(kit.cyl(0.8, 0.8, 0.3, p.rock, { x: MX, y: FLOOR + 0.5, z: MZ }, 18));
  parts.push(kit.cyl(0.86, 0.86, 0.08, flour, { x: MX, y: FLOOR + 0.78, z: MZ }, 18));
  parts.push(kit.cyl(0.74, 0.74, 0.3, p.rock, { x: MX, y: FLOOR + 0.86, z: MZ }, 18));
  parts.push(kit.cyl(0.12, 0.12, 0.2, p.darkMetal, { x: MX, y: FLOOR + 1.14, z: MZ }, 8));
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) parts.push(kit.box(0.13, 2.0, 0.13, p.wood, { x: MX + sx * 0.82, y: FLOOR + 0.45, z: MZ + sz * 0.82, r: 0.04 }));
  }
  parts.push(kit.box(1.8, 0.14, 1.8, p.wood, { x: MX, y: FLOOR + 2.3, z: MZ, r: 0.05 }));
  parts.push(kit.cyl(0.6, 0.16, 0.65, palette.accent, { x: MX, y: FLOOR + 1.7, z: MZ }, 12));
  parts.push(kit.dome(0.52, 0.26, 0.52, grain, { x: MX, y: FLOOR + 2.42, z: MZ }));
  parts.push(kit.box(0.4, 0.1, 1.1, p.wood, { x: MX, y: FLOOR + 0.42, z: MZ + 1.2, rx: 0.35, r: 0.03 }));
  parts.push(kit.box(0.9, 0.3, 0.6, p.wood, { x: MX, y: FLOOR, z: MZ + 1.75, r: 0.06 }));
  parts.push(kit.dome(0.36, 0.22, 0.24, flour, { x: MX, y: FLOOR + 0.26, z: MZ + 1.75 }));

  // Grain coming in: open sacks and a heap on the left.
  parts.push(kit.dome(0.75, 0.5, 0.65, grain, { x: -2.2, y: FLOOR - 0.02, z: 1.15 }));
  parts.push(sack(kit, -3.2, FLOOR, 1.3, p.wood, grain));
  parts.push(sack(kit, -3.85, FLOOR, 0.95, p.wood, grain, 0.9));

  // Flour sacks stacked by the store door, and a handcart with two more.
  for (const [x, y, z] of [[4.75, 0, front + 0.5], [5.4, 0, front + 0.6], [4.8, 0, front + 1.15], [5.1, 0.55, front + 0.75]] as const) {
    parts.push(sack(kit, x, FLOOR + y, z, flour, trim));
  }
  const cartX = 1.9;
  const cartZ = 1.2;
  parts.push(kit.box(1.3, 0.14, 0.9, p.wood, { x: cartX, y: FLOOR + 0.36, z: cartZ, r: 0.04 }));
  for (const sz of [-1, 1]) parts.push(pipe(kit, 0.3, 0.1, 'z', cartX - 0.2, FLOOR + 0.3, cartZ + sz * 0.5, p.darkMetal, 12));
  parts.push(kit.box(0.9, 0.08, 0.08, p.wood, { x: cartX + 1.0, y: FLOOR + 0.5, z: cartZ, rz: 0.25, r: 0.03 }));
  parts.push(sack(kit, cartX - 0.25, FLOOR + 0.48, cartZ, flour, trim, 0.9));
  parts.push(sack(kit, cartX + 0.3, FLOOR + 0.48, cartZ + 0.05, flour, trim, 0.85));

  // Picket fence along the left, greenery and a pot.
  for (let i = 0; i < 4; i += 1) parts.push(kit.box(0.14, 0.7, 0.14, p.fence, { x: -7.15, y: FLOOR, z: -2.3 + i * 0.95, r: 0.05 }));
  parts.push(kit.box(0.08, 0.12, 3.1, p.fence, { x: -7.15, y: FLOOR + 0.42, z: -0.87, r: 0.03 }));
  parts.push(bush(kit, -6.3, FLOOR - 0.05, -1.6));
  parts.push(planter(kit, CX - 1.75, FLOOR, front + 0.45, palette.accent));

  return kit.group(parts.flat(), { ...BUILDING_ANCHORS, smoke: [] });
}

export function registerFlourMillModel(registry: ModelRegistry): void {
  registry.register('building.flourMill', flourMill);
}
